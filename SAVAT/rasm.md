# 🎯 VAZIFA: M2M test ma'lumotlarini DB'ga seed qilish

## LOYIHA KONTEKSTI

Stack: Next.js 14 + Prisma + Supabase PostgreSQL 17 + Vercel + Telegram bot
Repo: oqiljonplay-ctrl/tibtaqvim
Production: https://tibtaqvim.vercel.app

Hozirgi holat: 
- Schema migration tugagan (commit: 2711a6d)
- service_doctors M2M table mavjud
- services jadvalida requiresPrePayment va prePaymentAmount ustunlari mavjud
- doctors jadvalida photoUrl ustuni allaqachon mavjud
- Backend API va frontend UI tayyor
- AMMO service_doctors jadvali bo'sh, photoUrl null, requiresPrePayment hammada false

## MUAMMO

User admin paneldan qo'lda kiritishni xohlamadi (10-15 daqiqa). Buning o'rniga, bir martalik seed script yozib, hammasini avtomatik to'ldirib qo'yamiz.

## MAVJUD MA'LUMOTLAR (REAL ID'LAR — TEGMASLIK)

### Doctors (4 ta — barchasi clinic-demo'da, isActive=true):
doc-1                       | Jasur Toshmatov    | Terapevt
doc-2                       | Dilnoza Yusupova   | Kardiolog
doc-3                       | Nodir Rahimov      | Nevropatolog
cmok59t3e0001ky047j8riktd   | Oqil Sayfiyev      | Stomatolog
### Services (6 ta — barchasi clinic-demo'da, isActive=true):
svc-queue-1                 | Terapevt qabuli           | doctor_queue
svc-queue-2                 | Kardiolog qabuli          | doctor_queue
cmoik6xo70001jy04xgvdywo2   | Ortopedga kunlik kvota    | doctor_queue
svc-diag-1                  | Qon tahlili (umumiy)      | diagnostic
svc-diag-2                  | EKG                       | diagnostic
svc-home-1                  | Uyda bemor ko'rish        | home_service
## BAJARILISHI KERAK BO'LGAN ISH

### Yagona vazifa: prisma/seed-m2m.ts faylini yarat

Bu bir martalik script — quyidagi 3 xil ish bajaradi:

#### 1. Doctorlarga photoUrl qo'shish (faqat null bo'lganlarga)

| Doctor ID | Name | photoUrl |
|---|---|---|
| doc-1 | Jasur Toshmatov | https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&h=200&fit=crop |
| doc-2 | Dilnoza Yusupova | https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop |
| doc-3 | Nodir Rahimov | https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&h=200&fit=crop |
| cmok59t3e0001ky047j8riktd | Oqil Sayfiyev | https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=200&h=200&fit=crop |

Logika: UPDATE qilganda faqat photoUrl IS NULL bo'lganlarga yangilash. Agar admin allaqachon photo qo'ygan bo'lsa — TEGMASLIK.

#### 2. Service-Doctor M2M bog'lanishlari (Many-to-Many)

Specialty asosida mantiqiy bog'lash:

