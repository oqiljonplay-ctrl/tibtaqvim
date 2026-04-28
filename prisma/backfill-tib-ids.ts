/**
 * Backfill script: barcha tibId yo'q userlarga tibId beradi.
 * Ishlatish: npx ts-node prisma/backfill-tib-ids.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function formatTibId(n: number): string {
  return "tib" + String(n).padStart(6, "0");
}

async function main() {
  const users = await prisma.user.findMany({
    where: { tibId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, firstName: true, phone: true },
  });

  if (users.length === 0) {
    console.log("✅ Barcha userlar allaqachon tibId ga ega.");
    return;
  }

  // Mavjud max raqamni aniqlash
  const lastUser = await prisma.user.findFirst({
    where: { tibId: { not: null } },
    orderBy: { tibId: "desc" },
    select: { tibId: true },
  });

  let counter = 0;
  if (lastUser?.tibId) {
    const num = parseInt(lastUser.tibId.replace("tib", ""), 10);
    if (!isNaN(num)) counter = num;
  }

  console.log(`🔄 ${users.length} ta user uchun tibId berish boshlandi (${counter} dan)...`);

  let success = 0;
  for (const user of users) {
    counter++;
    const tibId = formatTibId(counter);
    try {
      await prisma.user.update({ where: { id: user.id }, data: { tibId } });
      console.log(`  ✅ ${user.firstName} (${user.phone ?? "tel yo'q"}) → ${tibId}`);
      success++;
    } catch (err: any) {
      console.error(`  ❌ ${user.id}: ${err.message}`);
    }
  }

  console.log(`\n✅ Tugadi: ${success}/${users.length} muvaffaqiyatli.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
