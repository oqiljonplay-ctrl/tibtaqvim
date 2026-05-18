/**
 * One-time cleanup script for duplicate doctors.
 *
 * Sabab: Form submit himoyasiz bo'lgan paytda yaratilgan dublikatlar.
 *
 * Usage: npm run cleanup:dups
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DUPLICATE_DOCTOR_IDS = [
  "cmp79s1kn0003kz042h0uko3w",
  "cmp79s18w0001kz04nudlpb29",
  "cmp79s17i0001l504b2w5qu73",
];

async function main() {
  console.log("🧹 Cleaning up duplicate doctors...\n");

  for (const id of DUPLICATE_DOCTOR_IDS) {
    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            services: true,
            appointments: true,
          },
        },
      },
    });

    if (!doctor) {
      console.log(`⚠️  ${id} — topilmadi, skip`);
      continue;
    }

    console.log(`📋 ${doctor.firstName} ${doctor.lastName} (${doctor.specialty})`);
    console.log(`   services: ${doctor._count.services}, appointments: ${doctor._count.appointments}`);

    if (doctor._count.appointments > 0) {
      console.log(`   ⚠️  Appointments mavjud — skip (xavfsizlik uchun)`);
      continue;
    }

    await prisma.serviceDoctor.deleteMany({ where: { doctorId: id } });
    await prisma.doctor.delete({ where: { id } });

    console.log(`   ✓ O'chirildi`);
  }

  const remaining = await prisma.doctor.findMany({
    where: { firstName: "Farrux", lastName: "Shukurov" },
  });

  console.log(`\n📊 Qoldi: ${remaining.length} ta Farrux Shukurov`);

  if (remaining.length === 0) {
    console.log("⚠️  Hech qaysi Pulmonolog qolmadi. Admin paneldan qayta yaratish kerak.");
  } else if (remaining.length === 1) {
    console.log("✅ Bittasi qoldi — to'g'ri holat");
  }

  console.log("\n✅ Cleanup completed!");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
