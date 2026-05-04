import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const unlinked = await prisma.appointment.findMany({
    where: { userId: null, patientPhone: { not: "" } },
    select: { id: true, patientPhone: true, patientName: true },
  });

  console.log(`🔄 ${unlinked.length} ta appointment userId'siz topildi`);

  let fixed = 0;
  for (const appt of unlinked) {
    const user = await prisma.user.findFirst({
      where: { phone: appt.patientPhone },
      select: { id: true, tibId: true },
    });
    if (!user) continue;
    await prisma.appointment.update({ where: { id: appt.id }, data: { userId: user.id } });
    console.log(`  ✅ ${appt.patientName} (${appt.patientPhone}) → ${user.tibId}`);
    fixed++;
  }

  console.log(`\n✅ Tugadi: ${fixed}/${unlinked.length} appointment ulandi.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
