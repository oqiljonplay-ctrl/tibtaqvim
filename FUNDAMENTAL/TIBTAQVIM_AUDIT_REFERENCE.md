# TibTaqvim — To'liq Audit Malumotnomasi (GitHub'ga ulanmagan Claude uchun)

> **Yaratildi:** 2026-06-02 | **Versiya:** 1.0  
> **Maqsad:** Audit claudega loyiha haqida hamma narsani bir joyda topib berish.  
> **Qoida:** Bu fayl maxfiy. Production ma'lumotlari mavjud.

---

## QISM 0 — TEZKOR MO'LJAL

| Narsa | Qiymat |
|---|---|
| **Domain** | https://tibtaqvim.vercel.app |
| **Supabase project** | `lxqimithjjabhnldcugc` |
| **Vercel project** | `tibtaqvim` (team: `oqiljonplay-ctrls-projects`) |
| **Bot username** | Token: `8510744887:AAGoBuoGP7GEtXDF4b4zEct6vSQ05do95zM` |
| **DB host** | `aws-0-eu-west-1.pooler.supabase.com` |
| **Timezone** | `Asia/Tashkent` (UTC+5) |
| **Stack** | Next.js 14 + Prisma + Supabase PostgreSQL + Telegram Bot |
| **Deploy** | Vercel (Hobby plan, 10s timeout) |

---

## QISM 1 — BARCHA ROLLAR UCHUN LOGIN PAROLLAR

### 1.1 Seed ma'lumotlari (prisma/seed.ts)

| Rol | Identifikator (telefon) | Parol | User ID | Manba |
|-----|------------------------|-------|---------|-------|
| `super_admin` | `+998999999999` | `super123` | `user-superadmin` | `prisma/seed.ts:107` |
| `clinic_admin` | `+998900000000` | `admin123` | `user-admin` | `prisma/seed.ts:123` |
| `doctor` | `+998901111111` | `doctor123` | `user-doctor` | `prisma/seed.ts:171` |
| `receptionist` | `+998902222222` | `reception123` | `user-reception` | `prisma/seed.ts:193` |
| `patient/user` | Telegram orqali (initData) | Parol yo'q | — | WebApp initData |

> **Login sahifasi:** https://tibtaqvim.vercel.app/login  
> **Login maydoni:** `identifier` — username YOKI telefon raqami (ikkalasi ishlaydi)

### 1.2 Maxfiy kalitlar (Production .env.local dan)

```
DATABASE_URL      = postgresql://postgres.lxqimithjjabhnldcugc:Supabase707@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL        = postgresql://postgres.lxqimithjjabhnldcugc:Supabase707@aws-0-eu-west-1.pooler.supabase.com:5432/postgres

JWT_SECRET        = ab133884088d71feffed2a5fa08aab6bd6284deb283e777c1e968e3348a9876b
NEXTAUTH_SECRET   = 3401295ac344b5ee97e4808b0ca70bf03d2d552fc08176712f9bfcb8bddc835c
CRON_SECRET       = aFF5JkzICj0AGs5qi92aEi3r_m8libsC
SUPERADMIN_KEY    = b92e175c0721623c12d3836ff03236d7

TELEGRAM_BOT_TOKEN           = 8510744887:AAGoBuoGP7GEtXDF4b4zEct6vSQ05do95zM
TELEGRAM_WEBHOOK_SECRET      = 1feb32a36e4ea345c22df7b3f3568b47f4abfa6245232269ba6407fd4c455825

DEFAULT_CLINIC_ID            = clinic-demo
NEXT_PUBLIC_APP_URL          = https://tibtaqvim.vercel.app
NEXT_PUBLIC_WEBAPP_URL       = https://tibtaqvim.vercel.app/webapp
CLINIC_TIMEZONE              = Asia/Tashkent
JWT_EXPIRES_IN               = 24h   (prod); 7d (local)
```

> **Eslatma:** `PAYMENT_ENCRYPTION_KEY` va `NEXT_PUBLIC_CLINIC_ID` production'da set qilinmagan.

### 1.3 SuperAdmin ikkinchi qatlam — sa_key

SuperAdmin `/admin/super` ga kirish uchun 2 narsa kerak:
1. JWT cookie `auth_token` — role=super_admin
2. `sa_key` cookie = `b92e175c0721623c12d3836ff03236d7` (SUPERADMIN_KEY)

**Kirish yo'li:** `/admin/super/auth` sahifasida yuqoridagi kalitni kiritish → cookie o'rnatiladi → `/admin/super` ochiladi.

### 1.4 Payme / Click sozlamalari (hozirgi holat)

```
paymentConfig = null (barcha klinikalarda)
```

Payme va Click konfiguratsiyasi admin paneli → `/admin/super/clinics/[id]` → "To'lov 💳" tabida sozlanadi. **Hali birorta real merchant ulanmagan.** Faqat kod tayyor — API endpoint'lar bor:
- `POST /api/payments/payme` — JSON-RPC (Basic Auth: merchantId:key)
- `POST /api/payments/click` — form-urlencoded (md5 sign)

---

## QISM 2 — ARXITEKTURA XARITASI

### 2.1 Sahifalar xaritasi (app/)

```
/ (redirect → /login yoki rol asosida)
/login                              → Barcha rollar uchun (JWT + cookie)

/admin/super/auth                   → sa_key kiritish sahifasi
/admin/super                        → SuperAdmin dashboard
/admin/super/clinics                → Klinikalar ro'yxati
/admin/super/clinics/[id]           → Clinic Builder (7 tab)
  ├── sozlamalar tab                → ClinicSettings CRUD
  ├── modullar tab                  → ModuleConfig (on/off)
  ├── flaglar tab                   → FeatureFlag (on/off)
  ├── adminlar tab                  → clinic_admin CRUD
  ├── filiallar tab                 → Branch CRUD
  ├── to'lov tab                    → Payme + Click config
  └── audit tab                    → AuditLog ro'yxati
/admin/super/clinics/[id]/edit      → Klinika edit sahifasi
/admin/super/clinics/[id]/branches/[branchId] → Filial detail
/admin/super/ads                    → Reklama kampaniyalari (super_admin)
/admin/super/audit                  → To'liq audit log

/admin                              → clinic_admin/branch_admin dashboard
/admin/doctors                      → Shifokor ro'yxati
/admin/doctors/[id]/edit            → Shifokor tahrirlash (DoctorBlockedDatesManager)
/admin/services                     → Xizmat CRUD
/admin/branches                     → Filial CRUD
/admin/staff                        → Xodim boshqaruvi
/admin/reception                    → Qabulxona view (admin sidebar ichida)
/admin/doctor                       → Shifokor view (admin sidebar ichida)
/admin/broadcast                    → clinic_admin broadcast (kanal + kampaniyalar)
/admin/(panel)/settings             → Klinika sozlamalari (discountPercent va boshq.)

/doctor                             → Doctor panel (standalone, JWT auth)
/doctor/profile                     → Shifokor profil tahrirlash

/reception                          → Reception panel (standalone, JWT auth)

/stats                              → Statistika sahifasi (KPI + grafiklar + DiscountStats)

/webapp                             → Telegram WebApp bosh sahifasi (SDK + JWT'siz)
/webapp/select-clinic               → Klinika tanlash
/webapp/history                     → Bron tarixi (2 tab + filtrlar)
/webapp/clinics                     → Klinikalar ro'yxati (public)
/webapp/clinics/[id]                → Klinika detail + filial tanlash
/webapp/clinics/[id]/branches/[branchId] → To'liq booking flow
/webapp/appointments/[id]/pay       → To'lov UI (Payme + Click)
```

