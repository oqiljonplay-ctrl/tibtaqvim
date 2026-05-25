/**
 * MD-B migratsiya: 6 shifokorga login akkaunt yaratish
 * Ishlatish: npx tsx scripts/migrate-doctors.ts
 * Bu script bir marta ishlatiladi.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PWD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generateRandomPassword(length = 12): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += PWD_CHARS[Math.floor(Math.random() * PWD_CHARS.length)];
  }
  if (!/[0-9]/.test(result)) result = result.slice(0, -1) + "7";
  return result;
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Telefon normalizatsiyasi (normalizePhone dan ko'chirish)
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s\-\(\)]/g, "");
  if (/^\+998\d{9}$/.test(digits)) return digits;
  if (/^998\d{9}$/.test(digits)) return "+" + digits;
  if (/^0\d{9}$/.test(digits)) return "+998" + digits.slice(1);
  if (/^9\d{8}$/.test(digits)) return "+998" + digits;
  return digits;
}

const DOCTORS_TO_MIGRATE = [
  { id: "cmp95zdec0001k10452tzk4tg", clinicId: "clinic-demo",               branchId: null },
  { id: "cmp6wumvr0001le045nwjsome", clinicId: "clinic-demo",               branchId: null },
  { id: "cmp6lu5110001l4049vpal8ky", clinicId: "clinic-demo",               branchId: null },
  { id: "doc-3",                     clinicId: "clinic-demo",               branchId: null },
  { id: "cmok59t3e0001ky047j8riktd", clinicId: "clinic-demo",               branchId: null },
  { id: "cmpchjxg30001l504xopsrqxk", clinicId: "cmpay6dn80002l504rr8qez3t", branchId: "cmpay6dro0004l504958wzj2u" },
];

const ACTOR_ID = "system-migration-md-b";

async function main() {
  console.log("=== MD-B Migratsiya boshlanmoqda ===\n");

  const results: { name: string; phone: string; password: string }[] = [];

  for (const entry of DOCTORS_TO_MIGRATE) {
    const doctor = await prisma.doctor.findUnique({ where: { id: entry.id } });
    if (!doctor) {
      console.warn(`⚠️  Doctor topilmadi: ${entry.id} — o'tkazib yuborish`);
      continue;
    }

    if (doctor.userId) {
      console.log(`✓ ${doctor.firstName} ${doctor.lastName} — allaqachon userId bor, o'tkazish`);
      continue;
    }

    if (!doctor.phone) {
      console.warn(`⚠️  ${doctor.firstName} ${doctor.lastName} — telefon yo'q, o'tkazib yuborish`);
      continue;
    }

    const phone = normalizePhone(doctor.phone);
    const password = generateRandomPassword(12);
    const passwordHash = await hashPassword(password);

    try {
      await prisma.$transaction(async (tx) => {
        // Telefon band emasligini tekshir
        const existing = await tx.user.findFirst({ where: { phone } });
        if (existing) {
          throw Object.assign(
            new Error(`Telefon band: ${phone} → userId: ${existing.id}`),
            { code: "PHONE_TAKEN" }
          );
        }

        // Yangi users yozuvi
        const newUser = await tx.user.create({
          data: {
            firstName: doctor.firstName,
            lastName: doctor.lastName,
            phone,
            passwordHash,
            role: "doctor",
            clinicId: entry.clinicId,
            branchId: entry.branchId,
            username: null,
            isActive: true,
          },
        });

        // Doctor.phone standartlash + userId bog'lash
        await tx.doctor.update({
          where: { id: doctor.id },
          data: { phone, userId: newUser.id },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            actorId: ACTOR_ID,
            clinicId: entry.clinicId,
            action: "migration.doctor_account_created",
            payload: {
              doctorId: doctor.id,
              userId: newUser.id,
              phone,
              migratedFrom: doctor.phone,
            },
          },
        });

        console.log(`✅ ${doctor.firstName} ${doctor.lastName} | ${phone} | userId: ${newUser.id}`);
      });

      results.push({
        name: `${doctor.firstName} ${doctor.lastName}`,
        phone,
        password,
      });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "PHONE_TAKEN") {
        console.error(`❌ ${doctor.firstName} ${doctor.lastName} — ${e.message}`);
      } else {
        console.error(`❌ ${doctor.firstName} ${doctor.lastName} — Xato:`, e.message);
      }
    }
  }

  console.log("\n=== MIGRATSIYA TUGADI ===\n");
  console.log("📋 LOGIN VA PAROLLAR RO'YXATI (admin tarqatishi uchun):\n");
  console.log("─".repeat(60));
  for (const r of results) {
    console.log(`Ism    : ${r.name}`);
    console.log(`Login  : ${r.phone}`);
    console.log(`Parol  : ${r.password}`);
    console.log("─".repeat(60));
  }
  console.log("\n⚠️  Parollar bazada faqat hash sifatida saqlanadi.");
  console.log("    Bu ro'yxatni xavfsiz joyga saqlang va xodimlarga tarqating.");
}

main()
  .catch((e) => {
    console.error("Fatal xato:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
