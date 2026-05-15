/**
 * One-time seed script: M2M bog'lanishlar + photoUrl + requiresPrePayment
 *
 * Ishlatish: npm run seed:m2m   yoki   npx ts-node prisma/seed-m2m.ts
 * Idempotent: qayta ishga tushirsa xavfsiz.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── 1. Doctor photo URL'lar ─────────────────────────────────────────────────

const DOCTOR_PHOTOS: Record<string, string> = {
  "doc-1": "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&h=200&fit=crop",
  "doc-2": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop",
  "doc-3": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&h=200&fit=crop",
  "cmok59t3e0001ky047j8riktd": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=200&h=200&fit=crop",
};

// ─── 2. Service-Doctor M2M bog'lanishlar ─────────────────────────────────────

const SERVICE_DOCTOR_BINDINGS: Array<{ serviceId: string; doctorId: string }> = [
  { serviceId: "svc-queue-1", doctorId: "doc-1" },          // Terapevt qabuli → Toshmatov
  { serviceId: "svc-queue-2", doctorId: "doc-2" },          // Kardiolog qabuli → Yusupova
  { serviceId: "svc-diag-2", doctorId: "doc-2" },           // EKG → Yusupova
  { serviceId: "svc-home-1", doctorId: "doc-1" },           // Uyda bemor ko'rish → Toshmatov
  { serviceId: "svc-home-1", doctorId: "doc-2" },           // Uyda bemor ko'rish → Yusupova
];

// ─── 3. requiresPrePayment xizmatlari ────────────────────────────────────────

const PREPAYMENT_SERVICES: Array<{ id: string; amount: number | null }> = [
  { id: "svc-diag-1", amount: null },    // Qon tahlili — 100% oldindan
  { id: "svc-diag-2", amount: null },    // EKG — 100% oldindan
  { id: "svc-home-1", amount: 50000 },  // Uyda bemor ko'rish — 50 000 so'm deposit
];

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Starting M2M seed...\n");

  // ── Step 1: Photo URL'lar ──────────────────────────────────────────────────
  console.log("📸 Step 1: Doctor photos");
  for (const [doctorId, photoUrl] of Object.entries(DOCTOR_PHOTOS)) {
    try {
      const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
      if (!doctor) {
        console.log(`   ⚠️  Doctor ${doctorId} topilmadi — skip`);
        continue;
      }
      if (doctor.photoUrl) {
        console.log(`   →  ${doctorId} (${doctor.firstName}) — photo allaqachon bor, tegmaslik`);
        continue;
      }
      await prisma.doctor.update({ where: { id: doctorId }, data: { photoUrl } });
      console.log(`   ✓  ${doctorId} (${doctor.firstName} ${doctor.lastName}) — photo qo'shildi`);
    } catch (e) {
      console.error(`   ✗  ${doctorId} xato:`, e);
    }
  }

  // ── Step 2: Service-Doctor M2M ────────────────────────────────────────────
  console.log("\n🔗 Step 2: Service-Doctor M2M bindings");
  for (const binding of SERVICE_DOCTOR_BINDINGS) {
    try {
      const [service, doctor] = await Promise.all([
        prisma.service.findUnique({ where: { id: binding.serviceId } }),
        prisma.doctor.findUnique({ where: { id: binding.doctorId } }),
      ]);
      if (!service) {
        console.log(`   ⚠️  Service ${binding.serviceId} topilmadi — skip`);
        continue;
      }
      if (!doctor) {
        console.log(`   ⚠️  Doctor ${binding.doctorId} topilmadi — skip`);
        continue;
      }
      await prisma.serviceDoctor.upsert({
        where: { serviceId_doctorId: { serviceId: binding.serviceId, doctorId: binding.doctorId } },
        update: {},
        create: { serviceId: binding.serviceId, doctorId: binding.doctorId },
      });
      console.log(`   ✓  ${service.name} ↔ ${doctor.firstName} ${doctor.lastName} (${doctor.specialty})`);
    } catch (e) {
      console.error(`   ✗  ${binding.serviceId} ↔ ${binding.doctorId} xato:`, e);
    }
  }

  // ── Step 3: requiresPrePayment ────────────────────────────────────────────
  console.log("\n💰 Step 3: requiresPrePayment flags");
  for (const sp of PREPAYMENT_SERVICES) {
    try {
      const service = await prisma.service.findUnique({ where: { id: sp.id } });
      if (!service) {
        console.log(`   ⚠️  Service ${sp.id} topilmadi — skip`);
        continue;
      }
      await prisma.service.update({
        where: { id: sp.id },
        data: { requiresPrePayment: true, prePaymentAmount: sp.amount },
      });
      const amountStr = sp.amount === null
        ? `100% (${Number(service.price).toLocaleString()} so'm)`
        : `${sp.amount.toLocaleString()} so'm deposit`;
      console.log(`   ✓  ${service.name} — oldindan to'lov: ${amountStr}`);
    } catch (e) {
      console.error(`   ✗  ${sp.id} xato:`, e);
    }
  }

  // ── Yakuniy hisobot ───────────────────────────────────────────────────────
  console.log("\n📊 Final state:");
  const [doctorCount, photoCount, bindingCount, prePaymentCount] = await Promise.all([
    prisma.doctor.count({ where: { isActive: true } }),
    prisma.doctor.count({ where: { isActive: true, photoUrl: { not: null } } }),
    prisma.serviceDoctor.count(),
    prisma.service.count({ where: { isActive: true, requiresPrePayment: true } }),
  ]);
  console.log(`   Active doctors:          ${doctorCount}`);
  console.log(`   Doctors with photo:      ${photoCount}/${doctorCount}`);
  console.log(`   Service-Doctor bindings: ${bindingCount}`);
  console.log(`   Services with prePayment: ${prePaymentCount}`);
  console.log("\n✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