### 2.2 API Endpoint'lar xaritasi

#### PUBLIC (auth yo'q):
```
GET  /api/health                    → DB, webhook, uptime (?verbose=1 bilan ko'proq)
GET  /api/services?clinicId=&date=&branchId= → Xizmatlar (branchId strict filter)
GET  /api/slots?serviceId=&date=    → Bo'sh slot'lar
POST /api/book                      → Bron qilish (bot va webapp uchun)
GET  /api/clinics                   → Klinikalar ro'yxati (public)
GET  /api/clinics/[id]              → Klinika detail
GET  /api/clinics/[id]/branches     → Filiallar
POST /api/webhook/telegram          → Telegram webhook (X-Telegram-Bot-Api-Secret-Token himoyasi)
GET  /api/webapp/appointments       → Bemor bronlari (telegramId, clinicId)
POST /api/webapp/cancel             → Bron bekor qilish (phone check bilan)
PATCH /api/webapp/profile           → Profil yangilash (telegramId bilan)
GET  /api/user/by-telegram          → User by telegramId
GET  /api/user/tib                  → User by phone (tibId qaytaradi)
GET  /api/user/by-tibid             → User by tibId
POST /api/user/register             → Foydalanuvchi yaratish/topish
```

#### JWT AUTH TALAB:
```
POST /api/auth/login                → Login (identifier: phone|username, password)
GET  /api/me/appointments           → Tarix cursor pagination (telegramId + scope)
GET  /api/me/clinics                → User klinikalari + currentClinicId
POST /api/webapp/clinics/[id]/select → Klinikani tanlash + DB'ga saqlash (tgid query)

# Admin (clinic_admin/branch_admin/super_admin)
GET/POST      /api/admin/branches              → Filial CRUD
GET/PATCH/DEL /api/admin/branches/[id]
GET/POST      /api/admin/doctors               → Shifokor CRUD
PATCH/DEL     /api/admin/doctors/[id]
GET/PUT       /api/admin/doctors/[id]/profile  → Shifokor profil
GET/POST      /api/admin/services              → Xizmat CRUD
PATCH/DEL     /api/admin/services/[id]
GET/POST      /api/admin/staff                 → Xodim CRUD
PATCH/DEL     /api/admin/staff/[id]
GET           /api/admin/stats                 → Bugungi statistika (KPI)
GET           /api/admin/stats/discount        → X/Y/Z chegirma statistika
GET           /api/admin/clinic-settings       → Klinika sozlamalari (receptionist ham o'qiy oladi)
PUT           /api/admin/clinic-settings       → Klinika sozlamalari yangilash
GET           /api/appointments                → Qabulxona uchun bronlar

# SuperAdmin
GET/POST      /api/admin/super/clinics         → Klinika CRUD
GET/PATCH/DEL /api/admin/super/clinics/[id]
GET/PUT       /api/admin/super/clinics/[id]/settings
GET/PUT       /api/admin/super/clinics/[id]/modules
GET/PUT       /api/admin/super/clinics/[id]/features
GET/POST      /api/admin/super/clinics/[id]/admins         → clinic_admin CRUD
PATCH/DEL     /api/admin/super/clinics/[id]/admins/[adminId]
GET           /api/admin/super/clinics/[id]/branches        → Filiallar (super_admin)
GET/PATCH/DEL /api/admin/super/clinics/[id]/branches/[branchId]
GET/POST      /api/admin/super/clinics/[id]/branches/[branchId]/admins
GET/PATCH/DEL /api/admin/super/clinics/[id]/branches/[branchId]/admins/[adminId]
GET/PATCH     /api/admin/clinics/[id]/payment-config        → Payme + Click config

# Reception
GET  /api/reception/appointments            → Qabulxona bronlari (2 bo'lim: pending+paid)
PATCH /api/reception/appointments/[id]/payment → To'lov (mode: full|discount)

# Doctor
GET  /api/doctor/appointments               → Shifokor bronlari (faqat paid)
PATCH /api/doctor/appointments/[id]/attendance → arrived/missed/reset
GET/PUT /api/doctor/profile                 → Shifokor o'z profili

# Doctor schedule (public)
GET /api/doctors/[id]/schedule              → blokedDates + blockedWeekdays
GET/POST /api/doctors/[id]/blocked-dates    → Bloklangan kunlar (3 rol auth)
DEL /api/doctors/[id]/blocked-dates/[blockId]

# Patient doctor profile (public)
GET /api/patient/doctor/[id]/profile        → Shifokor public profil

# Appointments
GET /api/appointments/[id]/payment-info     → providers + amount

# Payments
POST /api/payments/payme                    → JSON-RPC (Basic Auth)
POST /api/payments/payme/create-link        → Checkout URL
POST /api/payments/click                    → form-urlencoded
POST /api/payments/click/create-link        → Checkout URL

# Cron
GET  /api/reminders                         → Eslatmalar (Authorization: Bearer CRON_SECRET)
GET  /api/cron/ad-broadcast                 → Reklama broadcast (CRON_SECRET)
GET  /api/cron/expire-bookings              → Muddati o'tgan bronlar (CRON_SECRET)

# Ads
GET/POST      /api/admin/ad-channels        → Kanal CRUD
GET/PATCH/DEL /api/admin/ad-channels/[id]
GET/POST      /api/admin/ad-campaigns       → Kampaniya CRUD
POST          /api/admin/ad-campaigns/[id]/send-now → Darhol yuborish

# Arrived (eski)
POST /api/arrived                           → Keldi belgisi (eski, saqlanib qolgan)
```

#### MIDDLEWARE QOIDALARI (`src/middleware.ts`):

```
PUBLIC (middleware o'tadi):
  /, /login, /webapp/*, /api/*
  /api/services, /api/book, /api/slots, /api/webhook, /api/clinics

HIMOYALANGAN (JWT cookie "auth_token" kerak):
  /admin/*       → super_admin | clinic_admin | branch_admin
  /admin/super/* → super_admin + sa_key cookie (SUPERADMIN_KEY)
  /doctor/*      → doctor | clinic_admin | branch_admin | super_admin
  /reception/*   → receptionist | clinic_admin | branch_admin | super_admin
  /stats/*       → super_admin | clinic_admin | branch_admin | doctor

DIQQAT: /api/* middleware'da tekshirilmaydi! API route'lar o'z ichida requireAuth() chaqiradi.
```