| Service | → Doctor(s) | Sabab |
|---|---|---|
| svc-queue-1 (Terapevt qabuli) | doc-1 (Toshmatov Jasur) | Terapevt |
| svc-queue-2 (Kardiolog qabuli) | doc-2 (Yusupova Dilnoza) | Kardiolog |
| cmoik6xo70001jy04xgvdywo2 (Ortopedga kvota) | — bo'sh — | Ortoped yo'q hozir |
| svc-diag-1 (Qon tahlili) | — bo'sh — | Lab xizmati, shifokorsiz |
| svc-diag-2 (EKG) | doc-2 (Yusupova Dilnoza) | Kardiolog tahlili |
| svc-home-1 (Uyda bemor ko'rish) | doc-1, doc-2 | Terapevt + Kardiolog ham uy ko'rinishi mumkin |

Logika: 
- prisma.serviceDoctor.upsert ishlat — agar yozuv mavjud bo'lsa, dublikat yaratmaslik
- Composite primary key: serviceId_doctorId
- Xato bo'lsa to'xtamasdan davom etish (try/catch har bog'lanish uchun)

#### 3. Service'larga requiresPrePayment yoqish

Sizning birinchi rejaga ko'ra: diagnostika va uyga xizmat oldindan to'lanadi.

| Service | requiresPrePayment | prePaymentAmount |
|---|---|---|
| svc-queue-1 (Terapevt qabuli) | false | null |
| svc-queue-2 (Kardiolog qabuli) | false | null |
| cmoik6xo70001jy04xgvdywo2 (Ortopedga kvota) | false | null |
| svc-diag-1 (Qon tahlili) | true | null (=100%, ya'ni 50000 so'm) |
| svc-diag-2 (EKG) | true | null (=100%, ya'ni 60000 so'm) |
| svc-home-1 (Uyda bemor ko'rish) | true | 50000 (deposit, qolgani uyda) |

Eslatma:
- prePaymentAmount = null → service narxining 100% to'lanadi
- prePaymentAmount = 50000 → faqat 50000 so'm deposit, qolgani kassada/uyda

## FAYL STRUKTURASI
### prisma/seed-m2m.ts (yangi fayl)

`typescript
/**
 * One-time seed script for M2M relations and prePayment flags.
 * 
 * Usage: 
 *   npx tsx prisma/seed-m2m.ts
 *   yoki
 *   npm run seed:m2m (agar package.json'ga qo'shilsa)
 * 
 * Idempotent — qayta ishga tushirilishi xavfsiz.
 * - photoUrl: faqat NULL bo'lganlariga yozadi
 * - service_doctors: upsert orqali dublikat yaratmaydi
 * - requiresPrePayment: hozirgi qiymatni override qiladi (admin'ning so'nggi qaroriga ishonadi)
 *   ⚠️ Agar admin allaqachon o'zgartirgan bo'lsa, qayta yozadi! 
 *   Buni oldini olish uchun: NODE_ENV=production'da prePayment'ni o'zgartirmaslik kerak bo'lsa, 
 *   flag yoki user_confirmation qo'shing.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Doctor photo URL'lar
const DOCTOR_PHOTOS: Record<string, string> = {
  'doc-1': 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&h=200&fit=crop',
  'doc-2': 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop',
  'doc-3': 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&h=200&fit=crop',
  'cmok59t3e0001ky047j8riktd': 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=200&h=200&fit=crop',
};

// 2. Service-Doctor bog'lanishlar
const SERVICE_DOCTOR_BINDINGS: Array<{ serviceId: string; doctorId: string }> = [
  { serviceId: 'svc-queue-1', doctorId: 'doc-1' },           // Terapevt qabuli → Toshmatov
  { serviceId: 'svc-queue-2', doctorId: 'doc-2' },           // Kardiolog qabuli → Yusupova
  { serviceId: 'svc-diag-2', doctorId: 'doc-2' },            // EKG → Yusupova
  { serviceId: 'svc-home-1', doctorId: 'doc-1' },            // Uyda bemor ko'rish → Toshmatov
  { serviceId: 'svc-home-1', doctorId: 'doc-2' },            // Uyda bemor ko'rish → Yusupova ham
];

// 3. requiresPrePayment yoqilishi kerak bo'lganlar
const PREPAYMENT_SERVICES: Array<{ id: string; amount: number | null }> = [
  { id: 'svc-diag-1', amount: null },         // Qon tahlili — 100% (50000)
  { id: 'svc-diag-2', amount: null },         // EKG — 100% (60000)
  { id: 'svc-home-1', amount: 50000 },        // Uyda bemor ko'rish — 50000 deposit
];

async function main() {
  console.log('🌱 Starting M2M seed...\n');

  // ===== 1. PHOTO URL'lar =====
  console.log('📸 Step 1: Doctor photos');
  for (const [doctorId, photoUrl] of Object.entries(DOCTOR_PHOTOS)) {
    try {
      const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
      if (!doctor) {
        console.log(`   ⚠️ Doctor ${doctorId} topilmadi — skip`);
        continue;
      }
      if (doctor.photoUrl) {
        console.log(`   → ${doctorId} (${doctor.firstName}) — photo bor, tegmaslik`);
        continue;
      }
      await prisma.doctor.update({
        where: { id: doctorId },
        data: { photoUrl },
      });
      console.log(`   ✓ ${doctorId} (${doctor.firstName} ${doctor.lastName}) — photo qo'shildi`);
    } catch (e) {
      console.error(`   ✗ ${doctorId} xato:`, e);
    }
  }

  // ===== 2. SERVICE-DOCTOR BOG'LANISHLAR =====
  console.log('\n🔗 Step 2: Service-Doctor M2M bindings');
  for (const binding of SERVICE_DOCTOR_BINDINGS) {
    try {
      // Service va Doctor mavjudligini tekshirish
      const [service, doctor] = await Promise.all([
        prisma.service.findUnique({ where: { id: binding.serviceId } }),
        prisma.doctor.findUnique({ where: { id: binding.doctorId } }),
      ]);
      if (!service) {
        console.log(`   ⚠️ Service ${binding.serviceId} topilmadi — skip`);
        continue;
      }
      if (!doctor) {
        console.log(`   ⚠️ Doctor ${binding.doctorId} topilmadi — skip`);
        continue;
      }

      // Upsert
      await prisma.serviceDoctor.upsert({
        where: {
          serviceId_doctorId: {serviceId: binding.serviceId,
            doctorId: binding.doctorId,
          },
        },
        update: {}, // hech narsa o'zgartirmaslik (dublikat oldini olish)
        create: {
          serviceId: binding.serviceId,
          doctorId: binding.doctorId,
        },
      });
      console.log(   ✓ ${service.name} ↔️ ${doctor.firstName} ${doctor.lastName} (${doctor.specialty}));
    } catch (e) {
      console.error(   ✗ ${binding.serviceId}↔️${binding.doctorId} xato:, e);
    }
  }

  // ===== 3. PRE-PAYMENT FLAGS =====
  console.log('\n💰 Step 3: requiresPrePayment flags');
  for (const sp of PREPAYMENT_SERVICES) {
    try {
      const service = await prisma.service.findUnique({ where: { id: sp.id } });
      if (!service) {
        console.log(   ⚠️ Service ${sp.id} topilmadi — skip);
        continue;
      }
      await prisma.service.update({
        where: { id: sp.id },
        data: {
          requiresPrePayment: true,
          prePaymentAmount: sp.amount,
        },
      });
      const amountStr = sp.amount === null 
        ? 100% (${Number(service.price).toLocaleString()} so'm) 
        : ${sp.amount.toLocaleString()} so'm deposit;
      console.log(   ✓ ${service.name} — oldindan to'lov: ${amountStr});
    } catch (e) {
      console.error(   ✗ ${sp.id} xato:, e);
    }
  }

  // ===== YAKUNIY HISOBOT =====
  console.log('\n📊 Final state:');
  const [doctorCount, photoCount, bindingCount, prePaymentCount] = await Promise.all([
    prisma.doctor.count({ where: { isActive: true } }),
    prisma.doctor.count({ where: { isActive: true, photoUrl: { not: null } } }),
    prisma.serviceDoctor.count(),
    prisma.service.count({ where: { isActive: true, requiresPrePayment: true } }),
  ]);
  console.log(   Active doctors: ${doctorCount});
  console.log(   Doctors with photo: ${photoCount}/${doctorCount});
  console.log(   Service-Doctor bindings: ${bindingCount});
  console.log(   Services with prePayment: ${prePaymentCount});

  console.log('\n✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

### `package.json` (mavjud — script qo'shish)

`scripts` bo'limiga qo'shing:
json
{
  "scripts": {
    "seed:m2m": "tsx prisma/seed-m2m.ts"
  }
}

**Agar `tsx` paketga mavjud bo'lmasa:** `npm install -D tsx`

## ISHGA TUSHIRISH

### 1. Avval lokal `.env.local` ni tekshir
`DATABASE_URL` to'g'ri (production yoki dev DB)mi? Bu **production DB**'ga yozadi — ehtiyot bo'l.

### 2. Skript ishlatish
bash
npm run seed:m2m
yoki
bash
npx tsx prisma/seed-m2m.ts

### 3. Kutilgan natija (console output)
🌱 Starting M2M seed...

📸 Step 1: Doctor photos
   ✓ doc-1 (Jasur Toshmatov) — photo qo'shildi
   ✓ doc-2 (Dilnoza Yusupova) — photo qo'shildi
   ✓ doc-3 (Nodir Rahimov) — photo qo'shildi
   ✓ cmok59t3e0001ky047j8riktd (Oqil Sayfiyev) — photo qo'shildi

🔗 Step 2: Service-Doctor M2M bindings
   ✓ Terapevt qabuli ↔️ Jasur Toshmatov (Terapevt)
   ✓ Kardiolog qabuli ↔️ Dilnoza Yusupova (Kardiolog)
   ✓ EKG ↔️ Dilnoza Yusupova (Kardiolog)
   ✓ Uyda bemor ko'rish ↔️ Jasur Toshmatov (Terapevt)
   ✓ Uyda bemor ko'rish ↔️ Dilnoza Yusupova (Kardiolog)

💰 Step 3: requiresPrePayment flags
   ✓ Qon tahlili (umumiy) — oldindan to'lov: 100% (50 000 so'm)
   ✓ EKG — oldindan to'lov: 100% (60 000 so'm)
   ✓ Uyda bemor ko'rish — oldindan to'lov: 50 000 so'm deposit

📊 Final state:
   Active doctors: 4
   Doctors with photo: 4/4
   Service-Doctor bindings: 5
   Services with prePayment: 3

✅ Seed completed successfully!
`

### 4. Production'ga deploy KERAK Ebir martalik scriptscript** — production deploy qilinmaydi. Faqat lokal'da ishga tushiriladi va production DB'ga yoziladi (chunki `DATABASE_URL` production'ga ishora qiladi).

## TEKSHIRUVLAR

### 1. Script ishga tushgandan keyin
- Console output yuqoridagidek bo'ladi
- Hech qanday qizil error chiqmasligi kerak
### 2. Production sayt'ida test
- https://tibtaqvim.vercel.app/admin/doctors — har shifokorda foto ko'rinadi
- https://tibtaqvim.vercel.app/admin/services — har xizmatda bog'langan shifokorlar va prePayment yoqilgan bo'ladi

### 3. Telegram bot test (asosiy test)

Botingizga /start yuboring va quyidagi flowni sinab ko'ring:

Step 1: /start
Bot ko'rsatadi: xizmatlar ro'yxati (eski format saqlanadi)

Step 2: "Kardiolog qabuli — 120 000 so'm" tanlang
Bot ko'rsatishi kerak: 
  "Shifokorni tanlang"
  [👨‍⚕️ Kardiolog — Yusupova Dilnoza]   ← YANGI QADAM!

Step 3: Shifokor tanlang
Bot photo bilan tasdiq ko'rsatishi mumkin, keyin sana so'raydi

Step 4: Sana → Bron yaratish
appointments.doctorId to'g'ri yoziladi
### 4. DB verifikatsiyasi
-- service_doctors to'lganmi?
SELECT COUNT(*) FROM service_doctors; -- 5 bo'lishi kerak

-- doctors.photoUrl to'lganmi?  
SELECT COUNT(*) FROM doctors WHERE "photoUrl" IS NOT NULL; -- 4 bo'lishi kerak

-- services.requiresPrePayment yoqilganmi?
SELECT COUNT(*) FROM services WHERE "requiresPrePayment" = true; -- 3 bo'lishi kerak
## XAVF-XATARLAR VA EHTIYOT CHORALARI

### A) Eski 76 ta bron tegilmaydi
Bu skript faqat doctors, services, service_doctors jadvallariga yozadi. appointments jadvali TEGILMAYDI. Eski bronlar saqlanadi.

### B) Idempotent — qayta ishga tushirsa zarar yo'q
- photoUrl faqat null bo'lganlarga yoziladi
- serviceDoctor.upsert — dublikat yaratmaydi
- requiresPrePayment — har gal qayta yoziladi (idempotent emas!)
  - Agar admin keyinroq qo'lda o'zgartirsa, va skript qayta ishga tushsa, admin o'zgarishi yo'qoladi
  - Shuning uchun skript bir marta ishlatiladi va keyin o'chiriladi yoki disable qilinadi

### C) RLS bypass
Prisma postgres super-user'dan ulanadi → RLS ni bypass qiladi. Hech qanday muammo bo'lmaydi.

### D) Audit log
service_doctors, doctors, services jadvallarida audit trigger faol — skript ishga tushgach, audit_logs'da yangi yozuvlar paydo bo'ladi (actor: 'system'). Bu kutilgan.

### E) service_doctor Prisma model nomi
Model nomi ServiceDoctor (PascalCase). prisma.serviceDoctor.upsert to'g'ri ishlatilgan.

### F) Photo URL'lar
Unsplash'dan olingan bepul foto'lar. Internet ulanish kerak. Agar shifokorlar bu fotolar bilan rozi bo'lmasa, keyinroq admin panelidan o'zgartirish mumkin.

## YAKUNIY HARAKATLAR

1. ✅ prisma/seed-m2m.ts faylini yarat (yuqoridagi to'liq kod)
2. ✅ package.json ga seed:m2m script qo'sh (ixtiyoriy)
3. ✅ Agar kerak bo'lsa tsx ni install qil: npm install -D tsx
4. ✅ Skriptni ishga tushir: npm run seed:m2m
5. ✅ Console output'da xato yo'qligini tasdiqla
6. ✅ User'ga ayt: "Tayyor! Telegramdan /start bosib sinab ko'ring"
7. ❌ Production'ga deploy QILMA — bu fayl repo'da qoladi lekin runtime'da chaqirilmaydi
8. ⚠️ Commit qil: chore: one-time seed script for M2M test data

## OXIRGI ESLATMA

Bu test ma'lumotlari — production real ishlatuvchilar uchun emas. Asl ishlatishda:
- Admin paneldan o'zining shifokorlarini yaratadi
- Har shifokorga o'z fotosi
- O'z bog'lanishlari

Skript faqat boshlash uchun — keyin admin paneldan o'zgartirish mumkin.

Hozir boshla: prisma/seed-m2m.ts faylini yarat va menga "Tayyor, ishga tushirildi" deb ayt.