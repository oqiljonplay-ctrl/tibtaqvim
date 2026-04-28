import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seed boshlanmoqda...");

  // Klinika
  const clinic = await prisma.clinic.upsert({
    where: { id: "clinic-demo" },
    update: {},
    create: {
      id: "clinic-demo",
      name: "HealthCare Klinikasi",
      phone: "+998 71 000 00 00",
      address: "Toshkent sh., Chilonzor t., Bunyodkor 12",
    },
  });

  // Filial
  const branch = await prisma.branch.upsert({
    where: { id: "branch-main" },
    update: {},
    create: {
      id: "branch-main",
      clinicId: clinic.id,
      name: "Asosiy filial",
      address: "Toshkent sh., Chilonzor t., Bunyodkor 12",
      phone: "+998 71 000 00 01",
    },
  });

  // Xizmatlar
  const services = [
    {
      id: "svc-queue-1",
      name: "Terapevt qabuli",
      type: "doctor_queue" as const,
      price: 80000,
      requiresSlot: false,
      requiresAddress: false,
      dailyLimit: 40,
    },
    {
      id: "svc-queue-2",
      name: "Kardiolog qabuli",
      type: "doctor_queue" as const,
      price: 120000,
      requiresSlot: false,
      requiresAddress: false,
      dailyLimit: 20,
    },
    {
      id: "svc-diag-1",
      name: "Qon tahlili (umumiy)",
      type: "diagnostic" as const,
      price: 50000,
      requiresSlot: true,
      requiresAddress: false,
      dailyLimit: null,
    },
    {
      id: "svc-diag-2",
      name: "EKG",
      type: "diagnostic" as const,
      price: 60000,
      requiresSlot: false,
      requiresAddress: false,
      dailyLimit: 30,
    },
    {
      id: "svc-home-1",
      name: "Uyda bemor ko'rish",
      type: "home_service" as const,
      price: 200000,
      requiresSlot: false,
      requiresAddress: true,
      dailyLimit: 10,
    },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { id: s.id },
      update: {},
      create: { ...s, clinicId: clinic.id, sortOrder: services.indexOf(s) },
    });
  }

  // Shifokorlar
  const doctors = [
    { id: "doc-1", firstName: "Jasur", lastName: "Toshmatov", specialty: "Terapevt", phone: "+998 90 111 11 11" },
    { id: "doc-2", firstName: "Dilnoza", lastName: "Yusupova", specialty: "Kardiolog", phone: "+998 90 222 22 22" },
    { id: "doc-3", firstName: "Nodir", lastName: "Rahimov", specialty: "Nevropatolog", phone: "+998 90 333 33 33" },
  ];

  for (const d of doctors) {
    await prisma.doctor.upsert({
      where: { id: d.id },
      update: {},
      create: { ...d, clinicId: clinic.id, branchId: branch.id },
    });
  }

  // Admin foydalanuvchi
  const passwordHash = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { id: "user-admin" },
    update: {},
    create: {
      id: "user-admin",
      clinicId: clinic.id,
      firstName: "Admin",
      lastName: "ClinicBot",
      phone: "+998 90 000 00 00",
      role: "clinic_admin",
      passwordHash,
    },
  });

  // Bugungi slotlar (diagnostika uchun)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const slotTimes = [
    ["09:00", "09:30"],
    ["09:30", "10:00"],
    ["10:00", "10:30"],
    ["10:30", "11:00"],
    ["11:00", "11:30"],
    ["14:00", "14:30"],
    ["14:30", "15:00"],
    ["15:00", "15:30"],
  ];

  for (let i = 0; i < slotTimes.length; i++) {
    await prisma.slot.upsert({
      where: { id: `slot-diag-${i}` },
      update: {},
      create: {
        id: `slot-diag-${i}`,
        clinicId: clinic.id,
        branchId: branch.id,
        serviceId: "svc-diag-1",
        date: today,
        startTime: slotTimes[i][0],
        endTime: slotTimes[i][1],
        capacity: 2,
      },
    });
  }

  console.log("✅ Seed muvaffaqiyatli yakunlandi!");
  console.log(`📌 Klinika ID: ${clinic.id}`);
  console.log("🔑 Admin login: +998 90 000 00 00 / admin123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