### 2.3 Rol → Ruxsat Matritsasi (RBAC)

| Sahifa/Funksiya | super_admin | clinic_admin | branch_admin | doctor | receptionist | patient |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| /admin/super/* | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| /admin/* (panel) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| /admin/reception | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| /admin/doctor | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| /admin/super/ads | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| /admin/broadcast | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| /doctor (standalone) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| /reception (standalone) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| /stats | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| /webapp/* | Hamma (JWT yo'q, telegramId orqali) | | | | | |
| API /api/admin/* | ✅ | ✅ | ✅ (scope limited) | ❌ | ❌ | ❌ |
| API /api/doctor/* | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| API /api/reception/* | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| API /api/admin/super/* | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## QISM 3 — DATABASE JADVALLARI (28 ta jadval)

### 3.1 Jadvallar inventari

| Jadval | Prisma modeli | Maqsad |
|--------|--------------|--------|
| `clinics` | `Clinic` | Klinikalar |
| `branches` | `Branch` | Filiallar |
| `services` | `Service` | Xizmatlar (doctor_queue/diagnostic/home_service) |
| `doctors` | `Doctor` | Shifokorlar |
| `doctor_blocked_dates` | `DoctorBlockedDate` | Shifokor bloklangan kunlar |
| `doctor_specialties` | `DoctorSpecialty` | Shifokor mutaxassisliklar |
| `doctor_directions` | `DoctorDirection` | Qabul yo'nalishlari |
| `doctor_experiences` | `DoctorExperience` | Ish tajribasi |
| `doctor_workplaces` | `DoctorWorkplace` | Ish joylari |
| `service_doctors` | `ServiceDoctor` | Service↔Doctor M2M + queueMode |
| `staff` | `Staff` | Xodimlar (receptionist va boshqalar) |
| `users` | `User` | Barcha foydalanuvchilar (barcha rol) |
| `dependents` | `Dependent` | Bemor qaramog'idagilar |
| `user_clinics` | `UserClinic` | User↔Clinic M2M + isCurrent |
| `appointments` | `Appointment` | Bronlar (asosiy jadval) |
| `slots` | `Slot` | Diagnostika uyachalari |
| `clinic_settings` | `ClinicSettings` | Klinika sozlamalari (discountPercent va boshq.) |
| `feature_flags` | `FeatureFlag` | Feature flag'lar |
| `module_configs` | `ModuleConfig` | Modul on/off |
| `audit_logs` | `AuditLog` | Audit logi |
| `telegram_id_history` | `TelegramIdHistory` | Telegram ID o'zgarish tarixi |
| `bot_states` | `BotState` | Bot state (DB-backed, 30 min TTL) |
| `telegram_relay_log` | `TelegramRelayLog` | Xodim→Bemor xabar logi |
| `payments` | `Payment` | To'lovlar (Payme/Click) |
| `refunds` | `Refund` | Qaytarishlar |
| `ad_channels` | `AdChannel` | Reklama kanallar |
| `ad_campaigns` | `AdCampaign` | Reklama kampaniyalar |
| `ad_campaign_channels` | `AdCampaignChannel` | Kampaniya↔Kanal M2M |
| `ad_posts` | `AdPost` | Yuborilgan postlar |
| `clinic_promotions` | `ClinicPromotion` | Klinika promotsiyalar |

### 3.2 Muhim ustunlar va constraints

#### `appointments` jadvali:
```sql
paymentStatus: 'pending' | 'paid' | 'not_required' | 'cancelled'  -- CHECK constraint
status: 'booked' | 'arrived' | 'missed' | 'cancelled' | 'expired'
queueMode: 'live' | 'online' | 'slot'
paidAmount: Integer nullable  -- haqiqatan to'langan so'm
appliedDiscountPercent: Integer @default(0)  -- muzlatilgan foiz
paidAt: DateTime?

-- Indexes:
[clinicId], [clinicId,date], [doctorId,date], [serviceId,date]
[userId,clinicId,status], [dependentId,clinicId,status]
[liveStatus,liveExpiresAt] -- live location tracking
```

#### `user_clinics` jadvali:
```sql
UNIQUE(userId, clinicId)
isCurrent: Boolean @default(false)  -- DB kafolat: UNIQUE INDEX WHERE isCurrent=true
lastSelectedAt: DateTime?
```

#### `clinic_settings` jadvali:
```sql
dailyLimit: Int @default(40)
patientSelfLimit: Int @default(4)
dependentBookingLimit: Int @default(1)
maxDependents: Int @default(2)
discountPercent: Int @default(0)   -- CHECK 0-100
holidays: JsonB @default("[]")
is24Hours: Boolean @default(false)
bookingWindowDays: Int @default(7)
```

#### `doctor_blocked_dates` jadvali:
```sql
type: 'recurring' | 'once'
weekday: Int? (0-6, 0=Yakshanba)  -- recurring uchun
date: String? ('YYYY-MM-DD')       -- once uchun
-- CHECK: recurring→weekday MAJBURIY, once→date MAJBURIY
```

### 3.3 Kritik FK munosabatlar

```
Clinic → Branch (CASCADE)
Clinic → Service (CASCADE)
Clinic → Doctor (CASCADE)
Clinic → Staff (CASCADE)
Clinic → Appointment (CASCADE)
Clinic → Slot (CASCADE)

Branch → Service (SetNull)    -- xizmat bog'lanmasa null
Branch → Doctor (restriction yo'q)
Branch → Appointment
Branch → Slot

Doctor → DoctorBlockedDate (CASCADE)
Doctor → DoctorSpecialty (CASCADE)
Doctor → DoctorDirection (CASCADE)
Doctor → DoctorExperience (CASCADE)
Doctor → DoctorWorkplace (CASCADE)

Appointment → Payment (Restrict)  -- to'lov bor bronni o'chirish mumkin emas
```

### 3.4 RLS holati

> **Diqqat:** Supabase RLS yoqilgan, lekin barcha jadvallar uchun policy'lar to'liq yozilmagan (Phase 0 da 15 ta jadvalda `rls_enabled_no_policy` holatda qoldirilgan).

Prisma `service_role` kaliti bilan ishlagani uchun RLS bypass qilinadi — hozir xavfsiz. Lekin frontend'dan to'g'ridan PostgREST orqali urinish bo'lsa xavfli.

---

## QISM 4 — BRON OQIMI (TO'LIQ TEXNIK)

### 4.1 processBooking() asosiy mantiq (`src/lib/services/booking.service.ts`)

```
INPUT: {clinicId, serviceId, doctorId?, slotId?, date, patientName, patientPhone, address?, userId?, dependentId?, source?}

1. Smart fill: dependentId→ dep.name/phone; userId→ user.name/phone (agar inputda bo'lmasa)
2. Service topish: clinicId + serviceId + isActive=true (404 bo'lmasa)
3. ModuleConfig: xizmat turi yoqilgan/o'chirilganini tekshirish (403 bo'lsa)
4. bookingDate = new Date(date + "T00:00:00.000Z")  ← UTC midnight (muhim!)
5. isDateBlockedFull(clinicId, doctorId, date) → 409 DOCTOR_BLOCKED yoki DATE_BLOCKED
6. Limit tekshiruvi (faqat userId bo'lsa):
   - patientSelfLimit (default 4): booked holat bronlar soni
   - dependentBookingLimit (default 1): qaramog'idagi uchun
   - Bir shifokorga faqat bitta faol bron (butun kalendar, status=booked)
7. queueMode aniqlash: ServiceDoctor.queueMode → service.defaultQueueMode → 'online'
8. Xizmat turiga qarab dispatch:
   - doctor_queue → bookDoctorQueue()
   - diagnostic → bookDiagnostic()
   - home_service → bookHomeService()
9. Muvaffaqiyat bo'lsa:
   - linkUserToAppointment() — fire-and-forget (userId bog'laydi)
   - source !== 'bot' bo'lsa notifyPatientAsync() — fire-and-forget
   - resolveTibId() — qaytaradi

MUHIM qoidalar:
- bookingDate UTC midnight → @db.Date bilan to'g'ri mos keladi
- Barcha bron $transaction ichida (limit + create ATOMIK)
- duplicate check: serviceId + patientPhone + date (status != cancelled)
- doctor_duplicate check: patientPhone + doctorId + date (status in booked/arrived)
```

### 4.2 bookDoctorQueue() — queueMode bo'yicha farqlar

| queueMode | queueNumber | paymentStatus |
|-----------|-------------|---------------|
| `live` | null (kassada beriladi) | `pending` |
| `online` | joriy max+1 | `pending` |
| `slot` | 400 xato (disabled) | — |

### 4.3 Slot to'liq bormi tekshiruvi (bookDiagnostic)

```
requiresSlot=true && slotId berilmasa → SLOT_REQUIRED (400)
slot.isActive=false → SLOT_INVALID (400)
appointments.count(slotId, status!=cancelled) >= slot.capacity → SLOT_FULL (409)
```

### 4.4 Bron holat mashina

```
BOOKED → (qabulxona "To'ladi") → ARRIVED (paymentStatus=paid)
BOOKED → (qabulxona "Bekor")  → CANCELLED
BOOKED → (expire cron 19:00 UTC) → EXPIRED
ARRIVED → (shifokor "Keldi")   → ARRIVED (status o'zgarmaydi, doctor ishlaydi)
ARRIVED → (shifokor "Kelmadi") → MISSED
ARRIVED → (shifokor "Reset")   → ARRIVED (reset, arrived saqlanadi)
```

### 4.5 To'lov oqimi (Qabulxona)

```
reception/appointments → 2 bo'lim:
  PENDING: paymentStatus=pending bronlar (To'lov kutilmoqda)
  PAID:    paymentStatus=paid bronlar (To'langan)

"💰 To'ladi" (mode=full):
  paidAmount = Math.round(service.price * 100) / 100
  appliedDiscountPercent = 0
  paymentStatus = 'paid'

"X so'm to'ladi" (mode=discount):
  discountPercent = clinic_settings.discountPercent
  paidAmount = Math.round(service.price * (1 - discount/100))
  appliedDiscountPercent = discountPercent
  paymentStatus = 'paid'

"Bekor" → status=cancelled

100% chegirmada "Qaytarish" YO'Q (UI + server blok)
```

---

## QISM 5 — TELEGRAM BOT ARXITEKTURASI

### 5.1 Webhook vs Polling

```
LOCAL:       bot/index.ts → polling (npm run bot)
PRODUCTION:  src/app/api/webhook/telegram/route.ts → webhook

Webhook URL: https://tibtaqvim.vercel.app/api/webhook/telegram
Himoya: X-Telegram-Bot-Api-Secret-Token: 1feb32a36e4ea345c22df7b3f3568b47f4abfa6245232269ba6407fd4c455825

Webhook register:
  GET https://api.telegram.org/bot{TOKEN}/setWebhook?url={URL}&secret_token={SECRET}
```

### 5.2 Bot State Machine

```
State saqlash: DB (bot_states jadvali, TTL 30 min)
Qadamlar:
  1. select_clinic → (1 ta bo'lsa auto-skip)
  2. select_branch → (1 ta bo'lsa auto-skip)
  3. select_service
  4. select_date → (doctor blok + klinika blok tekshiruvi)
  5. select_doctor_or_slot → (doctor tanlash yoki slot tanlash)
  6. enter_name
  7. enter_phone
  8. enter_address (faqat home_service uchun)
  9. confirm → /api/book POST

UI: editMessageText (bitta xabar yangilanadi, yangi xabar emas)
Cache: _services, _doctors, _slots, _nameBack — orqaga qaytganda qayta fetch yo'q
```

### 5.3 Bot Handler'lar

```
bot/handlers/start.ts     → /start komandasi
bot/handlers/callback.ts  → Inline keyboard callback (svc:, date:, doc:, slot:, confirm va boshq.)
bot/handlers/message.ts   → Matn kiritish (ism, telefon, manzil)
bot/handlers/clinicFlow.ts → Klinika/filial tanlash oqimi
bot/handlers/myChatMember.ts → Bot kanalga admin bo'lganda kanal ro'yxatga olish
bot/handlers/editedMessage.ts → Tahrirlangan xabar (ignore)
bot/helpers/render.ts     → Tugmalar va keyboard builder'lar
bot/helpers/calendar.ts   → Sana tanlash kalendariyasi
bot/api.ts                → API client (fetchServices, bookAppointment, fetchTibId)
```

### 5.4 WebApp integratsiya

```
WebApp URL: https://tibtaqvim.vercel.app/webapp
Bot button: InlineKeyboardButton (web_app: { url: webAppUrl(chatId) })
URL format: /webapp?clinicId=<id>&tgid=<chatId>

Identity aniqlash (webapp/page.tsx):
1. window.Telegram.WebApp.initDataUnsafe.user.id (SDK)
2. URL ?tgid= param (SDK bo'lmasa fallback)
3. Hech biri yo'q → booking flow (brauzerda to'g'ri kirgan)

initData validation: /api/webhook/telegram da TELEGRAM_WEBHOOK_SECRET bilan
(WebApp initData validatsiyasi hozir to'liq amalga oshirilmagan — muammo!)
```

---

## QISM 6 — CRON JOB'LAR

| Path | Schedule | Vaqt (UTC) | Toshkent vaqti | Maqsad |
|------|----------|-----------|----------------|--------|
| `/api/reminders?type=day_before` | `0 3 * * *` | 03:00 | 08:00 | Ertangi bronlar uchun eslatma |
| `/api/cron/ad-broadcast` | `0 8 * * *` | 08:00 | 13:00 | Kunlik reklama broadcast |
| `/api/cron/expire-bookings` | `0 19 * * *` | 19:00 | 00:00 (+1) | Kunlik `booked` bronlarni `expired` qilish |

**Manual test:**
```bash
curl -X GET "https://tibtaqvim.vercel.app/api/reminders?type=day_before" \
  -H "Authorization: Bearer aFF5JkzICj0AGs5qi92aEi3r_m8libsC"
```

**Reminder idempotency:** `notifiedDayBefore` va `notifiedTwoHours` flag'lari — ikki marta yuborilmaydi.

---

## QISM 7 — XAVFSIZLIK ARXITEKTURASI

### 7.1 Auth tizimi

```
Cookie nomi: auth_token
Format: JWT (jsonwebtoken)
Muddati: 24h (production), 7d (local)
Payload: { userId, clinicId, branchId, role }
Algoritm: HS256 (JWT_SECRET bilan)

Cookie sozlamalari (src/app/api/auth/login/route.ts):
  HttpOnly: ✅
  Secure: production'da ✅
  SameSite: Lax
  Path: /
  maxAge: 24*60*60 sekund
```

### 7.2 Middleware xavfsizlik qatlamlari

```
1. JWT cookie tekshiruvi (verifyTokenEdge - Edge runtime)
2. Rol tekshiruvi (ROLE_PATHS ob'ekti)
3. SuperAdmin sa_key cookie tekshiruvi (ikkinchi qatlam)
4. API route'lar o'z ichida requireAuth() chaqiradi
```

### 7.3 Rate Limiting

```
Amalga oshirilgan: src/lib/rate-limit.ts (In-memory Map)
Limitlar:
  POST /api/book:        10 req/min/IP
  POST /api/auth/login:   5 req/min/IP
  GET  /api/reminders:   10 req/min/IP

DIQQAT: Vercel serverless'da har invocation'da yangi instance.
Map saqlanmaydi. Rate limiting haqiqiy traffic'da ishlamaydi!
Redis kerak.
```

### 7.4 Telegram Webhook himoyasi

```
TELEGRAM_WEBHOOK_SECRET header tekshiruvi:
  X-Telegram-Bot-Api-Secret-Token: 1feb32a36e4ea345c22df7b3f3568b47f4abfa6245232269ba6407fd4c455825
  
Agar secret yo'q → 401 Unauthorized
Agar secret xato → 401 Unauthorized
```

### 7.5 Payme Basic Auth

```
Endpoint: POST /api/payments/payme
Auth: Basic base64(merchantId:secretKey)
Constant-time comparison: ✅ (timing attack xavfsiz)
```

### 7.6 Click Signature

```
Prepare sign: md5(click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time)
Complete sign: md5(click_trans_id + service_id + secret_key + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
Constant-time comparison: ✅
```

### 7.7 Aniqlanmagan xavfsizlik muammolari

> Bu yerda AUDIT CLAUDE tomonidan to'ldiriladigan joy.

**MUHIM TEKSHIRISH KERAK BO'LGAN JOYLAR:**

1. **WebApp initData validatsiya:** `/api/webapp/appointments` va `/api/webapp/cancel` — `telegramId` faqat query param sifatida keladi. Soxta telegramId bilan boshqa bemorning bronlarini ko'rib bo'ladimi?
2. **IDOR risk:** `/api/appointments/[id]/payment-info` — boshqa clinicning appointment ID'sini bilsa narxini ko'rib bo'ladimi?
3. **clinicId scope check:** Barcha admin API'larida `getBranchScope()` ishlatilganmi? Qaysi endpoint'lar tekshiruvni o'tkazib yuborgan?
4. **service_role Supabase kaliti:** Frontend bundle'ga sizib chiqmagan?
5. **JWT expiry check:** 24h cookie muddati to'g'ri check qilinganmi?
6. **RLS enabled_no_policy jadvallari:** Supabase anon kalit bilan qanchasiga kirsa bo'ladi?

---

## QISM 8 — STATISTIKA VA DAROMAD HISOBI

### 8.1 Daromad hisob formulasi (`src/lib/stats/queries.ts`)

```typescript
// Bu oy daromadi:
WHERE status = 'arrived' AND paymentStatus = 'paid'
  AND paidAt >= ayBoshi AND paidAt <= ayOxiri
SUM(COALESCE(paidAmount, service.price))

// Kunlik daromad:
paidAmount = null → service.price ishlatiladi (eski bronlar uchun backward compat)
```

### 8.2 X/Y/Z chegirma statistika (`/api/admin/stats/discount`)

```
X = to'liq narxda to'lagan (appliedDiscountPercent = 0 AND paymentStatus = paid)
Y = chegirma bilan to'lagan (appliedDiscountPercent > 0 AND paymentStatus = paid)
Z = hali to'lamagan (paymentStatus = pending)

paidAmount muzlatilgan qiymat — hozirgi discountPercent o'zgarganda xistoriya o'zgarmaydi
```

---

## QISM 9 — FLIP CARD ARXITEKTURASI

### 9.1 BookingFlipCard komponenti (`src/components/webapp/BookingFlipCard.tsx`)

```
Old yuz (front): onClick={() => setFlipped(true)} — butun karta bosilganda flip
Orqa yuz (back): onClick={() => setFlipped(false)} — butun karta bosilganda yopiladi

Amal tugmalari: e.stopPropagation() — flip OLMAYDI

CSS:
  wrapper: perspective: 1000px
  inner: transform-style: preserve-3d; transition: 0.55s
  flipped: rotateY(180deg)
  front: backface-visibility: hidden
  back: backface-visibility: hidden; rotateY(180deg)

Old yuz: relative (oqimda, balandlik belgilaydi)
Orqa yuz: absolute inset-0 overflow-y-auto (skroll qilish mumkin)
```

### 9.2 Shifokor profil ma'lumotlari (orqa yuz)

```
doctors.education      → Ta'lim
doctors.position       → Lavozim
doctors.department     → Bo'lim
doctors.workSchedule   → Ish grafigi
doctors.operationsCount → Operatsiyalar soni
doctors.bio            → Biografiya (Text)
doctor_specialties     → Mutaxassisliklar (chip/tag)
doctor_directions      → Yo'nalishlar (chip/tag)
doctor_experiences     → Tajriba (place, startYear–endYear)
doctor_workplaces      → Ish joylari
```

---

## QISM 10 — BROADCAST TIZIMI

### 10.1 Kanal turlari

```
scope=clinic:    Bir klinikaga tegishli kanal (clinic_admin qo'sha oladi, lekin isActive=false)
scope=platform:  Platforma miqyosidagi kanal (faqat super_admin boshqaradi)
```

### 10.2 Kampaniya → Kanal moslashuvi

```
targetType=own:      faqat scope=clinic + clinicId=o'sha klinika kanallar
targetType=platform: faqat scope=platform kanallar

"Hozir Yuborish" tugmasi: POST /api/admin/ad-campaigns/[id]/send-now
Cron: kuniga bir marta 08:00 UTC (13:00 Toshkent)
```

### 10.3 clinic_admin kanal qo'shish oqimi

```
1. clinic_admin Broadcast sahifasida "Kanal ulash" → kanal username kiritadi
2. API POST /api/admin/ad-channels (scope=clinic, isActive=false)
3. super_admin Reklamalar → Kanallar → "Tahrir" → isActive=true qiladi
4. Kampaniyaga kanallar biriktiriladi → broadcast ishlaydi
```

---

## QISM 11 — SHIFOKOR BLOKLANGAN KUNLAR

### 11.1 isDateBlockedFull() logikasi (`src/lib/day-block.ts`)

```typescript
// Ikkala blokni tekshiradi:
async isDateBlockedFull(clinicId, doctorId, dateStr):
  1. isDateBlockedForClinic(clinicId, dateStr)   → klinika bloki
  2. isDateBlockedForDoctor(doctorId, dateStr)    → shifokor bloki

isDateBlockedForDoctor(doctorId, dateStr):
  weekday = dayOfWeek(dateStr)  // 0-6
  recurring: doctor_blocked_dates WHERE type='recurring' AND weekday=weekday
  once:      doctor_blocked_dates WHERE type='once' AND date=dateStr
```

### 11.2 Kim bloklaydi

```
shifokor o'zi: /doctor sahifasida "Bloklangan kunlar" collapsible
qabulxona:     /reception sahifasida Doctor dropdown + DoctorBlockedDatesManager
admin:         /admin/doctors/[id]/edit sahifasida DoctorBlockedDatesManager
```

---

## QISM 12 — MULTI-CLINIC VA BRANCH ISOLATION

### 12.1 Branch Scope (`src/lib/branch-scope.ts`)

```typescript
getBranchScope(auth, explicitClinicId?):
  super_admin → {}  (hamma ko'radi, clinicId filteri yo'q)
  clinic_admin → { clinicId: auth.clinicId, branchId: null }
  branch_admin → { clinicId: auth.clinicId, branchId: auth.branchId }

// Bu scope barcha DB so'rovlarda ishlatilishi SHART
// resolveBranchIdForCreate(), canCreate*(), canManageResources()
```

### 12.2 Service ↔ Branch bog'liq qoidasi

```
branchId=NULL:   bosh ofis xizmati (clinic_admin ko'radi, bot KO'RSMAYDI)
branchId=X:      aniq filial xizmati (bot FAQAT shu filialda ko'radi)
/api/services?branchId=X → faqat o'sha filialning xizmatlari
```

### 12.3 Klinikalararo izolyatsiya tekshiruvi

```
Kutilgan: A klinika admin B klinikaning ma'lumotini KO'RA OLMASLIGI kerak.
Amalga oshirilgan: Middleware emas, API level'da getBranchScope() orqali.
IDOR riski: appointmentId to'g'ridan urlga kiritilsa clinicId tekshirilganmi? — TEKSHIRISH KERAK
```

---

## QISM 13 — VERSIYA VA COMMIT TARIXI

### 13.1 Eng so'nggi commit'lar (2026-05)

| Commit | Sana | Vazifa |
|--------|------|--------|
| `925b371` | 2026-06 | daromad mantig'i — paidAt, range filtr |
| `94948db` | 2026-06 | queueMode radio name collision, payment placeholder |
| `ab5ccda` | 2026-06 | settings input — erkin tahrirlash |
| `9ebb3b9` | 2026-06 | expire-bookings backup reminder cron |
| `02a7f68` | 2026-06 | webapp counter DBdan, discountPercent migration, eski bronlar expired |
| `feat/discount-system` | 2026-06-01 | Chegirma tizimi: Qabulxona 3 tugma |
| `fix/admin-sidebar-nav` | 2026-05-31 | Sidebar /reception /doctor bug fix |
| `feature/doctor-blocked-dates` | 2026-05-31 | Shifokor kun bloki |
| Broadcast tizim | 2026-05-29 | Kanal/kampaniya broadcast |
| FLIP-CARD-01/02/03 | 2026-05-28 | 3D flip card |
| SERVICE-PICKER-01 | 2026-05-28 | Yagona xizmat tanlash komponenti |
| CLINIC-CURRENT-01/02 | 2026-05-28 | Klinika DB'da saqlanishi |
| Sprint 1/2/3 (To'lov) | 2026-05-19 | Payme + Click poydevor |

---

## QISM 14 — PERFORMANS MUAMMOLARI (MA'LUM)

### 14.1 Sekin sahifalar sababi

```
1. /api/webapp/appointments — doctor select ichida profil maydonlar qo'shilgan:
   doctor: { select: { firstName, lastName, specialty, photoUrl,
             education, position, department, workSchedule, operationsCount, bio,
             specialties: true, directions: true, experiences: true, workplaces: true } }
   → Har shifokor uchun 4 ta qo'shimcha join yoki N+1 bo'lishi mumkin!

2. Prisma cold start — Vercel serverless, har request'da potential cold start
3. pgBouncer transaction mode — ba'zi so'rovlar "prepared statement does not exist" berishi mumkin
4. DB connection pool — ?pgbouncer=true bor (to'g'ri)
```

### 14.2 Optimizatsiya takliflari (hali amalga oshirilmagan)

```
- appointments + doctor profil: bitta JOIN bilan olish (allaqachon select'da, lekin JOIN samaradorligi?)
- EXPLAIN ANALYZE: sekin query'larni topish
- Redis: rate limiting va bot state uchun (hozir in-memory Map → production'da ishlamaydi)
- Edge caching: /api/clinics va /api/services static ma'lumotlar uchun
```

---

## QISM 15 — QO'LDA TEKSHIRISH KERAK BO'LGAN NARSALAR

### 15.1 Men (Claude) tekshira OLMAYDIGAN narsalar:

1. **Real Payme to'lov:** Sandbox merchant kabineti ulanmagan — haqiqiy to'lov oqimi sinovdan o'tmagan
2. **Real Click to'lov:** Xuddi shunday — callback URL'lar production'da ishlaydi?
3. **Telegram WebApp real qurilmada:** initData validatsiya mexanizmi — soxta initData bilan kirish
4. **Vercel Cron real ishlashi:** Vercel Hobby plan'da 1 ta cron allowed
5. **Supabase Storage:** `appointment-results` bucket yaratilmagan (Uy xizmati natijalari hali qilinmagan)
6. **Real Telegram kanal broadcast:** Ad kanal admin permission real ishlaydi?

### 15.2 Sizdan kerak bo'lgan kirishlar:

| Resurs | URL/Yo'l | Nima tekshirish |
|--------|---------|-----------------|
| Supabase Dashboard | supabase.com/dashboard/project/lxqimithjjabhnldcugc | RLS policies, jadval tuzilmalari |
| Vercel Dashboard | vercel.com/oqiljonplay-ctrls-projects/tibtaqvim | Cron jobs, env vars, deploy logs |
| Telegram BotFather | @BotFather | Webhook holati |
| Payme Merchant | merchant.payme.uz | Sandbox merchant sozlamalar |
| Click Merchant | my.click.uz | Merchant kabineti |

### 15.3 Tekshirish komandalar (local terminal):

```bash
# DB holati
npx prisma db pull  # Schema sinxron?
npx prisma migrate status  # Qolmagan migration bormi?

# Build tekshiruvi
npx tsc --noEmit     # TypeScript xatolar
npm run build        # Next.js build

# Health check
curl https://tibtaqvim.vercel.app/api/health
curl https://tibtaqvim.vercel.app/api/health?verbose=1

# Webhook holati
curl "https://api.telegram.org/bot8510744887:AAGoBuoGP7GEtXDF4b4zEct6vSQ05do95zM/getWebhookInfo"

# Cron test
curl -H "Authorization: Bearer aFF5JkzICj0AGs5qi92aEi3r_m8libsC" \
  "https://tibtaqvim.vercel.app/api/reminders?type=day_before"
```

---

## QISM 16 — KEYINGI REJALAR (AMALGA OSHIRILMAGAN)

| # | Vazifa | Ustuvorlik | Holat |
|---|--------|-----------|-------|
| 1 | Click merchant config + sandbox test | ⭐⭐ | Kutilmoqda |
| 2 | Uy xizmati natijalari (upload+PDF) | ⭐⭐ | Kutilmoqda |
| 3 | Doctor /stats 3 ta grafik | ⭐ | Kutilmoqda |
| 4 | Slot tizimi bosqich 2 (aniq vaqt slot) | ⭐ | Kutilmoqda |
| 5 | Multi-clinic Bosqich 2 (ratings) | ⭐ | Kutilmoqda |
| 6 | Redis: rate limiting + bot state | ⭐⭐⭐ | Kutilmoqda |
| 7 | PAYMENT_ENCRYPTION_KEY: real AES-256-GCM | ⭐⭐ | Kutilmoqda |
| 8 | RLS Policy Pack (15 ta jadval) | ⭐⭐ | Kutilmoqda |

---

## QISM 17 — FAYL INVENTARI (MUHIM FAYLLAR)

### 17.1 Asosiy funksional fayllar

```
prisma/schema.prisma                          # DB schema (barcha 28+ jadval)
prisma/seed.ts                                # Test ma'lumotlari + parollar
src/middleware.ts                             # Route himoyasi + rol tekshiruvi
src/lib/auth.ts                               # JWT sign/verify, bcrypt, password utils
src/lib/auth-edge.ts                          # Edge runtime uchun JWT verify
src/lib/prisma.ts                             # Singleton PrismaClient + withRetry
src/lib/services/booking.service.ts          # Bron asosiy mantiq (processBooking)
src/lib/services/reminder.service.ts         # Eslatma yuborish
src/lib/services/tib-id.service.ts           # tibId assign/lookup
src/lib/services/confirmation.service.ts     # Bron tasdiq xabari
src/lib/workflow/appointment-workflow.ts     # markAsPaid, markAsArrived, markAsMissed
src/lib/branch-scope.ts                      # Multi-clinic scope resolver
src/lib/day-block.ts                         # Klinika + shifokor blok tekshiruvi
src/lib/utils/phone.ts                       # normalizePhone()
src/lib/utils/date.ts                        # getTodayInTZ(), getTodayRange()
src/lib/calendar.ts                          # generateCalendarMatrix()
src/lib/clinic-context.tsx                   # ClinicProvider + useClinic() hook
src/lib/user-clinics.ts                      # ensureUserClinic(), getUserAllClinicIds()
src/lib/permissions.ts                       # canManageClinic/Branch, sessionUser()
src/lib/payment/config-schema.ts             # PaymentConfig, parsePaymentConfig
src/lib/payment/money.ts                     # sumToTiyin, tiyinToSum, formatSum
src/lib/payment/payme/handlers.ts            # 6 ta Payme handler
src/lib/payment/click/handlers.ts            # Prepare + Complete handler
src/lib/telegram/relay.ts                    # Xodim→Bemor xabar relay
src/lib/stats/queries.ts                     # thisMonthRevenue, statistika query'lar
src/lib/stats/charts.ts                      # getDailyRevenue
```

### 17.2 API Route fayllar

```
src/app/api/book/route.ts                    # POST /api/book (asosiy bron endpoint)
src/app/api/services/route.ts                # GET /api/services
src/app/api/slots/route.ts                   # GET /api/slots
src/app/api/appointments/route.ts            # GET /api/appointments
src/app/api/auth/login/route.ts              # POST /api/auth/login
src/app/api/webhook/telegram/route.ts        # Telegram webhook
src/app/api/reminders/route.ts               # Cron reminder
src/app/api/cron/ad-broadcast/route.ts       # Cron broadcast
src/app/api/cron/expire-bookings/route.ts    # Cron expire
src/app/api/admin/stats/route.ts             # GET /api/admin/stats (KPI)
src/app/api/admin/stats/discount/route.ts    # GET X/Y/Z
src/app/api/admin/clinic-settings/route.ts   # Settings CRUD
src/app/api/reception/appointments/route.ts  # Reception bron ro'yxati
src/app/api/reception/appointments/[id]/payment/route.ts # To'lov
src/app/api/doctor/appointments/route.ts     # Doctor bron ro'yxati
src/app/api/doctor/appointments/[id]/attendance/route.ts # Keldi/Kelmadi
src/app/api/payments/payme/route.ts          # Payme JSON-RPC
src/app/api/payments/click/route.ts          # Click Shop API
src/app/api/doctors/[id]/schedule/route.ts   # Public doctor schedule
src/app/api/doctors/[id]/blocked-dates/route.ts # Bloklangan kunlar CRUD
```

### 17.3 Bot fayllar

```
bot/index.ts                                 # Standalone polling (faqat local)
bot/api.ts                                   # API client (fetchServices, bookAppointment)
bot/state.ts                                 # userState Map + cleanExpiredState
bot/webhook-setup.ts                         # setupBotHandlers()
bot/handlers/start.ts                        # /start + WebApp button
bot/handlers/callback.ts                     # State machine (svc:, date:, doc:, confirm)
bot/handlers/message.ts                      # Matn kiritish
bot/handlers/clinicFlow.ts                   # Klinika/filial tanlash
bot/handlers/myChatMember.ts                 # Bot kanal admin bo'lganida
bot/helpers/render.ts                        # editOrSend(), keyboard builder'lar
bot/helpers/calendar.ts                      # Sana kalendariyasi
```

### 17.4 Komponentlar

```
src/components/webapp/BookingFlipCard.tsx    # 3D flip card (barcha bronlar)
src/components/webapp/ServicePicker.tsx      # Xizmat tanlash (rasmli)
src/components/webapp/ClinicGuard.tsx        # clinicId yo'q → redirect
src/components/webapp/ClinicSwitcher.tsx     # Klinika almashtirish BottomSheet
src/components/DoctorBlockedDatesManager.tsx # Bloklangan kun boshqaruvi
src/components/DoctorProfileFields.tsx       # Shifokor profil maydonlar
src/components/ClinicLogo.tsx                # Logo (onError → 🏥 fallback)
src/components/stats/DiscountStats.tsx       # X/Y/Z statistika karta
src/components/pages/ReceptionView.tsx       # Qabulxona view (standalone+admin)
src/components/pages/DoctorQueueView.tsx     # Shifokor view (standalone+admin)
src/components/ui/AdminSidebar.tsx           # Admin sidebar + mobil hamburger
src/components/ui/Navbar.tsx                 # Top navbar
```

---

## QISM 18 — MUHIM QOIDALAR (O'ZGARTIRISH MUMKIN EMAS)

```
1. processBooking() asosiy oqimi va $transaction tuzilishi O'ZGARTIRMA
2. tibId format: "tib" + 6 raqam (tib000001) — format O'ZGARTIRMA
3. normalizePhone() output: +998XXXXXXXXX — O'ZGARTIRMA
4. BookingInput majburiy: clinicId, serviceId, date, patientName, patientPhone
5. BookingResult: { success: true; data; tibId } | { success: false; error: { code, message }; status }
6. source flag: bot → source="bot" → notifyPatientAsync ISHLAMAYDI (duplikat xabar oldini oladi)
7. clinicId scope: barcha DB so'rovlarda clinicId filtri MAJBURIY
8. notifiedDayBefore / notifiedTwoHours: idempotency flag'lari — TEGILMA
9. Payme/Click Payment jadval: status o'zgarishi Appointment.paymentStatus'dan MUSTAQIL
10. Chegirma faqat paidAmount+appliedDiscountPercent ustunlarda — status=arrived/missed tegilmaydi
```

---

## QISM 19 — TEZKOR SINOV SKRIPTLARI

### 19.1 API curl test'lari

```bash
BASE="https://tibtaqvim.vercel.app"

# Health check
curl "$BASE/api/health"
curl "$BASE/api/health?verbose=1"

# Login (admin)
curl -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"identifier":"+998900000000","password":"admin123"}'

# Login (superadmin)
curl -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"identifier":"+998999999999","password":"super123"}'

# Klinikalar ro'yxati (public)
curl "$BASE/api/clinics"

# Xizmatlar (public)
curl "$BASE/api/services?clinicId=clinic-demo"

# Stats (JWT kerak)
curl "$BASE/api/admin/stats" -b cookies.txt

# Webapp bronlar (JWT yo'q, telegramId bilan)
curl "$BASE/api/webapp/appointments?telegramId=986660442&clinicId=clinic-demo"

# Bron yaratish (test)
curl -X POST "$BASE/api/book" \
  -H "Content-Type: application/json" \
  -d '{
    "clinicId":"clinic-demo",
    "serviceId":"svc-queue-1",
    "date":"2026-06-10",
    "patientName":"__TEST__Sinov Bemor",
    "patientPhone":"+998901234567",
    "source":"webapp"
  }'

# Cron test
curl -H "Authorization: Bearer aFF5JkzICj0AGs5qi92aEi3r_m8libsC" \
  "$BASE/api/reminders?type=day_before"

# Webhook holat
curl "https://api.telegram.org/bot8510744887:AAGoBuoGP7GEtXDF4b4zEct6vSQ05do95zM/getWebhookInfo"
```

### 19.2 Xavfsizlik sinov so'rovlari

```bash
# AuthZ tekshiruvi: doctor tokeni bilan admin endpoint
# (avval doctor login qilib cookie oling)
curl "$BASE/api/admin/stats" -b doctor_cookies.txt  # → 403 bo'lishi kerak

# IDOR sinov: boshqa klinikaning appointment ID'si bilan
curl "$BASE/api/appointments/[BOSHQA_KLINIKA_APPT_ID]" -b clinic_admin_cookies.txt

# Auth yo'q bilan himoyalangan endpoint
curl -X POST "$BASE/api/reception/appointments/[id]/payment" \
  -H "Content-Type: application/json" \
  -d '{"mode":"full"}'  # → 401 bo'lishi kerak

# Soxta telegramId bilan webapp appointments
curl "$BASE/api/webapp/appointments?telegramId=99999999999&clinicId=clinic-demo"
# → Bo'sh [] qaytishi yoki 403 bo'lishi kerak (hozir haqiqiy javob berayapti?)

# SQL injection sinov (login)
curl -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin OR 1=1--","password":"anything"}'
# → xato bo'lishi kerak, DB xatosi emas

# XSS sinov (bron yaratish)
curl -X POST "$BASE/api/book" \
  -H "Content-Type: application/json" \
  -d '{
    "clinicId":"clinic-demo",
    "serviceId":"svc-queue-1",
    "date":"2026-06-10",
    "patientName":"<script>alert(1)</script>",
    "patientPhone":"+998901234567"
  }'
# sanitizeText() ishlagani tekshir — appt.patientName'da nima bor?
```

---

## QISM 20 — MA'LUM XATOLAR VA CHEKLOVLAR

| # | Muammo | Jiddiylik | Holat |
|---|--------|-----------|-------|
| 1 | Rate limiting in-memory (Vercel'da ishlamaydi) | 🟠 YUQORI | Ma'lum, Redis kerak |
| 2 | Bot state in-memory (Vercel'da yo'qoladi) | 🟠 YUQORI | Ma'lum (BotState DB'ga qo'shilgan) |
| 3 | WebApp initData to'liq validatsiya yo'q | 🟠 YUQORI | Tekshirish kerak |
| 4 | RLS policy'lar to'liq emas (15 jadval) | 🟡 O'RTA | Ma'lum |
| 5 | PAYMENT_ENCRYPTION_KEY o'rnatilmagan | 🟡 O'RTA | Sprint 4 da |
| 6 | Vercel Hobby plan: 10s timeout | 🔵 PAST | Ma'lum |
| 7 | Sahifalar sekin ochilishi | 🟡 O'RTA | Investigatsiya kerak |
| 8 | 100% chegirma "Qaytarish" bloklangan | ✅ Intentional | Xujjatlangan |
| 9 | bot/index.ts Vercel'da ishlamaydi | ✅ Ma'lum | Webhook ishlatiladi |

---

> **Oxirgi yangilanish:** 2026-06-02  
> **Tayyorlagan:** Claude Code (audit ma'lumotnomasi uchun avtomatik yig'ildi)  
> **Keyingi yangilanish:** Har katta o'zgarishdan keyin NEXTBOT.md bilan birga
