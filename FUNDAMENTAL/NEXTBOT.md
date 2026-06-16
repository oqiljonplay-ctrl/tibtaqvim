# NEXTBOT.md — Single Source of Truth

> **QOIDA:** Har qanday kod o'zgarishidan OLDIN bu faylni o'qi.
> Har qanday o'zgarishdan KEYIN ushbu faylni yangilang.

---

## 1. PROJECT OVERVIEW

**Nima:** Multi-tenant klinika boshqaruv tizimi.

**Asosiy oqim:**
```
Telegram Bot → xizmat/sana/shifokor tanlash → ism/telefon → API /book → DB → Telegram tasdiqlash
Telegram WebApp (qaytuvchi user) → Dashboard: bronlar/navbat/bekor/qayta bron
Telegram WebApp (yangi user) → Booking flow → telefon kiritish → /api/book
Reception Panel → keldi/kelmadi belgilash
Doctor Panel → bugungi bemorlar ro'yxati
```

**Bot button URL formati:** `https://<domain>/webapp?clinicId=<id>`
- Identity: FAQAT `window.Telegram.WebApp.initDataUnsafe.user.id` (SDK) — URL `tgid` param ishlatilmaydi
- Telegram SDK yo'q bo'lsa (brauzerda to'g'ridan ochilgan) → booking flow (phone-based)

**Hozirgi holat:** Production (Vercel webhook). `?pgbouncer=true` Supabase connection pooler uchun.

---

## 2. TECH STACK

| Layer | Texnologiya | Versiya |
|---|---|---|
| Frontend | Next.js App Router + TypeScript + Tailwind | 14.x |
| Backend | Next.js API Routes (serverless) | 14.x |
| ORM | Prisma | 6.x |
| Database | PostgreSQL | any |
| Bot | node-telegram-bot-api | 0.67.x |
| Auth | JWT (jsonwebtoken) + bcryptjs | — |
| Tests | Vitest | 4.x |
| Runtime (bot) | ts-node (local) / webhook (prod) | — |

---

## 3. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────┐
│  TELEGRAM CLIENT                                        │
│    Bot commands → polling (local) / webhook (prod)      │
│    WebApp → opens NEXT_PUBLIC_WEBAPP_URL in Telegram    │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  BOT LAYER  (bot/)                                      │
│    index.ts — singleton TelegramBot, userState Map      │
│    handlers/start.ts — service list + WebApp button     │
│    handlers/callback.ts — state machine navigation      │
│    handlers/message.ts — text input (ism, telefon)      │
│    api.ts — fetchServices, bookAppointment, fetchTibId  │
└────────────────┬────────────────────────────────────────┘
                 │ HTTP (localhost:3000 yoki Vercel)
┌────────────────▼────────────────────────────────────────┐
│  API LAYER  (src/app/api/)                              │
│    POST /api/book                                       │
│    GET  /api/services?clinicId=&date=                   │
│    GET  /api/slots?serviceId=&date=                     │
│    GET  /api/appointments                               │
│    POST /api/arrived                                    │
│    POST /api/webhook/telegram  (prod webhook)           │
│    GET  /api/health                                     │
│    POST /api/auth/login  (needsEmVerify flag)           │
│    POST /api/auth/verify-em  (em_key cookie)           │
│    GET  /api/user/tib                                   │
│    GET  /api/user/by-tibid                              │
│    GET  /api/user/by-telegram                           │
│    POST /api/user/register                              │
│    GET  /api/webapp/appointments (JWT'siz, phone chk)  │
│    POST /api/webapp/cancel (JWT'siz, phone chk)        │
│    PATCH /api/webapp/profile (telegramId, firstName,   │
│          lastName, fatherName, region, district)       │
│    GET  /api/me/appointments (telegramId, scope, filters)│
│    GET  /api/me/clinics (telegramId, last clinic)       │
│    GET  /api/reminders  (cron)                          │
│    CRUD /api/admin/*                                    │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  SERVICE LAYER  (src/lib/services/)                     │
│    booking.service.ts — asosiy bron mantiq              │
│    reminder.service.ts — kun oldin / 2 soat eslatma     │
│    tib-id.service.ts — tibId tayinlash/qidirish         │
│    confirmation.service.ts — Telegram tasdiqlash        │
│    appointment.service.ts — qo'shimcha yordamchi        │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  DATABASE LAYER  (Prisma + PostgreSQL)                  │
│    prisma/schema.prisma — asosiy schema                 │
│    src/lib/prisma.ts — singleton + withRetry            │
└─────────────────────────────────────────────────────────┘
```

**Serverless ogohlantirishlar:**
- In-memory `Map` (userState, rateLimit, tibCache) Vercel'da har invocation'da yangilanadi. Production uchun Redis kerak.
- Bot polling `bot/index.ts` — faqat local. Prod'da `src/app/api/webhook/telegram/route.ts` ishlatiladi.

---

## 4. FILE STRUCTURE MAP

```
nextBOT/
├── bot/                          # Telegram bot (standalone, ts-node)
│   ├── index.ts                  # Bot singleton, userState, event handlers
│   ├── api.ts                    # API client (fetchServices, bookAppointment, fetchTibId)
│   └── handlers/
│       ├── start.ts              # /start → klinika/xizmat ro'yxati + WebApp button
│       ├── clinicFlow.ts         # Klinika/filial tanlash oqimi (auto-skip logic)
│       ├── callback.ts           # Inline keyboard state machine
│       └── message.ts            # Text input handler (ism, telefon, manzil)
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── book/route.ts           # POST /api/book
│   │   │   ├── services/route.ts       # GET /api/services
│   │   │   ├── slots/route.ts          # GET /api/slots
│   │   │   ├── appointments/route.ts   # GET /api/appointments
│   │   │   ├── arrived/route.ts        # POST /api/arrived
│   │   │   ├── health/route.ts         # GET /api/health
│   │   │   ├── reminders/route.ts      # GET /api/reminders (cron)
│   │   │   ├── auth/login/route.ts     # POST /api/auth/login
│   │   │   ├── user/tib/route.ts       # GET /api/user/tib
│   │   │   ├── user/by-tibid/route.ts  # GET /api/user/by-tibid
│   │   │   ├── clinics/route.ts        # GET /api/clinics (public)
│   │   │   ├── clinics/[id]/route.ts   # GET /api/clinics/[id] (public)
│   │   │   ├── clinics/[id]/branches/  # GET (public)
│   │   │   ├── admin/branches/         # CRUD (clinic_admin/super_admin)
│   │   │   ├── admin/                  # Admin CRUD routes
│   │   │   ├── admin/clinics/[id]/payment-config/ # GET/PATCH Payme+Click config
│   │   │   ├── payments/payme/         # JSON-RPC endpoint + create-link
│   │   │   ├── payments/click/         # form-urlencoded endpoint + create-link
│   │   │   ├── appointments/[id]/payment-info/ # providers + amount
│   │   │   ├── me/appointments/route.ts  # Tarix cursor pagination
│   │   │   ├── me/clinics/route.ts       # User klinikalari
│   │   │   └── webhook/telegram/route.ts # POST webhook (prod)
│   │   ├── admin/
│   │   │   ├── branches/page.tsx         # Filial CRUD UI (clinic_admin)
│   │   │   └── super/clinics/
│   │   │       ├── page.tsx              # Klinika ro'yxati + ClinicLogo + Tahrirlash
│   │   │       └── [id]/
│   │   │           ├── page.tsx          # Clinic Builder (tabs: sozlamalar/modullar/flaglar/adminlar/filiallar/to'lov/audit)
│   │   │           ├── edit/page.tsx     # Klinika edit sahifasi
│   │   │           ├── AdminsTab.tsx, CreateAdminModal.tsx, ResetPasswordModal.tsx
│   │   │           ├── BranchesTab.tsx, CreateBranchModal.tsx
│   │   │           ├── PaymentTab.tsx    # Payme + Click config UI
│   │   │           └── branches/[branchId]/  # Filial detail (Info + Adminlar tabs)
│   │   ├── doctor/page.tsx        # Doctor panel
│   │   ├── reception/page.tsx     # Reception panel
│   │   ├── webapp/
│   │   │   ├── page.tsx                # Dashboard + ClinicSwitcher + Tarix tugmasi
│   │   │   ├── layout.tsx              # Suspense + ClinicProvider + ClinicGuard
│   │   │   ├── select-clinic/page.tsx  # Klinika tanlash
│   │   │   ├── history/page.tsx        # Bron tarixi (2 tab + filters)
│   │   │   ├── history/HistoryFilters.tsx
│   │   │   ├── appointments/[id]/pay/page.tsx  # To'lov UI
│   │   │   ├── clinics/page.tsx        # Klinika ro'yxati (public)
│   │   │   ├── clinics/[id]/page.tsx   # Klinika detail + filial tanlash
│   │   │   └── clinics/[id]/branches/[branchId]/  # To'liq booking
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   │
│   ├── components/
│   │   ├── ClinicLogo.tsx                      # Reusable logo (size prop, 🏥 fallback)
│   │   └── webapp/
│   │       ├── ClinicGuard.tsx                 # clinicId yo'q → redirect
│   │       ├── ClinicSwitcher.tsx              # BottomSheet clinic almashtirish
│   │       └── AppointmentCard.tsx             # Reusable bron karta
│   │
│   └── lib/
│       ├── prisma.ts              # Singleton PrismaClient + withRetry
│       ├── auth.ts                # JWT, bcrypt, requireAuth, validatePasswordStrength, requireEmVerified
│       ├── api-response.ts        # ok(), error(), unauthorized() helpers
│       ├── rate-limit.ts          # In-memory rate limiter
│       ├── logger.ts              # Structured logger + generateRequestId
│       ├── env.ts                 # Env validation (validateEnv, getEnv)
│       ├── auth-edge.ts           # Edge runtime auth
│       ├── clinic-context.tsx     # ClinicProvider + useClinic() hook
│       ├── permissions.ts         # canManageClinic/Branch, sessionUser()
│       ├── admin-username.ts      # generateClinicAdminUsername, generateBranchAdminUsername
│       ├── user-clinics.ts        # ensureUserClinic(), getUserAllClinicIds()
│       ├── payment/
│       │   ├── config-schema.ts   # PaymentConfig, parsePaymentConfig, isProviderEnabled
│       │   ├── secrets.ts         # encryptSecret/decryptSecret (placeholder)
│       │   ├── money.ts           # tiyinToSum, sumToTiyin
│       │   ├── notifications.ts   # notifyPaymentResult() Telegram xabarnoma
│       │   ├── payme/             # types, errors, handlers, checkout-url
│       │   └── click/             # types, errors, handlers, signature, checkout-url, resolve-clinic
│       ├── audit/
│       │   └── actions.ts         # PAYMENT_AUDIT_ACTIONS const
│       ├── services/
│       │   ├── booking.service.ts       # processBooking() — asosiy
│       │   ├── reminder.service.ts      # Cron reminder sender
│       │   ├── tib-id.service.ts        # assignTibId, getTibIdByPhone
│       │   ├── confirmation.service.ts  # buildConfirmationMessage, sendTelegramConfirmation
│       │   ├── appointment.service.ts
│       │   └── em-id.service.ts         # nextEmId(tx), normalizeEmId(), getEmployeeByUserId()
│       ├── validators/
│       │   └── booking.ts         # validateBookingInput + sanitizeText
│       └── utils/
│           └── phone.ts           # normalizePhone()
│
├── prisma/
│   ├── schema.prisma              # Database schema
│   ├── seed.ts                    # Test data
│   └── backfill-tib-ids.ts        # Bir martalik migration script
│
└── src/lib/__tests__/
    ├── booking.test.ts            # Vitest unit tests
    └── phone.test.ts
```

---

## 5. CORE DATA MODELS

### User
```
id              String  @id @default(cuid())
clinicId        String? (nullable — patient yoki super_admin)
telegramId      String? @unique
tibId           String? @unique  ← GLOBAL permanent ID (tib000001 format)
phone           String?          ← +998XXXXXXXXX (normalized)
firstName       String
lastName        String?
fatherName      String?
region          String?
district        String?
onboardingStep  String?          ← null|"contact"|"profile"|"done" (onboarding holati)
role            UserRole (super_admin|clinic_admin|doctor|receptionist|patient)
passwordHash    String?
```

**`onboardingStep` qoidalari:**
- `null` → yangi user, onboarding'dan boshlasin (welcome animatsiya → contact → profile)
- `"contact"` → xush kelibsiz ekranni ko'rgan, kontakt qadamida to'xtaghan
- `"profile"` → telefon saqlandi, profil qadamida
- `"done"` → tugatgan yoki skip qilgan — onboarding QAYTA CHIQMAYDI
- `hasPhone === true` bo'lgan barcha mavjud userlar backfill orqali `"done"` bilan belgilangan
- `isOnboarded` DB'da yo'q — faqat `onboardingStep === "done"` tekshiriladi

### Appointment
```
id            String @id
clinicId      String           ← barcha so'rovlar shu bilan filtrlanadi
serviceId     String
doctorId      String?
userId        String?
slotId        String?
patientName   String           ← sanitized text
patientPhone  String           ← normalized +998XXXXXXXXX
address       String?          ← home_service uchun
queueNumber   Int?             ← doctor_queue uchun
date          DateTime @db.Date
status        booked|arrived|missed|cancelled
paymentStatus not_required|pending|paid|cancelled  @default("pending")
              ← CHECK constraint (DB). Qabulxona boshqaradi. Kelajak: Payme/Click webhook
paidAmount    Int?         ← haqiqatan to'langan summa (so'm). Null = to'lanmagan
appliedDiscountPercent Int @default(0)  ← to'lov paytida muzlatilgan foiz (0-100)
queueMode     live|online|slot-disabled
notifiedDayBefore Boolean @default(false)   ← idempotency
notifiedTwoHours  Boolean @default(false)   ← idempotency
```

### Service
```
type            ServiceType (doctor_queue|diagnostic|home_service)
requiresSlot    Boolean    ← diagnostic uchun slot majburiyligini belgilaydi
requiresAddress Boolean    ← home_service uchun
dailyLimit      Int?       ← null = limit yo'q
```

### Slot
```
serviceId  String
date       DateTime @db.Date
startTime  String   ← "09:00"
endTime    String   ← "09:30"
capacity   Int @default(1)
```

### Employee
```
id             String   @id @default(cuid())
emId           String   @unique   ← EM000001 format (global sequential, next_em_id() DB funksiyasi)
firstName      String
lastName       String?
phone          String?
profession     String?  ← "doctor" | "receptionist" | "laborant" | ixtiyoriy kasblar
userId         String?  @unique   ← User bilan bog'liq (null bo'lishi mumkin)
maxJobRequests Int      @default(1)
maxClinics     Int      @default(1)
isActive       Boolean  @default(true)
```
- Doctor va Staff modellarida `employeeId String?` FK (optional, index bor)
- Admin delete FAQAT `staff.isActive=false` — Employee va User TEGILMAYDI
- Login: xodim bo'lsa `needsEmVerify: true` qaytadi → `/api/auth/verify-em` → `em_key` cookie
- `requireEmVerified` guard: 5 ta doctor/reception route'da → cookie `em_key === employee.emId` tekshiriladi

---

## 6. CRITICAL ARCHITECTURE DECISIONS

### tibId — Global foydalanuvchi identifikatori
- Format: `tib000001`, `tib000002` (6 raqam, sequential)
- Klinikalararo yagona ID — bemorni tezda topish uchun
- `prisma/backfill-tib-ids.ts` — mavjud foydalanuvchilarga tayinlash
- **O'zgartirish mumkin emas:** format, unique constraint, tayinlash logikasi

### Structured Error Codes
- Barcha API xatolari `{ code: string; message: string }` formatida qaytadi
- Kodlar: `LIMIT_REACHED`, `DUPLICATE_BOOKING`, `SLOT_REQUIRED`, `SLOT_INVALID`, `SLOT_FULL`, `ADDRESS_REQUIRED`, `SERVICE_NOT_FOUND`, `SERVER_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`
- Frontend va bot `result.error.code` yoki `result.error.message` ishlatadi

### source flag — Duplicate notification oldini olish
- `BookingInput.source?: "bot" | "webapp"`
- Bot `source: "bot"` yuboradi → `notifyPatientAsync` ishlamaydi (bot o'zi yuboradi)
- WebApp yoki boshqa kanallar → `notifyPatientAsync` ishga tushadi
- **O'zgartirish mumkin emas:** bu flag bo'lmasa duplikat xabarlar ketadi

### Timezone — Asia/Tashkent
- `CLINIC_TIMEZONE = process.env.CLINIC_TIMEZONE || "Asia/Tashkent"`
- Sana formatlash: `toLocaleDateString("sv-SE", { timeZone: TZ })` → `YYYY-MM-DD`
- Server UTC bo'lsa ham klinika vaqtida to'g'ri sana chiqadi
- Ishlatilgan joylar: `bot/handlers/callback.ts`, `src/lib/services/reminder.service.ts`

### Rate Limiting — In-memory
- `src/lib/rate-limit.ts` — `Map<string, {count, resetAt}>`
- `/api/book`: 10 req/min/IP
- `/api/auth/login`: 5 req/min/IP
- `/api/reminders`: 10 req/min/IP
- **Eslatma:** Vercel serverless'da har instance o'z Map'ini saqlaydi → production'da Redis kerak

### Bot State Machine — In-memory Map
- `userState: Map<number, any>` — `bot/index.ts`
- TTL: 30 daqiqa, har 5 daqiqada tozalanadi
- State steps: `select_clinic → select_branch → select_service → select_date → select_doctor_or_slot → enter_name → enter_phone → (enter_address) → confirm`
- 1 klinika yoki 1 filial bo'lsa tegishli qadam avtomatik o'tkazib yuboriladi
- **Eslatma:** Vercel'da saqlanmaydi — production'da Redis kerak

---

## 7. CRITICAL PATTERNS

### normalizePhone()
**Fayl:** `src/lib/utils/phone.ts`
```typescript
// +998XXXXXXXXX formatiga keltiradi
// Bo'shliq, tire, qavs olib tashlanadi
// 9XXXXXXXX → +9989XXXXXXXX
// 0XXXXXXXXX → +998XXXXXXXXX
// 998XXXXXXXXX → +998XXXXXXXXX
export function normalizePhone(raw: string): string
```
- Barcha kirish nuqtalarida ishlatilishi SHART: validator, booking service, auth login
- Test: `src/lib/__tests__/phone.test.ts`

### withRetry()
**Fayl:** `src/lib/prisma.ts`
```typescript
// P1001, P1002 (DB ulanish xatolari) da 3 marta qayta urinadi
// Exponential delay: 300ms, 600ms, 900ms
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 300): Promise<T>
```

### rateLimit()
**Fayl:** `src/lib/rate-limit.ts`
```typescript
// true = ruxsat berildi, false = limit oshdi
export function rateLimit(key: string, limit: number, windowMs: number): boolean
// Ishlatish: rateLimit(`book:${ip}`, 10, 60_000)
```

### Prisma Singleton
**Fayl:** `src/lib/prisma.ts`
```typescript
// globalThis pattern — Next.js hot reload'da multiple connection oldini oladi
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({...});
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### Bot Singleton (Webhook mode)
**Fayl:** `src/app/api/webhook/telegram/route.ts`
```typescript
// Serverless'da per-request yaratilmaslik uchun module-level variable
let bot: TelegramBot | null = null;
function getBot() { if (!bot) bot = new TelegramBot(TOKEN, { webHook: true }); return bot; }
```

### assignTibId() — Race condition xavfsiz
**Fayl:** `src/lib/services/tib-id.service.ts`
```typescript
// P2002 (unique constraint) ushlansa → qayta urinadi (max 5)
// count + 1 approach, concurrent-safe
export async function assignTibId(userId: string): Promise<string | null>
```

### API Response format
```typescript
// Muvaffaqiyat: { success: true, data: T }
// Xato:         { success: false, error: { code: string, message: string } }
ok(data)          // 200
created(data)     // 201
error(msg, 400)   // { code: "ERROR", message: "..." }
unauthorized()    // { code: "UNAUTHORIZED", message: "Unauthorized" }
```

### Booking Transaction
- Barcha bron turlari `prisma.$transaction()` ichida
- Limit tekshiruvi + create bitta atomik operatsiya
- `throw { code: "X", message: "..." }` → `catch` → `bookingError()`

---

## 8. ENV VARIABLES

| O'zgaruvchi | Majburiy | Maqsad |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | JWT token imzolash |
| `NEXTAUTH_SECRET` | ✅ | NextAuth (agar ishlatilsa) |
| `TELEGRAM_BOT_TOKEN` | ✅ prod | Bot token (BotFather) |
| `DEFAULT_CLINIC_ID` | ✅ bot | Bot qaysi klinika uchun ishlaydi |
| `NEXT_PUBLIC_APP_URL` | ✅ bot | Bot API so'rovlari uchun base URL |
| `NEXT_PUBLIC_WEBAPP_URL` | optional | Telegram WebApp URL (start.ts tugmasi) |
| `CRON_SECRET` | ✅ prod | /api/reminders endpoint himoyasi |
| `CLINIC_TIMEZONE` | optional | Default: `Asia/Tashkent` |
| `JWT_EXPIRES_IN` | optional | Default: `7d` |

**env.ts tekshiruvi:**
- Majburiy: `DATABASE_URL`, `JWT_SECRET`, `NEXTAUTH_SECRET`
- Production warning: `TELEGRAM_BOT_TOKEN`, `DEFAULT_CLINIC_ID`, `CRON_SECRET`

---

## 9. SAFETY RULES

1. **Endpoint'larni sindirma:** Mavjud `/api/book`, `/api/services`, `/api/appointments` response formatini o'zgartirma
2. **Logikani takrortirma:** `processBooking()` dan tashqarida bron mantiqini yozma
3. **Validatsiyani o'tkazib yubortirma:** Har doim `validateBookingInput()` ishlatilsin
4. **normalizePhone ni o'tkazib yubortirma:** Telefon raqami saqlanayotgan har joyda
5. **tibId formatini o'zgartirma:** `tib` + 6 raqam — o'zgarmas
6. **clinicId scope'ni buzma:** Barcha DB so'rovlarda `clinicId` filtri bo'lishi shart
7. **Transaction'ni buzma:** `bookDoctorQueue`, `bookDiagnostic`, `bookHomeService` ichidagi `$transaction` qo'llanishini saqla
8. **source flag'ni o'chirma:** `input.source !== "bot"` sharti `notifyPatientAsync` oldida turishi shart

---

## 10. EXTENSIBILITY RULES

### O'zgartirish MUMKIN:
- UI (Tailwind classlar, komponent tuzilishi)
- Yangi API endpoint'lar (mavjudlarini buzmasdan)
- Yangi service type (schema'ga qo'shish + booking.service.ts'ga case)
- Rate limit qiymatlari (limit/window raqamlari)
- Reminder vaqtlari (kun oldin, 2 soat — config qilish mumkin)
- Bot xabar matni (Uzbekcha/Ruscha)

### O'zgartirish MUMKIN EMAS:
- `processBooking()` asosiy oqimi va transaction tuzilishi
- `tibId` format va tayinlash logikasi (`tib-id.service.ts`)
- `normalizePhone()` output format (`+998XXXXXXXXX`)
- `BookingInput` majburiy maydonlari (`clinicId`, `serviceId`, `date`, `patientName`, `patientPhone`)
- `BookingResult` type tuzilishi (`{ success: true; data }` | `{ success: false; error: { code, message }; status }`)
- Notification `source` flag mexanizmi
- Prisma singleton pattern
- `notifiedDayBefore` / `notifiedTwoHours` idempotency flag'lari

---

## 11. KNOWN CONSTRAINTS

### Vercel Serverless
- **Cold start:** Har request'da yangi instance ishga tushishi mumkin
- **In-memory state yo'qoladi:** `userState`, `rateLimit store`, `tibCache` — production'da Redis kerak
- **Execution timeout:** 10s (hobby) / 60s (pro) — og'ir operatsiyalarda e'tibor bering
- **Bot polling YO'Q:** `bot/index.ts` Vercel'da ishlamaydi → webhook ishlatiladi

### Webhook Mode
- Bot faqat `src/app/api/webhook/telegram/route.ts` orqali ishlaydi
- Webhook URL: `https://your-domain.vercel.app/api/webhook/telegram`
- Register: `https://api.telegram.org/bot{TOKEN}/setWebhook?url={WEBHOOK_URL}`
- **Polling + webhook bir vaqtda ishlamaydi**

### Telegram WebApp
- `web_app: { url }` — faqat HTTPS URL qabul qiladi
- `NEXT_PUBLIC_WEBAPP_URL` bo'sh bo'lsa tugma chiqmaydi (xavfsiz fallback)
- WebApp Telegram ichida ochiladi, tashqi brauzerda emas

### PostgreSQL Connections
- Vercel serverless'da har function o'z connection'ini ochadi
- `prisma.ts` singleton pattern bu muammoni kamaytiradi
- Ko'p traffic'da PgBouncer yoki Supabase connection pooling kerak

---

## 12. RECENT CHANGES LOG

### 2026-06-15 — TUZATISH-05+06: Portativ profil rasmi tizimi

**Maqsad:** `photoUrl` FAQAT `employees.photoUrl`dan o'qiladi va yoziladi. Ishsiz holat (0 faol stint) — header va "Faol ish joyi yo'q" ekranida EM rasmi ko'rsatiladi.

**Diagnoz:** Kategoriya (c) — frontend o'qimaydi. `DoctorQueueView` inactive holatda API'dan `photoUrl`ni olar edi, lekin state'ga SAQLAMAGAN. `/api/me` esa umuman `photoUrl` qaytarmagan.

**O'zgartirilgan fayllar (8 ta, commit `d11319e`):**
- `src/app/api/admin/doctors/route.ts` — POST: `doctor.create`dan `photoUrl` olinib, `employee.update({photoUrl})`ga o'tkazildi
- `src/app/api/admin/doctors/[id]/route.ts` — PATCH: `doctor.update`dan `photoUrl` olinib, `employee.update`ga o'tkazildi
- `src/app/api/me/route.ts` — `employee: { select: { photoUrl: true } }` qo'shildi; `photoUrl: user.employee?.photoUrl ?? null` response'da
- `src/hooks/useCurrentUser.ts` — `CurrentUser` interfeysi `photoUrl: string | null` qo'shildi
- `src/components/ui/Navbar.tsx` — `user?.photoUrl` bo'lsa `<img>`, xato bo'lsa initials (klinika logosi YO'Q)
- `src/components/pages/DoctorQueueView.tsx` — inactive state'ga `inactivePhotoUrl`/`inactiveFirstName`/`inactiveLastName` qo'shildi; ekran rasm yoki initials ko'rsatadi
- `src/app/doctor/profile/page.tsx` — `DoctorProfile.photoUrl` qo'shildi; inactive screen EM avatar+ism
- `FUNDAMENTAL/NEXTBOT.md` — yangilandi

**Muhim qoidalar:**
- `photoUrl` YOZISH: `employees.photoUrl` (admin POST/PATCH doctor routes)
- `photoUrl` O'QISH: `/api/me` → `user.employee?.photoUrl`; `DoctorQueueView` → `j.data.photoUrl`; Navbar → `user?.photoUrl`
- Klinika logosi avatar sifatida HECH QACHON ishlatilmaydi

**Real isbot:** EM000004 (Oqil Sayfiyev, 0 active stints) — `/api/me` HTTP 200, `photoUrl` to'lgan, `clinic: null` ✓; `/api/doctor/profile` HTTP 200, `inactive: true`, `photoUrl` to'lgan ✓

**Commit:** `d11319e`. Deploy: `dpl_HhMvGXcJEboWgW24rgwnTruAFKa8` (READY) → https://tibtaqvim.vercel.app ✅

---

### 2026-06-12 — SHIFOKOR TITUL: Reyting, statistika, stint tizimi

**Maqsad:** Har bir employee uchun kompozit reyting (4 omil), baho UI (webapp), admin/doctor statistika sahifalari, klinikalararo EM ID biriktirish, ish davrlari (stints).

**DB migrations (Supabase apply_migration):**
- `employment_stints` jadvali: employee/klinika/role bo'yicha ish davrlari, `uq_one_active_stint` UNIQUE index
- `doctor_ratings` jadvali: baho, appointmentId UNIQUE, stars CHECK, telegramId zaxira
- `employees` +7 ustun: `compositeRating, ratingCount, ratingPatientScore, ratingReturnRate, ratingArrivedRate, ratingActivityScore, ratingLastUpdatedAt`
- `appointments` +2 ustun: `arrivedAt, cancelledBy`
- `global_settings` key-value jadvali: `ratingPrior {value:4.5}`, `ratingEditWindow {enabled:false, hours:24}`
- `clinic_settings` +1 ustun: `showRatingCount BOOLEAN DEFAULT false`
- Backfill: stintlar doktorlar/staff'dan, arrivedAt = updatedAt

**Yangi fayllar:**
- `src/lib/services/employment.service.ts` — `resolveOrCreateEmployee`, `openStint`, `closeStint`
- `src/lib/services/rating.service.ts` — Bayesian composite formula, `recomputeEmployeeRating`, `recomputeAllRatings`
- `src/app/api/ratings/route.ts` — POST: baho qo'yish (arrived check, IDOR, P2002→409)
- `src/app/api/ratings/[id]/route.ts` — PATCH: tahrirlash (editWindow check)
- `src/app/api/cron/rating-recompute/route.ts` — GET cron, 01:00 UTC kunlik
- `src/components/webapp/StarRating.tsx` — SVG clipPath, 0.5-qadam, toggle mantiq
- `src/app/api/admin/doctors/[id]/stats/route.ts` — stint statistikasi (stintId/combined)
- `src/app/admin/(panel)/doctors/[id]/stats/page.tsx` — 📉 UI: KPI+Recharts+top xizmatlar
- `src/app/api/doctor/stats/route.ts` — shifokor o'z statistikasi (revenue YO'Q)
- `src/app/doctor/stats/page.tsx` — klinika tablar + Umumiy + omillar mini-jadvali
- `src/app/api/admin/global-settings/route.ts` — GET/PATCH ratingEditWindow (super_admin)
- `src/app/api/admin/employees/route.ts` — GET barcha xodimlar ro'yxati
- `src/app/api/admin/employees/[id]/limits/route.ts` — PATCH maxClinics

**O'zgartirilgan fayllar:**
- `prisma/schema.prisma` — EmploymentStint, DoctorRating, GlobalSetting modellari + mos FK'lar
- `src/app/api/admin/doctors/route.ts` — resolveOrCreateEmployee + openStint + reaktivatsiya
- `src/app/api/admin/doctors/[id]/route.ts` — DELETE: closeStint + audit doctor.fired
- `src/app/api/admin/staff/route.ts` — resolveOrCreateEmployee + openStint
- `src/app/api/admin/staff/[id]/route.ts` — DELETE: closeStint + audit staff.fired
- `src/lib/workflow/appointment-workflow.ts` — markAsArrived: arrivedAt; cancelAppointment: cancelledBy param
- `src/app/api/webapp/cancel/route.ts` — cancelledBy:'patient'
- `src/app/api/webapp/appointments/route.ts` — rating maydonlari (showRatingCount, editWindow)
- `src/app/api/webapp/doctor/[id]/route.ts` — compositeRating, ratingCount
- `src/app/api/services/route.ts` — employee rating, sort by compositeRating, showRatingCount
- `src/app/api/admin/clinic-settings/route.ts` — showRatingCount GET/PUT
- `src/components/webapp/BookingFlipCard.tsx` — doimiy yulduz qatori + baholash paneli (grid animation)
- `src/app/admin/(panel)/doctors/page.tsx` — EM ID input, 📉 tugma, yangilangan delete matn
- `src/app/admin/(panel)/settings/page.tsx` — showRatingCount toggle
- `src/app/admin/super/page.tsx` — RatingControls seksiyasi (editWindow toggle, prior info, EM limits)
- `src/app/doctor/layout.tsx` — Statistika nav link
- `src/app/doctor/profile/page.tsx` — Statistika tugmasi
- `src/app/api/doctor/appointments/[id]/attendance/route.ts` — arrived: Telegram notify (fire-and-forget)
- `src/lib/services/user-merge.service.ts` — doctorRating.updateMany reassign
- `vercel.json` — rating-recompute cron 0 1 * * *

**Muhim qoidalar (O'ZGARTIRMA):**
- `revenue` faqat admin stats'da (paidAmount), shifokor stats'da UMUMAN YO'Q
- `compositeRating` HECH QACHON NULL emas — ratingCount=0 bo'lsa ham prior (4.5) yoziladi
- Avatar manba: `employee.photoUrl ?? doctor.photoUrl` — klinika logosi HECH QACHON fallback emas
- `employment_stints` — kelajak Job Request tizimining poydevori
- Barcha Decimal → Number konversiya majburiy (JSON'da string keladi)

**DB holati (2026-06-15):** stints: 15 total; ratings: 3; compositeRating null=0 (barcha 13 doctor-employee 4.5 yoki haqiqiy baho) ✅

**Commitlar:** f648ee1, 4fc2161, c85adb4, 166864c, efa7d4e, ecebef1, 989f37c, 7e62ed6

---

### 2026-06-12 — EM ID TIZIMI: Xodim identifikatori va ikki bosqichli login

**Maqsad:** Doktor va qabulxona xodimlariga `EM000001`–`EM999999` formatidagi portativ global ID tayinlash. Login ikki bosqichli: 1) telefon+parol, 2) EM ID kiritish. EM tasdiqlangandan keyin `em_key` cookie orqali xodim panellariga kirish.

**DB:** Allaqachon Supabase'da mavjud edi — `employees` jadvali, `em_id_seq` sequence, `next_em_id()` funksiyasi. Prisma schema'ga faqat model qo'shildi (`prisma generate`, migration YO'Q).

**Muhim cheklovlar (o'zgartirma):**
- `prisma migrate` / DDL ISHLATILMAYDI — DB schema to'g'ridan Supabase'da boshqariladi
- `UserRole` enum'ga qiymat qo'shilmaydi — `laborant`, `uzi` kabi kasblar `profession` String maydonida
- `tibId`, `processBooking`, `isActive`, bron oqimi TEGILMADI
- `prisma.employee.delete` hech qaysi admin endpointda yo'q

**Yangi fayllar:**
- `src/lib/services/em-id.service.ts` — `nextEmId(tx)` (DB sequence), `normalizeEmId()`, `getEmployeeByUserId()`
- `src/app/api/auth/verify-em/route.ts` — `POST` endpoint: rate limit 5/min, JWT auth, EM taqqoslash, `em_key` httpOnly cookie

**O'zgartirilgan fayllar:**
- `prisma/schema.prisma` — `Employee` model, Doctor/Staff `employeeId FK`, User back-relation
- `src/app/api/admin/staff/route.ts` — POST: `$transaction` ichida Employee yaratadi + `emId` response'da; GET: `employee.emId` qo'shildi; `profession` field qabul qiladi
- `src/app/api/admin/doctors/route.ts` — POST: `$transaction` ichida Employee yaratadi (`userId=null`); GET: `employee.emId` qo'shildi
- `src/app/api/admin/staff/[id]/route.ts` — DELETE: FAQAT `staff.isActive=false` (user/employee tegilmaydi)
- `src/lib/auth.ts` — `requireEmVerified(req, auth)` funksiyasi: `em_key` cookie vs `employee.emId` taqqoslash; admin → `true` (EM talab qilinmaydi)
- `src/app/api/auth/login/route.ts` — `needsEmVerify` flag response'ga qo'shildi
- 5 ta route — `requireEmVerified` guard qo'shildi:
  - `src/app/api/doctor/appointments/route.ts`
  - `src/app/api/doctor/appointments/[id]/attendance/route.ts`
  - `src/app/api/doctor/profile/route.ts`
  - `src/app/api/reception/appointments/route.ts`
  - `src/app/api/reception/appointments/[id]/payment/route.ts`
- `src/app/login/page.tsx` — 2 bosqichli login UI: `"login" | "em"` state; EM input (uppercase); noto'g'ri → xato xabar; "Orqaga" tugmasi
- `src/components/pages/DoctorQueueView.tsx` + `ReceptionView.tsx` — 403 `EM_REQUIRED` → `/login` redirect
- `src/app/doctor/profile/page.tsx` — EM ID karta (nusxalash tugmasi bilan)
- `src/app/admin/(panel)/staff/page.tsx` — EM badge + profession maydoni + credentials modal'da emId
- `src/app/admin/(panel)/doctors/page.tsx` — EM badge + credentials modal'da emId
- `src/lib/identity/index.ts` — `conflict_staff_account` himoya: telefon egasi xodim bo'lsa merge bloklandi
- `src/app/api/webapp/profile/route.ts` — `conflict_staff_account` → 409 "Bu raqam xodim akkauntiga tegishli"

**Test natijalari:**
- Admin login: `needsEmVerify: false` ✅
- Receptionist login: `needsEmVerify: true` → `verify-em EM000015` → `em_key` cookie ✅
- Noto'g'ri `em_key` → reception `403 EM_REQUIRED` ✅
- To'g'ri `em_key` → reception `200` ✅
- Yangi staff yaratish `profession=laborant` → `emId: EM000015` ✅
- Staff/doctors listda EM badge'lar ko'rinmoqda ✅

**Commit:** 7 ta commit (feat/em-id-system). Deploy: https://tibtaqvim.vercel.app ✅

---

### 2026-06-09 — ONBOARDING: 3 ekranli to'liq onboarding tizimi

**Muammo:** Yangi user WebApp ochganda onboarding o'tkazib yuborilар — to'g'ridan bo'sh dashboard ko'rinardi.

**Yechim:** `onboardingStep` DB ustuni + 3 full-screen ekran + resume logikasi.

**DB (migration `20260609000001_add_onboarding_step_to_users`):**
- `users.onboardingStep TEXT` ustuni qo'shildi (nullable)
- Backfill: mavjud 36 ta telefonli user → `'done'` (regression himoyasi)

**Oqim:**
```
WebApp ochiladi → onboardingStep + hasPhone tekshiriladi
  "done" yoki hasPhone → Dashboard (avvalgi oqim)
  null   → EKRAN 0: Typewriter "Xush kelibsiz!" animatsiya → auto-advance
  "contact" → EKRAN 1: Telegram requestContact + qo'lda kiritish fallback
  "profile" → EKRAN 2: ism*, familiya, ota ismi, viloyat→tuman (uz-regions.ts)
  Istalgan ekranda "Keyinroq" → onboardingStep="done" → Dashboard
```

**O'zgartirilgan fayllar:**
- `prisma/schema.prisma` — `onboardingStep String?` User modeliga
- `prisma/migrations/20260609000001_.../migration.sql` — ALTER TABLE + backfill UPDATE
- `src/app/api/user/by-telegram/route.ts` — `onboardingStep` response'ga qo'shildi
- `src/app/api/webapp/profile/route.ts` — `onboardingStep` qabul qiladi (contact|profile|done validatsiya); `isStepOnly` holat — firstName majburiy emas
- `src/app/webapp/page.tsx` — `ObStep = "welcome"|"contact"|"profile"`; 3 ekran render; typewriter animatsiya (React state + setTimeout, kutubxonasiz); `prefers-reduced-motion` zaxirasi; resume; `obSkip()`, `obAdvanceFromWelcome()`, `obSavePhone()`, `obSaveProfile()` funksiyalari

**Invariantlar (tegilmadi):**
- `processBooking()`, `getOrCreateUser()` guest upsert
- `showOnboardingHint` modal (dashboard'da bron tugmasida)
- `mode=booking` oqimi, `ClinicGuard`, bot `render.ts`
- `clinicId` scope, `tibId` format, RLS policy'lar

**Commit:** 3 ta (db → api → webapp). Deploy: HALI YO'Q — vizual test kutilmoqda.

---

### 2026-06-01 — CHEGIRMA TIZIMI: Qabulxona chegirma, X/Y/Z statistika

**Maqsad:** Klinika admini discountPercent (0-100%) belgilaydi. Qabulxona xodimi 3 tugma orqali: "💰 To'ladi" (to'liq), "X so'm to'ladi" (chegirmali), "Bekor". Statistikada X/Y/Z tahlil.

**DB (Supabase migration `add_discount_system`):**
- `clinic_settings.discountPercent` INTEGER NOT NULL DEFAULT 0, CHECK 0-100
- `appointments.paidAmount` INTEGER nullable — haqiqatan to'langan summa
- `appointments.appliedDiscountPercent` INTEGER NOT NULL DEFAULT 0 — muzlatilgan foiz

**Yangi fayllar:**
- `src/app/api/admin/stats/discount/route.ts` — X/Y/Z statistika API
- `src/components/stats/DiscountStats.tsx` — 3 karta + horizontal bar chart (recharts)

**O'zgartirilgan fayllar:**
- `prisma/schema.prisma` — Appointment + ClinicSettings yangi ustunlar
- `src/app/api/admin/clinic-settings/route.ts` — discountPercent GET/PUT, receptionist ham o'qiy oladi
- `src/app/admin/(panel)/settings/page.tsx` — 4-chi field: chegirma foizi + izoh
- `src/app/api/reception/appointments/route.ts` — serialize: paidAmount, appliedDiscountPercent
- `src/app/api/reception/appointments/[id]/payment/route.ts` — mode=full|discount
- `src/lib/workflow/appointment-workflow.ts` — markAsPaid mode param + server hisob; markAsUnpaid 100% bloklash + paidAmount reset
- `src/components/pages/ReceptionView.tsx` — discountPercent fetch, 3 tugma (yashil/ko'k/qizil), qaytarish logikas
- `src/app/stats/page.tsx` — DiscountStats blok
- `src/lib/stats/queries.ts` — thisMonthRevenue: status=arrived→paymentStatus=paid, COALESCE(paidAmount, service.price)
- `src/lib/stats/charts.ts` — getDailyRevenue SQL: paidAmount ga o'tdi
- `src/components/stats/KpiCards.tsx` — "Daromad (oy)" sub matn yangilandi

**Asosiy qoidalar (O'ZGARTIRMA):**
- Chegirma FAQAT `paymentStatus+paidAmount+appliedDiscountPercent` — `status` tegilmaydi
- Server summani o'zi hisoblaydi (`mode` qabul qiladi, summa emas)
- markAsArrived `paymentStatus='paid'` talab qiladi — SAQLANADI
- Payment/Refund (Payme/Click) jadvallari TEGILMADI
- Bemor webapp/Telegram'da TO'LIQ narx ko'radi (chegirma klinika-ichki)
- Statistika muzlatilgan `appliedDiscountPercent`+`paidAmount` dan — joriy settings'dan emas
- 100% chegirmada qaytarish YO'Q (UI + server blok)
- Math.round formula: server va frontend bir xil

**Commit:** feat/discount-system → main. Deploy: https://tibtaqvim.vercel.app ✅

---

### 2026-05-31 — ADMIN-SIDEBAR-NAV: Sidebar/Navbar/Profil bug tuzatildi

**Muammo:** `clinic_admin` sidebar'dan "Qabulxona" yoki "Navbat" bosganida `admin/(panel)` layout'dan chiqib ketib, sidebar yo'qolardi. `/doctor/profile` — admin uchun "Forbidden" banneri ko'rinardi. Mobil'da sidebar umuman ko'rinmasdi.

**Ildiz sabab:** `AdminSidebar.tsx` dagi `/reception` va `/doctor` linklari `admin/(panel)` route group'idan tashqariga ishora qilardi → Next.js layout tree almashardi → sidebar unmount bo'lardi.

**Tuzatishlar:**
- `src/components/pages/ReceptionView.tsx` — Yangi: `reception/page.tsx` mazmuni ajratildi, `context?: "standalone"|"admin"` prop
- `src/components/pages/DoctorQueueView.tsx` — Yangi: `doctor/page.tsx` mazmuni ajratildi, `context="admin"` bo'lsa `/api/doctor/profile` chaqirilmaydi
- `src/app/admin/(panel)/reception/page.tsx` — Yangi: `ReceptionView context="admin"` (sidebar saqlanadi)
- `src/app/admin/(panel)/doctor/page.tsx` — Yangi: `DoctorQueueView context="admin"` (sidebar saqlanadi)
- `src/app/reception/page.tsx`, `src/app/doctor/page.tsx` — Thin wrapper (standalone route'lar SAQLANADI)
- `src/components/ui/AdminSidebar.tsx` — href `/reception→/admin/reception`, `/doctor→/admin/doctor`; mobil hamburger drawer qo'shildi (fixed bottom-right ☰ tugmasi + slide-out)
- `src/components/ui/Navbar.tsx` — `getRoleExtraItems`: cross-link href'lar ham `/admin/reception`, `/admin/doctor` ga o'zgartirildi
- `src/app/admin/(panel)/layout.tsx` — `hidden md:block` wrapper olib tashlandi (AdminSidebar o'zi boshqaradi)
- `src/app/doctor/profile/page.tsx` — 403 FORBIDDEN → `router.replace('/admin')` redirect (xom "Forbidden" ko'rsatilmaydi)
- `src/app/admin/(panel)/error.tsx` — Yangi: admin panel error boundary

**Asosiy qoidalar (O'ZGARTIRMA):**
- `/reception` va `/doctor` standalone route'lar SAQLANADI — receptionist va doctor rollari uchun
- `/admin/reception` va `/admin/doctor` — faqat admin uchun, sidebar saqlanadi
- Middleware TEGILMADI — `/admin/*` allaqachon `clinic_admin` uchun ochiq
- API TEGILMADI — RLS xavfsizligi saqlanadi

**Commit:** fix/admin-sidebar-nav-profile → main. Deploy: https://tibtaqvim.vercel.app ✅

---

### 2026-05-31 — DOCTOR-BLOCK: Shifokor darajasida kun bloklash

**Maqsad:** Klinika blokidan (yakshanba/bayram) MUSTAQIL ravishda shifokor darajasida kunlarni bloklash. Bir yo'nalishda 3 shifokor — Dr. Rahimov har shanba kelmaydi → FAQAT u qizil, qolgan 2 shifokor ochiq. Takroriy (haftaning ixtiyoriy kuni, 0-6) va bir martalik (aniq YYYY-MM-DD). 3 rol bloklaydi: shifokor o'zi + qabulxona + admin. 24/7 klinikada ham ishlaydi.

**DB (Supabase migration `doctor_blocked_dates`):**
- Yangi jadval: `doctor_blocked_dates` (id, doctorId FK→CASCADE, type 'recurring'|'once', weekday 0-6?, date TEXT?, reason?, createdBy userId, createdAt)
- CHECK constraintlar: recurring→weekday majburiy, once→date majburiy, weekday 0-6 range
- 3 ta index: doctorId, (type,weekday) WHERE recurring, (type,date) WHERE once
- RLS enabled
- Prisma: `DoctorBlockedDate` model + `Doctor.blockedDates DoctorBlockedDate[]` relation

**Yangi fayllar:**
- `src/app/api/doctors/[id]/schedule/route.ts` — `GET` public → `{ blockedDates, blockedWeekdays }` (web+bot BITTA manba)
- `src/app/api/doctors/[id]/blocked-dates/route.ts` — `GET/POST` (3 rol auth)
- `src/app/api/doctors/[id]/blocked-dates/[blockId]/route.ts` — `DELETE` (3 rol auth)
- `src/components/DoctorBlockedDatesManager.tsx` — Reusable blok boshqaruv komponenti (takroriy weekday + bir martalik sana, delete)

**O'zgartirilgan fayllar:**
- `src/lib/day-block.ts` — 2 yangi funksiya qo'shildi (mavjud O'ZGARMADI): `isDateBlockedForDoctor(doctorId, dateStr)`, `isDateBlockedFull(clinicId, doctorId, dateStr)`
- `src/lib/calendar.ts` — `generateCalendarMatrix` ga 2 yangi ixtiyoriy param: `doctorBlockedDates: string[] = []`, `doctorBlockedWeekdays: number[] = []` (backward compatible)
- `src/lib/services/booking.service.ts:289` — `isDateBlockedForClinic` → `isDateBlockedFull` (1 satr, DOCTOR_BLOCKED 409 kod)
- `bot/helpers/calendar.ts` — `CalendarSettings` interface export + `doctorBlockedDates/Weekdays` params
- `bot/helpers/render.ts` — `mkDateKeyboard/mkDateKeyboardForMonth` CalendarSettings qabul qiladi
- `bot/handlers/callback.ts` — `getDoctorSchedule()` helper + `doc:` handler combined schedule
- `src/components/Calendar.tsx` — `blockedWeekdays?: number[]` prop + `isBlockedCell` shifokor blokini ham ko'rsatadi
- `src/app/webapp/page.tsx` — `doctorSchedule` state + `fetchDoctorSchedule()` + Calendar birlashtirma
- `src/app/webapp/clinics/[id]/branches/[branchId]/page.tsx` — xuddi shunday
- `src/app/doctor/page.tsx` — "Bloklangan kunlar" collapsible section
- `src/app/reception/page.tsx` — Doctor dropdown + DoctorBlockedDatesManager section
- `src/app/admin/doctors/[id]/edit/page.tsx` — DoctorBlockedDatesManager card

**Asosiy qoidalar (O'ZGARTIRMA):**
- `isDateBlocked`, `isDateBlockedForClinic` — mavjud funksiyalar O'ZGARMADI, faqat qo'shimcha
- Shifokor bloki klinika tipidan MUSTAQIL — 24/7 da ham ishlaydi
- Web va bot BITTA endpointdan: `/api/doctors/[id]/schedule`
- Shifokor auth: `doctor.userId === session.userId` (faqat o'ziniki)
- Booking oqimi O'ZGARMADI: xizmat → shifokor → sana tartib saqlanadi

**Commit:** feature/doctor-blocked-dates → main. Deploy: https://tibtaqvim.vercel.app ✅

---

### 2026-05-29 — BROADCAST: Kanal/guruhga broadcast to'liq tizim

**Maqsad:** Bot orqali kanal va guruhlarga avtomatik reklama yuborish tizimini to'liq ishga tushirish. Har klinika o'z kanaliga reklama yuboradi, super_admin boshqaradi.

**Muammo:** `ad_campaign_channels` bo'sh edi — kampaniya `targetType=own` edi lekin kanal `scope=platform` edi, moslashmadi. "Hozir yuborish" tugmasi yo'q edi. clinic_admin broadcast UI yo'q edi.

**Yangi fayllar:**
- `src/app/api/admin/ad-campaigns/[id]/send-now/route.ts` — `POST /api/admin/ad-campaigns/[id]/send-now` (super_admin JWT auth, darhol yuborish, ad_posts yozadi, bot admin tekshiruvi)
- `src/app/admin/(panel)/broadcast/page.tsx` — clinic_admin broadcast sahifasi (2 tab: Kanallarim + Kampaniyalar, kanal ulash modal)

**O'zgartirilgan fayllar:**
- `src/app/admin/super/ads/page.tsx` — "Hozir Yuborish" yashil tugma har kampaniyada; ChannelEditModal (scope/clinicId/holat tahrirlash); bo'sh kanal ogohlantirishi (amber border); SendNowResult modal; kanal "Tahrir" tugmasi
- `src/app/api/admin/ad-channels/route.ts` — clinic_admin ham o'z klinikasi kanallarini ko'ra/qo'sha oladi (scope=clinic, isActive=false — super_admin tasdiqlaydi)
- `src/app/api/admin/ad-channels/[id]/route.ts` — GET endpoint qo'shildi; clinic_admin faqat o'z klinikasi kanalini o'zgartira oladi; super_admin scope/clinicId o'zgartira oladi
- `src/app/api/admin/ad-campaigns/route.ts` — clinic_admin o'z klinikasi kampaniyalarini ko'ra oladi (read-only, GET)
- `src/components/ui/AdminSidebar.tsx` — clinic_admin uchun "Broadcast" → /admin/broadcast; super_admin uchun "Reklamalar" → /admin/super/ads
- `bot/handlers/myChatMember.ts` — Bot kanal/guruhga admin bo'lganda, telegram orqali qo'shgan foydalanuvchi clinic_admin bo'lsa → scope=clinic, clinicId=o'sha admin klinikasi; BOT_ID yo'q bo'lsa getMe() orqali dinamik oladi

**Scope/targetType mantiq'i (muhim):**
- `targetType=own` kampaniyasi → faqat `scope=clinic, clinicId=same clinic` kanallarni tanlaydi
- `targetType=platform` kampaniyasi → faqat `scope=platform` kanallarni tanlaydi
- Eski data muammosi: super_admin ads sahifasida kanal "Tahrir" → scope=clinic + clinicId belgilash orqali tuzatiladi
- clinic_admin qo'shgan kanallar `isActive=false` bo'ladi — super_admin faollashtirishi kerak

**Yangi klinikalar uchun:**
1. Super_admin Reklamalar → Kanallar → "+ Kanal qo'shish" (scope=clinic, clinicId=yangi klinika)
2. Super_admin Kampaniyalar → "+ Kampaniya" (klinika tanlash, kanal belgilash, targetType=own)
3. Vercel cron 0 8 * * * → kuniga bir marta barcha active kampaniyalar yuboriladi
4. "Hozir Yuborish" → darhol test yuborish mumkin

**Commit:** Broadcast tizim — deploy: https://tibtaqvim.vercel.app ✅

---

### 2026-05-28 — FLIP-CARD-01: Shifokor profil kartochkasi 3D flip

**Maqsad:** Bemor webapp'da bron kartochkasini bossanda, kartochka 3D aylanib orqa tomonida shifokor to'liq profili ko'rinsin (MyGov Road pasport kabi).

**DB (Supabase migration `flip_card_doctor_profile`):**
- `doctors` jadvaliga 6 yangi ustun: `education`, `position`, `department`, `workSchedule`, `operationsCount`, `bio`
- 4 yangi jadval (RLS enabled, Prisma service_role bypass):
  - `doctor_specialties` (id, doctorId CASCADE, name, sortOrder)
  - `doctor_directions` (id, doctorId CASCADE, name, sortOrder)
  - `doctor_experiences` (id, doctorId CASCADE, place, startYear, endYear?, sortOrder)
  - `doctor_workplaces` (id, doctorId CASCADE, place, sortOrder)
- Prisma schema yangilandi + `prisma generate` qilindi

**Yangi fayllar:**
- `src/app/api/doctor/profile/route.ts` — `GET/PUT /api/doctor/profile` (shifokor o'z profili)
- `src/app/api/admin/doctors/[id]/profile/route.ts` — `GET/PUT /api/admin/doctors/[id]/profile` (admin)
- `src/app/api/patient/doctor/[id]/profile/route.ts` — `GET /api/patient/doctor/[id]/profile` (public, bemor)
- `src/app/doctor/profile/page.tsx` — Shifokor kabineti profil sahifasi (8 maydon + dinamik ro'yxatlar)
- `src/components/DoctorProfileFields.tsx` — Reusable profil maydonlar komponenti

**O'zgartirilgan fayllar:**
- `src/app/api/webapp/appointments/route.ts` — doctor select'ga profil maydonlari qo'shildi
- `src/app/admin/doctors/[id]/edit/page.tsx` — 8 yangi maydon + DoctorProfileFields integratsiya
- `src/app/doctor/layout.tsx` — "📋 Profil" nav elementi qo'shildi
- `src/app/webapp/page.tsx` — `FlipCard` komponenti (CSS 3D rotateY, old/orqa), `AppointmentDoctor` tipiga profil maydonlar, `BackRow` komponent

**Flip Card arxitekturasi:**
- `FlipCard` komponenti: `perspective: 1000px` + `transform-style: preserve-3d` + `transition: 0.55s`
- Old tomon: xizmat nomi, sana, workSchedule, navbat/slot, shifokor foto, status/tugmalar + ℹ flip tugmasi
- Orqa tomon: gradient fon, shifokor foto (44px), ta'lim, mutaxassisliklar, lavozim, yo'nalishlar, tajriba, ish joylari, bo'lim, operatsiyalar soni, bio + ← orqaga tugmasi
- Profil ma'lumoti yo'q bo'lsa ℹ tugmasi ko'rsatilmaydi

**Qoidalar:**
- `specialty` (String) eski ustun O'CHIRILMADI — yangi `specialties[]` QO'SHIMCHA
- Bo'sh maydonlar orqa tomonda ko'rsatilmaydi
- Tugmalar (Qayta bron, Bekor) faqat old tomonda — flip'da bosilmaydi

**Commit:** `a2b1588` — 11 fayl, +1452/-370. Deploy: https://tibtaqvim.vercel.app ✅

---

### 2026-05-28 — FLIP-CARD-02: BookingFlipCard — barcha bronlarda flip tuzatish

**Maqsad:** FLIP-CARD-01 da yaratinan FlipCard komponentidagi balandlik muammosini tuzatish va barcha bron turlarida bir xil sifatli flip animatsiyani ta'minlash.

**Muammolar tuzatildi:**
- `absolute inset-0` + `minHeight: 220px` → tugmalar kesilishi (`overflow: hidden` klipi) → Variant A: old tomon `relative` (oqimda, balandlik belgilaydi), orqa `absolute inset-0 overflow-y-auto`
- `overflow-hidden` wrapper div o'chirildi — 3D flip CSS perspektiv klip bo'lmasin
- Flip tugmasi FAQAT `hasBackData` bo'lganda emas, shifokor bo'lsa HAR DOIM ko'rsatiladi
- Bo'sh profil uchun chiroyli placeholder: "📋 Shifokor hali ma'lumot kiritmagan"
- Mutaxassisliklar va qabul yo'nalishlari chip/tag formatida (vergul emas)

**Yangi fayl:**
- `src/components/webapp/BookingFlipCard.tsx` — reusable komponent, `BookingAppt` interface export, `Avatar`, `BackField`, `ChipList` ichki komponentlar

**O'zgartirilgan fayllar:**
- `src/app/webapp/page.tsx` — `BookingFlipCard` import, `todayAppts` + `upcomingAppts` ikkalasi ham yangi komponent, eski inline `FlipCard`/`DoctorPhoto`/`BackRow` olib tashlandi, `AppointmentCard` non-compact → `BookingFlipCard`

**Tekshiruv:**
- `tsc --noEmit`: exit 0
- `npm run build`: exit 0
- Deploy commit: `983907a`

**Commit:** `983907a` — 2 fayl, +383/-235. Deploy: https://tibtaqvim.vercel.app ✅

---

### 2026-05-28 — FLIP-CARD-03: Barcha bo'limlarda flip + butun karta bosiladigan

**Maqsad:** FLIP-CARD-02 da yaratilgan `BookingFlipCard` komponentini barcha bron bo'limlariga to'liq qo'llash va butun karta yuzasini bosiladigan qilish.

**Muammolar tuzatildi:**
1. **Tarix bo'limi flip yo'q edi:** `AppointmentCard compact` inline JSX → `BookingFlipCard` ga almashtirildi. Endi barcha 3 bo'lim (bugungi, yaqinlashayotgan, tarix) faqat bitta komponent.
2. **Flip faqat ℹ️ tugmada edi:** Old yuz to'liq `onClick={() => setFlipped(true)}` — rasm, ism, sana, bo'sh joy hammasi bosilsa flip qiladi.
3. **Orqa yuz ham butun yuza bosilganda yopiladi:** `onClick={() => setFlipped(false)}`.

**O'zgartirilgan fayllar:**
- `src/components/webapp/BookingFlipCard.tsx`:
  - Old yuz div: `onClick={() => setFlipped(true)}` + `cursor-pointer active:scale-[0.99] transition-transform`
  - Orqa yuz div: `onClick={() => setFlipped(false)}` + `cursor-pointer`
  - Amal tugmalari `e.stopPropagation()` SAQLANDI — flip bo'lmaydi, tugma o'z funksiyasini bajaradi
- `src/app/webapp/page.tsx`:
  - Tarix bo'limi: `AppointmentCard compact` → `BookingFlipCard`
  - `AppointmentCard` komponenti o'chirildi (to'liq unused)
  - `statusLabels`, `statusStyle`, `formatDate` o'chirildi (unused)

**Qoida (o'zgarmas):**
- BITTA komponent (`BookingFlipCard`) — barcha bron bo'limlari, hamma vaqt
- Kelajakda yangi bo'lim/klinika/shifokor qo'shilsa AVTOMATIK flip ishlaydi
- Amal tugmasi (Qayta bron / Bekor qilish) bosilganda: flip YO'Q + tugma funksiyasi ishlaydi (e.stopPropagation)

**Tekshiruv:**
- `tsc --noEmit`: exit 0
- `npm run build`: exit 0
- `grep AppointmentCard|statusLabels|statusStyle|formatDate page.tsx` → faqat `formatDateLabel` (lib import) — inline kartochka qolmadi

**Commit:** `742bf82` — 2 fayl, +6/-59. Deploy: https://tibtaqvim.vercel.app ✅

---

### 2026-05-28 — SERVICE-PICKER-01: Rasmli xizmat tanlash YAGONA komponent

**Maqsad:** Webapp "Qabulga yozilish → Xizmatni tanlang" ekrani IKKI versiyada render bo'lardi — asosiy flow (page.tsx) rasmli, clinics/[id]/branches/[branchId] rasmsiz. Yagona `ServicePicker` komponentiga birlashtirildi.

**Muammo:** Klassik "kod ikki nusxa" — xizmat tanlash ro'yxati ikki joyda inline JSX sifatida yozilgan edi. Biri (page.tsx) shifokor avatarlarini ko'rsatardi, ikkinchisi (branchId/page.tsx) ko'rsatmasdi.

**Yechim:**
1. `src/components/webapp/ServicePicker.tsx` — yangi YAGONA reusable komponent
   - `Service`, `ServiceDoctor` tiplari export
   - Props: `services`, `loading`, `onSelect`, `userLoading?`
   - doctor.photoUrl bor → `<img class="w-8 h-8 rounded-full">` 
   - doctor.photoUrl yo'q → `<div class="w-8 h-8 rounded-full bg-blue-100">` + ism bosh harfi
   - Bir nechta shifokorli xizmat → hammasi ro'yxat (Mskt 2ta, Nevropatolog 2ta)
2. `src/app/webapp/clinics/[id]/branches/[branchId]/page.tsx` — rasmsiz inline JSX → `<ServicePicker>` (Service type import qilindi, local interface o'chirildi)
3. `src/app/webapp/page.tsx` — rasmli inline JSX → `<ServicePicker>` (userLoading prop bilan)

**API:** `/api/services` allaqachon `doctors[].photoUrl` qaytaradi — o'zgarish yo'q.

**Tekshiruv:**
- `tsc --noEmit`: exit 0
- `npm run build`: exit 0
- Playwright Flow 2 (branchId): 11 photo + 2 fallback ✓
- Playwright Flow 1 (page.tsx): 12 photo + 2 fallback ✓
- LOR O'ktamov (photoUrl null) → "I" fallback (ko'k doira) ✓
- Dietolog Qilichev (photoUrl null) → "R" fallback ✓

**Commit:** `e8a6959` — 3 fayl: +130/-90. Deploy: tibtaqvim-f9yhkpix0-oqiljonplay-ctrls-projects.vercel.app ✅

---

### 2026-05-28 — CLINIC-CURRENT-02: Bot deeplink override tuzatildi (DB tanlovi ustun)

**Muammo:** CLINIC-CURRENT-01 da frontend `initClinic()` URL param `?clinic=...` ni BIRINCHI tekshirardi. Bot HAR xabarga `?clinic=clinic-demo` qo'shadi → har ochilishda BUYUK TABIB ni DB'ga yozib, bemor tanlagan klinikani o'chirardi.

**Root cause:** `initClinic` prioritet tartibi noto'g'ri edi:
- Eski: 1) URL param → 2) localStorage → 3) DB
- To'g'ri: 1) DB (currentClinicId) → 2) URL param faqat yangi user uchun → 3) localStorage

**O'zgartirilgan fayl:** `src/lib/clinic-context.tsx` — faqat `initClinic()` funksiyasi qayta yozildi.

**Yangi mantiq:**
- tgId bor → avval DB'dan `currentClinicId` ol
- `currentClinicId` bor → uni ishlat, URL param'ni butunlay e'tiborsiz qoldur
- `currentClinicId` null (yangi user) → URL param membership'da bo'lsa ishlatib DB'ga yoz
- Membership yo'q → `/webapp/clinics` sahifasiga yo'naltir
- tgId yo'q (brauzerda to'g'ri kirgan) → URL param → localStorage

**Diagnostik natija:** `GET /api/me/clinics?tgid=986660442` → `currentClinicId: "cmpay6dn80002l504rr8qez3t"` (Test klinika) ✅

**Tekshiruv:**
- `tsc --noEmit`: exit 0 ✅
- `next build`: exit 0 ✅
- API test real user 986660442: currentClinicId = Test klinika ✅
- Vercel runtime errors: 0 ✅

**Commit:** `c28e3b7` — 1 fayl: +67/-29. Deploy: https://tibtaqvim.vercel.app ✅

---

### 2026-05-28 — CLINIC-CURRENT-01: Tanlangan klinikani DB'da doimiy saqlash

**Maqsad:** Bemor "Mening klinikalarim"dan klinika tanlaganda, sessiya, qurilma, brauzer keshi o'zgarganda ham HALI HAM o'sha klinika ko'rinishi. Ilgari: tanlov faqat `localStorage`'da edi — boshqa qurilmada yo'qolardi.

**Muammo:** `user_clinics` jadvalida "hozir aktiv qaysi klinika" tushunchasi yo'q edi. `setClinic` faqat `localStorage.setItem` qilardi — server-side hech narsa yo'q.

**Yechim:**
1. `prisma/schema.prisma` — `UserClinic` ga `isCurrent Boolean @default(false)` va `lastSelectedAt DateTime?` qo'shildi; `@@index([userId, isCurrent])`
2. `prisma/migrations/20260528000002_user_clinic_is_current/migration.sql`:
   - `ALTER TABLE "user_clinics" ADD COLUMN "isCurrent" / "lastSelectedAt"`
   - `CREATE UNIQUE INDEX user_clinics_one_current_per_user ON user_clinics("userId") WHERE "isCurrent" = true` — DB kafolat
   - Data migration: mavjud 12 user uchun `isCurrent=true` belgilandi
3. `src/app/api/webapp/clinics/[id]/select/route.ts` — yangi endpoint:
   - `POST /api/webapp/clinics/[id]/select?tgid=...`
   - Transaction: `updateMany isCurrent=false` → `update isCurrent=true, lastSelectedAt=now()`
   - User membership yo'q bo'lsa — `upsert` bilan yaratadi
4. `src/app/api/me/clinics/route.ts` — `currentClinicId` qaytaradi (isCurrent=true dan); tartiblash: isCurrent → lastSelectedAt → joinedAt
5. `src/lib/clinic-context.tsx`:
   - `setClinic`: `persistToDb(id)` — fire-and-forget `/api/webapp/clinics/[id]/select` chaqiradi
   - `initClinic` URL param path: bot deeplink ham `persistToDb` chaqiradi
   - `initClinic` step 3: `currentClinicId` (yangi) → `lastClinicId` (backward compat)

**Bot deeplink qoidasi:**
- `?clinic=xxx` + tgId bor → DB'ga ham saqlaydi (intentional switch)
- URL param yo'q → DB'dagi `isCurrent=true` ishlatiladi
- Boshqa qurilma → DB'dan o'qiydi — HALI HAM o'sha klinika

**Muddat siyosati:** `lastSelectedAt` ustuni tayyor — hozircha cheksiz saqlanadi. Kelajakda "6 oy o'tsa qayta so'rash" qo'shiladi.

**Tekshiruv:**
- Supabase migration: ✅ partial unique index + 12 ta data migration
- `tsc --noEmit`: exit 0 ✅
- `next build`: exit 0 ✅
- `GET /api/me/clinics?tgid=1864788322` → `currentClinicId: "clinic-demo"` ✅
- Vercel runtime errors: 0 ✅

**Commit:** `5629d65` — 5 fayl: +146/-35. Deploy: https://tibtaqvim.vercel.app ✅

---

### 2026-05-28 — SERVICE-BRANCH-01: Xizmat-filial qat'iy bog'lash

**Maqsad:** Admin "yo'q" deydi, bot "bor" deydi — noizchillikni bartaraf etish. "Bir manba, bir haqiqat" qoidasi.

**O'zgartirilgan fayllar:**
- `bot/api.ts` — `fetchServices(clinicId, date?, branchId?)` — branchId parametr qo'shildi, URLga set qilinadi
- `bot/handlers/clinicFlow.ts:72` — `fetchServices(clinicId, today, branchId)` — filial tanlangach branchId uzatiladi
- `src/app/api/services/route.ts` — `OR [{branchId}, {branchId:null}]` → faqat `{branchId}` (null/global xizmatlar botda ko'rinmaydi)
- `src/app/admin/(panel)/services/page.tsx` — yangi xizmat yaratishda filial dropdown MAJBURIY (`required`, "— Filial tanlang —" placeholder); tahrirlashda bo'sh qoldirishga ruxsat lekin amber ogohlantirish
- `src/app/admin/(panel)/branches/page.tsx` — placeholder: "Asosiy filial" → "Bosh filial"
- `src/app/api/admin/super/clinics/route.ts` — yangi klinika yaratilganda default branch nomi: "Asosiy filial" → "Bosh filial"

**Qoida (o'zgarmas):**
- `branchId=NULL` xizmatlar DB da saqlanib qoladi — admin qo'lda filialga bog'laydi
- Bot NULL xizmatlarni KO'RSATMAYDI (branchId filteri strict)
- Admin filial bog'langach bot darhol ko'rsatadi
- Login/auth/bron logikasi tegilmadi

**Commit:** `e8a3666` — 6 fayl. Deploy: https://tibtaqvim.vercel.app ✅

---

### 2026-05-19 — Faza 5: Appointment History + UserClinic M2M

**Maqsad:** Bemor o'z bron tarixini ko'ra olishi — "Shu klinika" va "Barcha klinikalar" tablari bilan.

**DB (Supabase MCP via DDL):**
- Yangi `user_clinics` table: `id, userId, clinicId, role, joinedAt, isActive`
- `@@unique([userId, clinicId])` — duplikat yo'q
- FK: `userId → users.id CASCADE`, `clinicId → clinics.id CASCADE`
- Seed: `prisma/seed-user-clinics.ts` — 10 ta row backfill qilindi (7 from users.clinicId + 3 from appointments)
- Schema: `prisma/schema.prisma` — `UserClinic` model + User/Clinic reverse relations qo'shildi

**Yangi fayllar:**
- `src/lib/user-clinics.ts` — `ensureUserClinic(userId, clinicId, role)` idempotent upsert + `getUserAllClinicIds()`
- `src/app/api/me/appointments/route.ts` — `GET /api/me/appointments`
  - Query: `telegramId`, `scope` (current/all), `clinicId`, `status`, `dateFrom`, `dateTo`, `sort`, `cursor`
  - tibId/phone orqali related user IDlarni topadi
  - Cursor pagination (20 per page)
  - Include: clinic, branch, service, doctor, slot
- `src/app/webapp/history/page.tsx` — `/webapp/history` sahifasi
  - 2 tab: "Shu klinika" (default) / "Barcha klinikalar"
  - Loading skeleton, empty state, error state
  - "Yana yuklash" tugmasi (cursor pagination)
  - Back ← tugmasi (dashboard'ga qaytadi)
- `src/app/webapp/history/HistoryFilters.tsx` — collapsible filter panel
  - 4 status: booked/arrived/missed/cancelled
  - Sana oralig'i: dateFrom/dateTo
  - Sort: yangi→eski / eski→yangi
  - "Tozalash" tugmasi
- `src/components/webapp/AppointmentCard.tsx` — reusable karta
  - `showClinic` prop: "Barcha" tabida klinika logo+nomi tepada, "Shu" tabida yo'q
  - date + slot.startTime/endTime, queueNumber, service, doctor, price, branch

**O'zgartirilgan fayllar:**
- `src/lib/services/booking.service.ts` — `linkUserToAppointment()` endi `ensureUserClinic()` ham chaqiradi
- `src/app/webapp/page.tsx` — sticky bottom bar'ga "📋 Tarix" tugmasi qo'shildi (URL'da tgid+clinic parametrlarini saqlaydi)

**Commit:** `bb60064` — 10 fayl, +796/-10

---

### 2026-05-19 — Faza 4: Webapp Clinic Selector + Global Context + ClinicSwitcher

**Maqsad:** Webapp'da klinika tanlashni global state'ga o'tkazish — URL param, localStorage, API fallback.

**Yangi fayllar:**
- `src/lib/clinic-context.tsx` — `ClinicProvider` context: URL param (`?clinic=`) > localStorage (`tibtaqvim_clinic`) > `/api/me/clinics` API fallback; `useClinic()` hook
- `src/components/webapp/ClinicGuard.tsx` — `clinicId` yo'q bo'lsa `/webapp/select-clinic` ga redirect
- `src/components/webapp/ClinicSwitcher.tsx` — 40px `ClinicLogo` + chevron; BottomSheet'da user klinikalari ro'yxati bilan klinika almashtirish
- `src/app/webapp/select-clinic/page.tsx` — qidiriladigan klinika ro'yxati, `ClinicLogo` 64px, tanlash → `setClinic()` → dashboard'ga redirect
- `src/app/api/me/clinics/route.ts` — `GET /api/me/clinics?tgid=` — foydalanuvchi avval bron qilgan klinikalar (appointment history'dan)

**O'zgartirilgan fayllar:**
- `src/app/webapp/layout.tsx` — `<Suspense>` + `<ClinicProvider>` + `<ClinicGuard>` wrapper
- `src/app/webapp/page.tsx` — `useClinic()` context'dan clinicId; header'da `ClinicSwitcher`

**Qanday ishlaydi:**
- Birinchi kirish → `?clinic=` URL param yo'q → `/webapp/select-clinic` → tanlash → localStorage'ga yoziladi
- Bot deeplink `?clinic=clinic-demo` yoki `?clinicId=clinic-demo` — ikkalasi ham ishlaydi (backward compat)
- Refresh → localStorage'dan eslab qoladi, API so'rovi yo'q
- `ClinicSwitcher` → "Mening klinikalarim" (appointment history'dan) yoki barcha klinikalar

**Commit:** `aea3fd5` — 7 fayl, +660/-29

---

### 2026-05-19 — Faza 3: Filial CRUD + branch_admin roli

**Maqsad:** Super_admin klinika filiallari bilan ishlashi, har filialni boshqarish uchun branch_admin tayinlashi.

**DB (Supabase MCP migration):**
- `UserRole` enum'ga `branch_admin` qo'shildi
- `users.branchId` column + FK (`branches.id CASCADE`) + index

**Yangi backend fayllar:**
- `src/lib/permissions.ts` — `canManageClinic()`, `canManageBranch()`, `canCreateBranchAdmin()`, `sessionUser()` helper
- `src/lib/admin-username.ts` — `generateBranchAdminUsername()` → `tib_badmin_xxxxxx` format
- `src/lib/auth.ts` — `JwtPayload.branchId` qo'shildi; login'da `branch_admin` pattern + branchId JWT'ga
- `src/app/api/admin/clinics/[id]/branches/route.ts` — `GET /api/admin/clinics/[id]/branches`, `POST`
- `src/app/api/admin/clinics/[id]/branches/[branchId]/route.ts` — `GET`, `PATCH`, `DELETE` (soft delete + cascade admins)
- `src/app/api/admin/clinics/[id]/branches/[branchId]/admins/route.ts` — `GET`, `POST` (credentials)
- `src/app/api/admin/clinics/[id]/branches/[branchId]/admins/[adminId]/route.ts` — `PATCH`, `DELETE`

**Yangi frontend fayllar:**
- Klinika detail sahifasida yangi "Filiallar 🏥" tab
- `src/app/admin/super/clinics/[id]/BranchesTab.tsx` — filiallar ro'yxati, toggle, "Boshqarish" link
- `src/app/admin/super/clinics/[id]/CreateBranchModal.tsx` — yangi filial yaratish modali
- `src/app/admin/super/clinics/[id]/branches/[branchId]/page.tsx` — filial detail: Info / Adminlar tabs
- `src/app/admin/super/clinics/[id]/branches/[branchId]/BranchInfoTab.tsx` — view/edit
- `src/app/admin/super/clinics/[id]/branches/[branchId]/BranchAdminsTab.tsx` — admin CRUD + credentials banner
- `src/app/admin/super/clinics/[id]/branches/[branchId]/CreateBranchAdminModal.tsx`
- `src/app/admin/super/clinics/[id]/ResetPasswordModal.tsx` — `apiUrl` prop bilan generic (qayta ishlatildi)

**Audit log:** `branch.create`, `branch.update`, `branch.delete`, `branch_admin.create`, `branch_admin.update`, `branch_admin.reset_password`, `branch_admin.delete`

**Soft delete:** `branch.delete` → `$transaction`: `isActive=false` + barcha `branch_admin`larni `isActive=false`

**Commit:** `4dc06fb` — 13 fayl, +1086/-16

---

### 2026-05-19 — Faza 2: Klinika Adminlari CRUD

**Maqsad:** Super_admin har klinikaga clinic_admin yaratishi, parolini reset qilishi, o'chirishi.

**DB (Supabase MCP migration):**
- `users.username` column — `text UNIQUE nullable` + index (`20260519000001_add_username_to_users`)

**Yangi backend fayllar:**
- `src/lib/admin-username.ts` — `generateClinicAdminUsername()` → `tib_admin_xxxxxx` (unique loop check)
- `src/lib/auth.ts` — `validatePasswordStrength()` (harf+raqam, min 8), `generateRandomPassword()` (12 ta random char)
- `src/app/api/admin/super/clinics/[id]/admins/route.ts` — `GET` (ro'yxat), `POST` (yaratish, credentials qaytaradi)
- `src/app/api/admin/super/clinics/[id]/admins/[adminId]/route.ts` — `PATCH` (tahrirlash + parol reset), `DELETE` (soft delete)
- `src/app/api/auth/login/route.ts` — `identifier` maydoni: username YOKI phone bilan login

**Yangi frontend fayllar:**
- `src/app/login/page.tsx` — `phone` field → `identifier` field (username yoki telefon)
- `src/app/admin/super/clinics/[id]/AdminsTab.tsx` — adminlar jadval ko'rinishi, credentials banner, reset tugmasi
- `src/app/admin/super/clinics/[id]/CreateAdminModal.tsx` — auto/manual parol, credentials display (1 martacha)
- `src/app/admin/super/clinics/[id]/ResetPasswordModal.tsx` — parol reset modali
- `src/app/admin/super/clinics/[id]/page.tsx` — "Adminlar 👤" tab qo'shildi

**Audit log:** `admin.create`, `admin.update`, `admin.reset_password`, `admin.delete`

**Commit:** `562cc68` — 10 fayl, +526/-35

---

### 2026-05-19 — Faza 1: Klinika Edit Bug Fix + Logo URL

**Maqsad:** Super admin klinikani to'liq tahrirlashi + logo URL qo'shish.

**Bug:** Avvalgi `PATCH /api/admin/super/clinics/[id]` faqat `name/phone/address/isActive` saqlardi. `city`, `description`, `workingHours`, `logoUrl` e'tiborga olinmasdi.

**O'zgartirilgan fayllar:**
- `src/app/api/admin/super/clinics/[id]/route.ts` — `PATCH`: `city`, `description`, `workingHours`, `logoUrl` qo'shildi; `logoUrl` regex validatsiya (`https://….(jpg|png|webp|svg|gif)`)
- `src/app/api/admin/super/clinics/route.ts` — `GET` select'ga `logoUrl` qo'shildi
- `src/app/admin/super/clinics/page.tsx` — 44px `ClinicLogo` + "Tahrirlash" tugmasi har qatorda

**Yangi fayllar:**
- `src/app/admin/super/clinics/[id]/edit/page.tsx` — to'liq edit sahifasi: logo preview (onError fallback), barcha maydonlar, isActive toggle, success toast + redirect
- `src/components/ClinicLogo.tsx` — reusable komponent: `size` prop, `onError` → `useState` fallback emoji `🏥`

**Commit:** `c83d5ed` — 5 fayl, +346/-17

---

### 2026-05-18 — Multi-Clinic Foundation (Bosqich 1)

**Maqsad:** Bir nechta klinikani bitta platformada qo'llab-quvvatlash — bot/webapp'da klinika va filial tanlash, super_admin CRUD, subscription/trial mexanizmi.

**DB migration (`prisma/migrations/20260518000001_multiclinic_foundation`):**
- Yangi enum'lar: `SubscriptionPlan` (starter/standard/premium), `SubscriptionStatus` (trial/active/past_due/suspended/cancelled)
- `Clinic` yangi maydonlar: `description`, `city`, `workingHours`, `rating`, `ratingCount`, `paymentConfig` (JsonB, kelajak to'lov), `subscriptionPlan`, `subscriptionStatus`, `subscriptionExpiresAt`
- `Branch` yangi maydonlar: `latitude`, `longitude`, `nearbyMetro`, `workingHours`, `sortOrder`
- Mavjud klinika backward compat update: `city='Toshkent'`, `subscriptionPlan='premium'`, `subscriptionStatus='active'`, `subscriptionExpiresAt=+1year`
- Apply usuli: `prisma migrate deploy` (shadow DB yo'q — mavjud custom function bilan mos keladi)

**Yangi API endpoint'lar (public):**
- `GET /api/clinics` — filtr: city, search, limit, offset; faqat isActive+non-deleted+trial/active
- `GET /api/clinics/[id]` — klinika detail + branch list
- `GET /api/clinics/[id]/branches` — faol filiallar (sortOrder, name tartibida)

**Admin API endpoint'lar:**
- `GET/POST /api/admin/branches` — clinic_admin o'z klinikasi, super_admin ?clinicId= bilan
- `GET/PATCH/DELETE /api/admin/branches/[id]` — soft delete (isActive=false)
- `POST /api/admin/super/clinics` — endi `$transaction` ichida: klinika + "Asosiy filial" + clinicSettings yaratadi; 14 kunlik trial; `subscriptionPlan=starter`, `subscriptionStatus=trial`

**Admin UI:**
- `/admin/branches` — filial CRUD sahifasi (jadval + modal form)
- `src/app/admin/layout.tsx` — "Filiallar" nav elementi qo'shildi
- `/admin/super/clinics` — shahar, trial/active badge, yangi maydonlar create formida

**Webapp (3 yangi sahifa):**
- `/webapp/clinics` — klinika ro'yxati (qidiruv, rating, reyting, branchCount, doctorCount)
- `/webapp/clinics/[id]` — klinika detail + filial tanlash; 1 ta filial → auto-redirect
- `/webapp/clinics/[id]/branches/[branchId]` — to'liq booking flow (clinicId+branchId scoped)
- `sessionStorage`: `selectedClinicId`, `selectedBranchId` saqlanadi

**Bot flow (yangi fayllar):**
- `bot/handlers/clinicFlow.ts` (YANGI):
  - `showBranchOrService()` — 1 filial → auto-skip; ko'p filial → `mkBranchKeyboard`
  - `showServiceSelection()` — `fetchServices(clinicId, today)` chaqiradi
  - `handleClinicCallback()` — `clinic:` tugmasi handler
  - `handleBranchCallback()` — `branch:` tugmasi handler
  - `handleBackToClinic()` — `back:select_clinic` handler
- `bot/handlers/start.ts` — klinikalar DB'dan olinadi; 1 klinika → auto-skip; ko'p → `mkClinicKeyboard`
- `bot/handlers/callback.ts` — `clinic:`, `branch:`, `back:select_clinic` handler'lar qo'shildi; `use_saved`/`change_info` klinika state'ni saqlaydi
- `bot/helpers/render.ts` — `mkClinicKeyboard()`, `mkBranchKeyboard()` qo'shildi

**Doctors API yaxshilanishi:**
- `POST /api/admin/doctors` — branchId ko'rsatilmasa avtomatik birinchi faol branchni oladi
- `PATCH /api/admin/doctors/[id]` — servislar qayta bog'langanda `queueMode` saqlanadi

**Auto-skip qoidasi:**
- 1 klinika → klinika tanlash o'tkazib yuboriladi
- 1 filial → filial tanlash o'tkazib yuboriladi
- Bu mavjud foydalanuvchilarga ta'sir qilmaydi (transparently skip)

**Commit:** `f0fbc27` — 21 fayl, +1799/-105

---

### 2026-05-17 — Phase 0 Technical Debt Cleanup

**Maqsad:** Real klinika va multi-clinic SaaS uchun mustahkam poydevor. Hech qanday foydalanuvchi-yuzli o'zgarish yo'q — faqat ichki tozalik.

**O'zgartirilgan fayllar:**

1. **`prisma/migrations/20260517000001_revoke_audit_function_public_execute/migration.sql`** (YANGI)
   - `log_audit_event()` funksiyasidan PUBLIC/anon/authenticated EXECUTE huquqi olib tashlandi
   - SECURITY DEFINER saqlandi (trigger uchun zarur)
   - Tashqaridan PostgREST orqali chaqirib bo'lmaydi
   - Triggerlar DB ichidan chaqirgani uchun ishlayveradi

2. **`prisma/migrations/20260517000002_function_search_path_hardening/migration.sql`** (YANGI)
   - 6 ta funksiyaga `SET search_path = public, pg_catalog` qo'shildi
   - `next_tib_id`, `generate_tib_id`, `assign_tib_id_on_insert`
   - `cleanup_expired_bot_states`, `update_bot_states_updated_at`
   - `log_audit_event` (SECURITY DEFINER saqlandi)
   - Funksiya logikasi o'zgarmagan
   - search_path injection himoyasi (PostgreSQL best practice)

3. **`.env.example`** (UPDATED)
   - 3 ta yetishmagan variable qo'shildi:
     - `DIRECT_URL` (Prisma migration uchun direct connection)
     - `TELEGRAM_WEBHOOK_SECRET` (webhook X-header validation)
     - `SUPERADMIN_KEY` (sa_key cookie, /admin/super gate)
   - `JWT_EXPIRES_IN` default `"7d"` → `"24h"` (security audit bilan mos)
   - `DATABASE_URL` pgbouncer formati ko'rsatildi
   - Har biriga generatsiya komandasi qo'shildi

4. **`src/app/api/health/route.ts`** (UPDATED)
   - Default `GET /api/health` — db, env check, region, uptime (backward compatible)
   - `?verbose=1` — webhook holati (`getWebhookInfo`), `bot_states` active count, oxirgi appointment vaqti
   - Har tekshiruv timeout bilan (DB 2s, Telegram 3s)
   - Sensitive qiymatlar chiqmaydi
   - `status: "ok" | "degraded"` indikator

**Muhim qoidalar:**
- Hech qanday foydalanuvchi-yuzli xulq-atvor o'zgarmadi
- Bot, WebApp, admin, doctor, reception — barchasi xuddi oldingidek ishlaydi
- Migration fayllar Supabase MCP orqali apply qilindi (Vercel build paytida `prisma migrate deploy` EMAS)
- `.env.example` o'zgarishi `.env` real faylga ta'sir qilmaydi
- `/api/health` yangi `verbose` parametri ixtiyoriy — eski monitoring uchun backward compatible

**Supabase Security Advisor natijasi (Phase 0 dan keyin):**
- `anon_security_definer_function_executable` (log_audit_event) — ❌ → ✅
- `authenticated_security_definer_function_executable` (log_audit_event) — ❌ → ✅
- `function_search_path_mutable` (6 funksiya) — ❌ → ✅
- `rls_enabled_no_policy` (15 jadval) — qoldirildi (Phase 4 — RLS Policy Pack)

---

### 2026-05-15 — Queue Mode System Phase 1 (live/online/slot-disabled)

**Maqsad:** Har service-doctor bog'lanishi uchun 3 xil navbat rejimi. `live` = kassadan jonli navbat, `online` = onlayn raqam, `slot` = disabled (bosqich 2).

**O'zgartirilgan fayllar:**
- `prisma/schema.prisma` — `QueueMode` enum; `Service.defaultQueueMode`; `ServiceDoctor.queueMode`; `Appointment.queueMode + paymentStatus`
- `src/lib/services/booking.service.ts` — `processBooking` queueMode aniqlab `bookDoctorQueue`ga uzatadi; `live`→queueNumber=null,paymentStatus=pending; `online`→joriy xulq-atvor; `slot`→400
- `src/lib/services/confirmation.service.ts` — `queueMode` param: live→kassadan navbat oling; online→navbat# ko'rsatiladi
- `src/app/api/admin/doctors/route.ts` & `[id]/route.ts` — GET `queueMode` qaytaradi; PATCH `serviceQueueModes` qabul qiladi
- `src/app/api/services/route.ts` — `defaultQueueMode` va per-doctor `queueMode` qaytaradi
- `src/app/api/webapp/appointments/route.ts` — `queueMode`, `paymentStatus` select'ga qo'shildi
- `src/app/admin/doctors/page.tsx` — `QueueModeSelector` (live/online radio, slot=disabled) + "Rejimlarni saqlash" tugmasi
- `bot/handlers/callback.ts` — confirm handler: `live`→"kassadan jonli navbat"; `online`→navbat raqami
- `src/app/webapp/page.tsx` — appointment badge (amber=live, blue=online#); date step'da mode info blok

**Muhim qoidalar:**
- `QueueMode` enum DB'da allaqachon bor edi (oldingi sessiyadan); migration drift bor — `prisma db push` o'rniga Supabase MCP `apply_migration` ishlatildi
- Mavjud bronlar `queueMode=online` (default) oldi — hech narsa buzilmadi
- `processBooking()` transaction tuzilishi o'zgarmadi — faqat `queueMode` parametr qo'shildi

---

### 2026-04-30 — SaaSid.md kritik bug fixlar (requiresSlot, race condition, UTC date)

**O'zgartirilgan fayllar:**
- `bot/handlers/callback.ts`:
  - `svc:` handlerda `serviceRequiresSlot` va `serviceRequiresAddress` state'ga saqlanadi
  - `date:` handlerda `diagnostic` turi: `requiresSlot=false` → slot fetchsiz to'g'ridan ism/confirmga; `requiresSlot=true` + slot yo'q → "bo'sh vaqt yo'q" xabari (avval confirmga yuborar edi → API rad etardi)
  - `confirm` handleri: `userState.delete` bookAppointment'dan KEYIN (avval oldinda edi → double-click "Eskirgan havola" berardi); `step: "booking_in_progress"` guard qo'shildi
- `src/lib/services/booking.service.ts`: `bookingDate = new Date(input.date + "T00:00:00.000Z")` — UTC midnight (@db.Date bug fix)
- `src/app/api/user/register/route.ts`: `prisma.user.create` P2002 (unique constraint) → `resolveUser` qayta chaqirish; yangi `resolveUser()` helper funksiyasi

**Xato sabablari:**
- "bu xizmat uchun uyacha tanlash majburiy" — bot `requiresSlot` flag'ini bilmasdi, `requiresSlot=true` + bo'sh vaqt yo'q bo'lsa confirmga yuborar edi
- "Eskirgan havola" — state booking'dan OLDIN o'chirilardi
- UTC bug — lokal midnight @db.Date bilan mos kelmasdi (local dev'da kritik)
- Concurrent register — P2002 da 500 error qaytarar edi

---

### 2026-04-30 — WebApp Dashboard (botwebUI.md) + tgid URL fallback

**Maqsad:** `/webapp` booking formani takrorlamaslik — bot foydalanuvchilari dashboard ko'rsin.

**Yangi fayllar:**
- `src/app/webapp/layout.tsx` — Telegram WebApp SDK `beforeInteractive` script bilan yuklaydi (`window.Telegram.WebApp`)
- `src/app/api/webapp/appointments/route.ts` — `GET ?telegramId=&clinicId=` — JWT'siz, telegramId orqali user topib, patientPhone bo'yicha bronlar qaytaradi
- `src/app/api/webapp/cancel/route.ts` — `POST {appointmentId, telegramId}` — `appointment.patientPhone === user.phone` tekshirib bekor qiladi (403 bo'lmasa)

**O'zgartirilgan fayllar:**
- `src/app/webapp/page.tsx` — to'liq qayta yozildi: `AppMode = "loading"|"dashboard"|"booking"` state machine; dashboard: tibId header, bugungi qabul (navbat raqami), kelgusi bronlar, tarix, qayta bron, bekor qilish; booking: mavjud flow saqlanib qoldi
- `bot/helpers/render.ts` — `webAppUrl(chatId?)` → `?clinicId=&tgid=<chatId>` formatida URL (tgid SDK fallback)
- `bot/handlers/start.ts` — `mkWebAppReplyKeyboard(chatId)` ga chatId uzatiladi

**Routing logikasi (MUHIM):**
```
telegramId (SDK yoki URL ?tgid=) topildi
  → /api/user/by-telegram → topildi → dashboard
  → topilmadi → /api/user/register (auto-register) → dashboard
telegramId yo'q (brauzerda tg'ridan ochilgan, tgid ham yo'q)
  → booking flow
```

**Auto-register:** Har qanday Telegram user WebApp'ni ochganda DB'ga yoziladi (phone kerak emas). Shu sababli bot `/start` bossmasdan ham WebApp ishlatgan user dashboard ko'radi.

**tgid URL param:** Bot `&tgid=<chatId>` ni WebApp URL'ga qo'shadi. Telegram Desktop / ba'zi client'larda `window.Telegram.WebApp.initDataUnsafe` bo'sh kelsa, URL'dan olinadi.

**Cancel xavfsizligi:** `patientPhone !== user.phone` → 403. Status `booked` bo'lmasa → descriptive xato.

**Yangi API endpoint'lar:**
- `GET /api/webapp/appointments?telegramId=&clinicId=` — dashboard bronlar (JWT yo'q)
- `POST /api/webapp/cancel {appointmentId, telegramId}` — bekor qilish (JWT yo'q, phone check bor)

**Admin stats fix (bir session'da):**
- `src/app/api/admin/stats/route.ts` — `@db.Date` bilan mos kelish uchun `new Date(new Date().toISOString().split("T")[0])` (avval lokal midnight edi)
- `.env` — `DATABASE_URL` ga `?pgbouncer=true` qo'shildi (Supabase pgBouncer transaction mode'da parallel query'lar xato berardi — `26000: prepared statement does not exist`)
- `src/app/api/health/route.ts` — `$queryRaw` → `$queryRawUnsafe("SELECT 1")` (pgBouncer muammosi)

---

### 2026-04-29 — Unified User Resolution (bot ↔ WebApp bir xil tibId)
**Muammo:** Bot va WebApp mustaqil user yaratar edi — bir foydalanuvchi ikki xil tibId olardi.
**O'zgartirilgan fayllar:**
- `src/app/api/user/register/route.ts` — phone endi ixtiyoriy (telegramId bo'lsa yetarli); ketma-ket qidiruv: `findUnique(telegramId)` → `findFirst(phone)` → `create`; `hasPhone` field qaytariladi
- `src/app/api/user/by-telegram/route.ts` — phone bo'lmagan userlarni ham qaytaradi (avval `!user.phone` check bor edi → 404 berardi); `hasPhone` field qo'shildi
- `bot/api.ts` — `registerUserAtStart(telegramId, firstName)` yangi funksiya: /start da, booking'dan oldin, faqat telegramId+firstName bilan user yaratadi
- `bot/handlers/start.ts` — `registerUserAtStart` parallel chaqiriladi (`Promise.all`): user /start bosgunida DB'ga tushadi, WebApp ochilganda topiladi
- `src/app/webapp/page.tsx` — `getTelegramId()`: `initDataUnsafe.user.id` + `initData` string fallback; `getTelegramFirstName()` bir xil fallback; `goAfterDateSlot()`: `tgUser?.hasPhone` → `confirm` (form'ni o'tkazib yuboradi) yoki `form`; form step: name allaqachon bo'lsa faqat telefon so'raladi

**Oqim (yangi):**
```
/start → registerUserAtStart (telegramId+firstName, phone yo'q)
WebApp ochilish → by-telegram → bir xil user topildi → bir xil tibId
Phone kiritilganda → /api/user/register → phone qo'shildi (update), tibId o'zgarmadi
```

**Muhim qoidalar:**
- tibId HECH QACHON o'zgarmaydi — yangi user yaratilmaydi, mavjud update qilinadi
- Ketma-ket qidiruv majburiy: telegramId → phone → create (OR lookup emas!)
- Bot /start'da ro'yxatdan o'tkazish WebApp uchun sharoit yaratadi (pre-registration)

---

### 2026-04-29 — tibId Global Identity Integration (barcha qatlamlar)
**Nima o'zgardi:** tibId barcha qatlamlarda ko'rinadigan qilindi. Bot ↔ WebApp bir xil foydalanuvchini ifodalaydi. Takroriy user yaratish bartaraf qilindi.
**O'zgartirilgan fayllar:**
- `src/lib/validators/booking.ts` — `BookingInput.userId?: string` qo'shildi
- `src/lib/services/booking.service.ts` — `linkUserToAppointment()` qo'shildi: har bron yaratilgandan keyin phone orqali user topib `appointment.userId` ga bog'laydi (background)
- `src/lib/services/appointment.service.ts` — `getAppointments()` → `user: { select: { tibId: true } }` include qilindi
- `src/app/webapp/page.tsx` — Telegram `initDataUnsafe.user.id` → `/api/user/by-telegram` → user pre-fill + tibId; submit'da `/api/user/register` (getOrCreate) → tibId; header'da `🆔 tib000123` (doim ko'rinadigan); done screen'da tibId
- `src/app/doctor/page.tsx` — `Appointment.user.tibId` field; `AppointmentCard`'da `🆔 tibId` ko'rsatiladi
- `src/app/reception/page.tsx` — `Appointment.user.tibId` field; jadvalga `🆔 ID` ustun (md+ ekranlarda); search input (ism/telefon/tibId bo'yicha filterlash)

**Bot (o'zgarishsiz — allaqachon to'g'ri):**
- `registerPatient()` → `/api/user/register` → getOrCreate + tibId
- Tasdiqlash xabarida `🆔 ID: tib000123` allaqachon bor

**Vazifalar taqsimoti:**
- Bot: interaktiv dialog, state machine, user resolve, booking, tasdiqlash xabari
- WebApp: vizual service/sana/slot tanlash, user pre-fill (Telegram initData orqali), booking, tibId ko'rsatish
- Reception/Doctor panel: tibId bo'yicha qidirish, navbat ro'yxatida tibId ustun

**`linkUserToAppointment()` qoidasi:**
- `processBooking()` ichida `result.success` bo'lganda chaqiriladi
- Fire-and-forget — bron bloklanmaydi
- User topilmasa — silent skip

---

## 12.2 2026-05-23 — Payment Workflow: Qabulxona/Shifokor Mas'uliyat Ajratish

**Maqsad:** Qabulxona (to'lov) + Shifokor (muolaja) ikki bosqichli workflow. Takror tugmalar yo'q.

**Oqim:**
```
BEMOR bron qiladi → paymentStatus: pending
QABULXONA "To'ladi" → paymentStatus: paid
SHIFOKOR faqat paid bemorlarni ko'radi → "Keldi"/"Kelmadi"
```

**DB o'zgarishlar:**
- `appointments.paymentStatus` default: `not_required` → `pending` (Supabase migration)
- `CHECK constraint`: faqat `not_required|pending|paid|cancelled` qiymatlar
- 2 yangi index: `appointments_payment_date_idx`, `appointments_doctor_workflow_idx`
- Legacy 6 ta bron (arrived+not_required) — tegilmadi

**Yangi fayllar:**
- `src/lib/workflow/appointment-workflow.ts` — markaziy: `markAsPaid`, `markAsUnpaid`, `cancelAppointment`, `markAsArrived`, `markAsMissed`, `resetToBooked`
- `src/app/api/reception/appointments/route.ts` — GET: 2 bo'lim (pending + paid)
- `src/app/api/reception/appointments/[id]/payment/route.ts` — PATCH: paid/unpaid/cancel
- `src/app/api/doctor/appointments/route.ts` — GET: faqat paid, xizmat bo'yicha grouped
- `src/app/api/doctor/appointments/[id]/attendance/route.ts` — PATCH: arrived/missed/reset

**O'zgartirilgan fayllar:**
- `src/app/reception/page.tsx` — to'lov nazorati: 🟡 Kutilmoqda / 🟢 To'langan bo'limlari
- `src/app/doctor/page.tsx` — xizmat orolchalari, Keldi/Kelmadi, per-island chop/PDF
- `src/lib/services/booking.service.ts` — `online` mode: `not_required` → `pending`
- `next.config.mjs` — webpack alias: `canvg/html2canvas/dompurify = false` (jspdf SSR fix)
- `prisma/schema.prisma` — `paymentStatus @default("pending")`

**Paket:** `jspdf + jspdf-autotable` qo'shildi (client-side PDF, dynamic import)

**Kelajak:** `markAsPaid(id, clinicId, 'payme'/'click')` — webhook integratsiya uchun tayyor zamin.

**Commit:** `a86df8a` — 12 fayl. Deploy: https://tibtaqvim.vercel.app ✅

---

## 12.0 2026-05-22 — Branch Isolation S1-S4 (services.branchId + 3-level scope)

**Maqsad:** Bosh ofis va filiallar mustaqil — har admin faqat o'z darajasini ko'radi.

**Arxitektura:** `branchId=NULL` → bosh ofis; `branchId=X` → filial.
Scope: `super_admin`=barcha; `clinic_admin`=branchId=null; `branch_admin`=o'z filiali.

**DB (S1):** `services.branchId` nullable + FK + index. Migration: `20260522121640_add_service_branch_id`.
**Data (S2):** 7 shifokor + 10 xizmat + 40 bron → `branchId=NULL`. KAMALAK bo'sh qoldi.

**Yangi fayl:** `src/lib/branch-scope.ts` — `getBranchScope`, `resolveBranchIdForCreate`, `canCreate*`, `canManageResources`

**API (S3):** services, doctors, stats, branches, staff — GET+POST scope. `[id]` PATCH+DELETE: branch_admin own-branch check.
**UI (S4):** "Filiallar" tab branch_admin uchun yashirin. "Yangi filial" tugmasi faqat super/clinic_admin. Login: branchId localStorage.

**Commit:** `f22c9fb` — 14 fayl. Deploy: https://tibtaqvim.vercel.app ✅

---

## 12.1 2026-05-19 — Sprint 1: Payment Foundation (Schema Poydevor)

**Maqsad:** To'lov tizimi uchun schema va TypeScript yordamchi fayllar. Hech qanday provider API ishlamaydi — faqat poydevor.

**Prisma schema:**
- Yangi enum'lar: `PaymentProvider` (payme/click), `PaymentState` (pending/authorized/paid/cancelled/failed/refunded/partial_refunded), `RefundState` (pending/succeeded/failed)
- Yangi `Payment` modeli: appointmentId, clinicId, userId, provider, providerTxId, amount (BigInt/tiyin), currency, state, rawCallback, rawCreate, errorCode, paidAt, authorizedAt, cancelledAt
- Yangi `Refund` modeli: paymentId, amount, reason, state, providerRefundId
- Back-relation: `Appointment.payments`, `Clinic.payments`, `User.payments`
- `appointments.paymentStatus` text ustuni O'ZGARMADI (ortga moslik)
- `@@unique([provider, providerTxId])` — idempotency

**Migratsiya:** `20260519000003_add_payment_foundation` — Supabase MCP orqali apply (shadow DB muammosi sababli `prisma migrate dev` ishlamaydi)

**Yangi TypeScript fayllar:**
- `src/lib/payment/config-schema.ts` — `PaymentConfig`, `PaymeConfig`, `ClickConfig` interface'lar; `parsePaymentConfig()`, `validatePaymentConfigOrThrow()`, `isProviderEnabled()` funksiyalari
- `src/lib/payment/secrets.ts` — `encryptSecret()`, `decryptSecret()` (hozir pass-through), `maskSecret()` — Sprint 4 da KMS bilan almashtiriladi
- `src/lib/payment/money.ts` — `sumToTiyin()`, `tiyinToSum()`, `formatSum()`, `decimalSumToTiyin()` — pul BigInt/tiyin formatida
- `src/lib/audit/actions.ts` — `PAYMENT_AUDIT_ACTIONS` const (Sprint 2/3 webhook'larida ishlatiladi)

**Sanity check (Supabase):** `payments` ✅, `refunds` ✅, 3 ta enum ✅, jadvallar bo'sh ✅

**Commit:** `cdfcae8` — 6 fayl, +317

**Keyingi qadam:** Sprint 2 — Payme JSON-RPC integratsiya

---

## 12.2 2026-05-19 — Sprint 2: Payme JSON-RPC Integratsiya

**Maqsad:** Payme Merchant API (JSON-RPC 2.0) to'liq integratsiyasi — sandbox test bilan.

**Yangi fayllar:**
- `src/lib/payment/payme/types.ts` — CheckPerform, CreateTransaction, PerformTransaction, CancelTransaction, CheckTransaction, GetStatement tiplar
- `src/lib/payment/payme/errors.ts` — `PaymeError` class, 12 xato kodi, `toRpcError()`
- `src/lib/payment/payme/handlers.ts` — 6 handler (idempotent, `prisma.auditLog.create`, BigInt tiyin)
- `src/lib/payment/payme/checkout-url.ts` — `buildPaymeCheckoutUrl()` (base64 params, testMode URL)
- `src/app/api/payments/payme/route.ts` — JSON-RPC endpoint, Basic Auth (constant-time), clinicId resolve
- `src/app/api/payments/payme/create-link/route.ts` — Frontend checkout URL generator
- `src/app/webapp/appointments/[id]/pay/page.tsx` — To'lov UI (Payme tugmasi, Sprint 3 da yangilanadi)
- `src/app/api/admin/clinics/[id]/payment-config/route.ts` — GET/PATCH (secretKey masked)

**Sandbox test:** CheckPerform✅, Create✅, Perform✅, Cancel✅, Check✅, Idempotency✅

**Commit:** `1e051a1` — 8 fayl, +780

---

## 12.3 2026-05-19 — Sprint 3: Click Shop API Integratsiya

**Maqsad:** Click Shop API (Prepare/Complete, form-urlencoded) + Webapp yakuniy UI + Bot to'lov tugmasi.

**Click vs Payme farqi:**
- Click = `application/x-www-form-urlencoded` POST (Payme = JSON-RPC)
- Click sign = `md5(fields)` (Payme = Basic Auth)
- Click amount = SO'M `"5000.00"` (Payme = TIYIN BigInt)
- Complete'da `merchant_prepare_id` ham sign hash ichida (Prepare'da yo'q)

**Yangi fayllar:**
- `src/lib/payment/click/errors.ts` — `ClickError` class, 9 xato kodi (-1 to -9)
- `src/lib/payment/click/types.ts` — ClickPrepareRequest/Response, ClickCompleteRequest/Response
- `src/lib/payment/click/signature.ts` — `buildPrepareSignString()`, `buildCompleteSignString()`, `constantTimeEqual()`
- `src/lib/payment/click/resolve-clinic.ts` — `resolveClinicForClick()` (appointment → clinic fallback)
- `src/lib/payment/click/handlers.ts` — `handleClickPrepare()`, `handleClickComplete()` (idempotent)
- `src/lib/payment/click/checkout-url.ts` — `buildClickCheckoutUrl()` (my.click.uz/services/pay)
- `src/app/api/payments/click/route.ts` — POST endpoint (form-urlencoded + JSON), action 0/1 dispatch
- `src/app/api/payments/click/create-link/route.ts` — Frontend checkout URL generator
- `src/app/api/appointments/[id]/payment-info/route.ts` — GET (amount, paymentStatus, providers)
- `src/lib/payment/notifications.ts` — `notifyPaymentResult()` Telegram xabarnomasi
- `src/app/admin/super/clinics/[id]/PaymentTab.tsx` — Payme + Click config UI

**O'zgartirilgan fayllar:**
- `src/app/webapp/appointments/[id]/pay/page.tsx` — Payme + Click ikkalasi (payment-info API dan providers)
- `src/app/api/admin/clinics/[id]/payment-config/route.ts` — Click `mergedClick` qo'shildi
- `src/app/admin/super/clinics/[id]/page.tsx` — "To'lov 💳" tab qo'shildi
- `bot/handlers/callback.ts` — confirm success'da to'lov tugmasi (requiresPrePayment && provider enabled)

**Pul birligi:** Click SO'M → TIYIN: `sumToTiyin("5000.00") = 500000n`. DB'da doim BigInt tiyin.

**Visual test:** `GET /api/appointments/[id]/payment-info` → 200 ✅, `GET /api/payments/click` → `{error:-8}` ✅

**Commit:** `dcb8f3d` — 15 fayl, +1327/-49

---

## 13. KELAJAK REJALAR (tibtaqvim-pending-plans.md, 2026-05-17)

> Quyidagi 3 yo'nalish **tasdiqlangan** va har biri alohida prompt (MD) sifatida yoziladi.
> Tegmaslik kerak narsalar: mavjud KPI grafiklar, doctor date picker, specialty dropdown,
> Service-Doctor M2M, queueMode, Cookie+JWT auth, RLS 16/16, audit log, webhook secret.

### 1. TO'LOV TIZIMI — ✅ SPRINT 1+2+3 TUGALLANDI (2026-05-19)

**Sprint 1 (cdfcae8):** Schema + TypeScript helpers — `Payment` model, enum'lar, `lib/payment/` modullar
**Sprint 2 (1e051a1):** Payme JSON-RPC — 6 handler (CheckPerform, Create, Perform, Cancel, Check, GetStatement), Basic Auth, sandbox test ✅
**Sprint 3 (dcb8f3d):** Click Shop API — Prepare/Complete (form-urlencoded), md5 signature, `PaymentTab.tsx` admin config UI, bot to'lov tugmasi

**Keyingi qadam:** Click merchant kabineti → admin panelda config → sandbox test → production bot to'lov

**Muhim endpoint'lar:**
- `POST /api/payments/payme/route.ts` — JSON-RPC endpoint, Basic Auth
- `POST /api/payments/payme/create-link/route.ts` — frontend checkout link
- `POST /api/payments/click/route.ts` — form-urlencoded endpoint
- `POST /api/payments/click/create-link/route.ts` — frontend link
- `GET /api/appointments/[id]/payment-info` — providers + amount
- `GET/PATCH /api/admin/clinics/[id]/payment-config` — Payme + Click config

**Pul birligi:** DB'da doim BigInt tiyin. Click = SO'M string, Payme = tiyin int.

---

### 2. MULTI-CLINIC TIZIMI — ✅ TUGALLANDI (2026-05-18)

**Amalga oshirildi:**
- DB: SubscriptionPlan/Status enum, Clinic/Branch yangi maydonlar, migration applied
- Public API: `/api/clinics`, `/api/clinics/[id]`, `/api/clinics/[id]/branches`
- Admin: `/api/admin/branches` CRUD, super_admin klinika yaratish (transaction + trial)
- Webapp: `/webapp/clinics`, `/webapp/clinics/[id]`, `/webapp/clinics/[id]/branches/[branchId]`
- Bot: clinic/branch tanlash, auto-skip (1 ta bo'lsa), `clinicFlow.ts` yangi modul

**Kelajak (Bosqich 2 — hali qilinmagan):**
- `clinic_ratings` jadvali (clinicId, userId, rating 1-5, comment)
- `POST /api/ratings` endpoint
- Xizmatlarni filial darajasida ajratish (Variant B)
- `paymentConfig` JsonB maydoni (`Clinic.paymentConfig`) allaqachon qo'shilgan — to'lov tizimi uchun tayyor

---

### 3. UY XIZMATI NATIJALARI (~9 soat) ⭐⭐

**Flow:** Laborant uy xizmatiga boradi → tahlil oladi → klinikada qayta ishlaydi → natija PDF/rasm yuklanadi → bemor webapp'da ko'radi + botda xabarnoma

**DB:**
- Yangi jadval: `appointment_results` (appointmentId, uploadedBy, fileName, filePath, fileSize, mimeType, comment, notifiedAt, viewedAt, downloadedAt)
- Supabase Storage bucket: `appointment-results` (private, signed URL 1h TTL, max 10MB)

**Yangi endpoint'lar:**
- `POST /api/results/upload` (multipart, validation: PDF/JPG/PNG/DOC, max 10MB)
- `GET /api/results/[appointmentId]`, `GET /api/results/file/[resultId]` (signed URL)
- `DELETE /api/results/[resultId]` (soft delete, admin only)
- `POST /api/results/[resultId]/notify` (qayta xabarnoma)

**Frontend:** Admin/reception "Natija yuklash" modal + progress bar; Webapp profilim'da PDF/image preview (react-pdf), download/print tugmalari
**Bot:** natija tayyor xabari + fayl (50MB'dan kichik bo'lsa fayl o'zi) + inline tugmalar

---

### UMUMIY ROADMAP JADVALI

| # | Vazifa | Ustuvorlik | Holat |
|---|---|---|---|
| 1 | To'lov — Sprint 1: Schema poydevor | ⭐⭐⭐ | ✅ Tugallandi (cdfcae8) |
| 2 | To'lov — Sprint 2: Payme JSON-RPC | ⭐⭐⭐ | ✅ Tugallandi (1e051a1) |
| 3 | To'lov — Sprint 3: Click Shop API | ⭐⭐⭐ | ✅ Tugallandi (dcb8f3d) |
| 4 | Multi-clinic: Faza 1-4 (edit/admin/branch/switcher) | ⭐⭐ | ✅ Tugallandi |
| 5 | Appointment history (Faza 5) | ⭐⭐ | ✅ Tugallandi (bb60064) |
| 6 | Uy xizmati natijalari (upload+PDF) | ⭐⭐ | Kutilmoqda |
| 7 | Bot to'lov tugmasi real sandbox test | ⭐⭐ | Kutilmoqda |
| 8 | Click merchant config + sandbox test | ⭐⭐ | Kutilmoqda |
| 9 | Doctor /stats 3 ta grafik | ⭐ | Kutilmoqda |
| 10 | Slot tizimi bosqich 2 (aniq vaqt slot) | ⭐ | Kutilmoqda |
| 11 | Multi-clinic Bosqich 2 (ratings, filial xizmatlar) | ⭐ | Kutilmoqda |
| 12 | Branch Isolation S1-S4 (services.branchId, scope) | ⭐⭐⭐ | ✅ Tugallandi (f22c9fb) |
| 13 | Payment Workflow: Qabulxona/Shifokor ajratish | ⭐⭐⭐ | ✅ Tugallandi (a86df8a) |
| 14 | FLIP-CARD-01: Shifokor profil flip card | ⭐⭐⭐ | ✅ Tugallandi (a2b1588) |
| 15 | FLIP-CARD-02: BookingFlipCard barcha bronlarda | ⭐⭐⭐ | ✅ Tugallandi (983907a) |
| 16 | FLIP-CARD-03: Barcha bo'limlarda flip + butun karta bosiladigan | ⭐⭐⭐ | ✅ Tugallandi (742bf82) |
| 17 | SERVICE-PICKER-01: Rasmli xizmat tanlash YAGONA komponent | ⭐⭐⭐ | ✅ Tugallandi (e8a6959) |
| 18 | CLINIC-CURRENT-01: Tanlangan klinikani DB'da doimiy saqlash | ⭐⭐⭐⭐ | ✅ Tugallandi (5629d65) |

**Keyingi prioritetlar:** Click sandbox test → Uy xizmati natijalari → Doctor /stats grafiklar

---

### 2026-04-29 — SuperAdmin Panel (Clinic OS)
**Nima o'zgardi:** To'liq SuperAdmin boshqaruv paneli qo'shildi — multi-clinic konfiguratsiya tizimi.
**Yangi fayllar:**
- `prisma/schema.prisma` — 4 yangi model: `ClinicSettings`, `FeatureFlag`, `ModuleConfig`, `AuditLog`; `Clinic`ga `deletedAt` (soft delete)
- `src/lib/services/config.service.ts` — `getClinicConfig`, `isFeatureEnabled`, `getModuleConfig`, `upsertModuleConfig`, `upsertFeatureFlag`, `createAuditLog`
- `src/app/api/admin/super/stats/route.ts` — Dashboard statistika
- `src/app/api/admin/super/clinics/route.ts` — GET list + POST create
- `src/app/api/admin/super/clinics/[id]/route.ts` — GET/PATCH/DELETE (soft delete)
- `src/app/api/admin/super/clinics/[id]/settings/route.ts` — GET/PUT sozlamalar
- `src/app/api/admin/super/clinics/[id]/modules/route.ts` — GET/PUT modullar
- `src/app/api/admin/super/clinics/[id]/features/route.ts` — GET/PUT feature flags
- `src/app/api/admin/super/audit/route.ts` — Audit log
- `src/app/admin/super/layout.tsx` — Dark sidebar layout
- `src/app/admin/super/page.tsx` — Dashboard (stat cards + klinika list + audit)
- `src/app/admin/super/clinics/page.tsx` — Klinika ro'yxati (create/toggle/delete)
- `src/app/admin/super/clinics/[id]/page.tsx` — Clinic Builder (tabs: sozlamalar/modullar/flaglar/audit)
- `src/app/admin/super/audit/page.tsx` — To'liq audit log sahifasi
**O'zgartirilgan:**
- `src/lib/services/booking.service.ts` — modul yoqilgan/o'chirilganini tekshiradi (`MODULE_DISABLED` error)
- `src/middleware.ts` — `/admin/super` → faqat `super_admin` roli

**URL:** `/admin/super` — faqat super_admin
**Xavfsizlik:** Barcha API routelar `super_admin` rolini tekshiradi. Soft delete. AuditLog.

---

### 2026-04-28 — One Message UI + Back Button Navigation
**Nima o'zgardi:** Telegram bot har bir qadam uchun yangi xabar yuborish o'rniga bitta xabarni `editMessageText` bilan yangilaydi. Barcha qadamlarda "⬅️ Orqaga" tugmasi qo'shildi.
**Fayllar:**
- `bot/helpers/render.ts` (YANGI) — `editOrSend()`, barcha keyboard va text builder'lar
- `bot/handlers/start.ts` — `messageId` va `_services` state'da saqlanadi
- `bot/handlers/callback.ts` — to'liq qayta yozildi: barcha navigatsiya `editOrSend` orqali, `back:` handler, `full:` show_alert, TTL check, `_nameBack`/`_doctors`/`_slots` cache
- `bot/handlers/message.ts` — barcha validatsiya xatolari va promptlar `editOrSend` orqali; `messageId` state'da yangilanadi

**Bot UI oqimi (yangi):**
```
[bitta xabar, editlanadi] → xizmat → sana → shifokor/slot → ism → telefon → (manzil) → tasdiqlash
                                   ↑_______⬅️ Orqaga har qadamda_______↑
```

**`editOrSend()` qoidasi:**
- `messageId` bo'lsa `editMessageText` urinadi
- "message is not modified" → xatosiz o'tkazib yuboriladi
- Boshqa xatolar (xabar o'chirilgan, eskir) → `sendMessage` bilan yangi xabar

**`back:` target'lar:** `select_service`, `select_date`, `select_doctor_or_slot`, `enter_name`, `enter_phone`
**Cache maydonlar:** `_services`, `_doctors`, `_slots`, `_nameBack` — orqaga qaytganda qayta fetch qilinmaydi

---

### 2026-04-28 — Pre-deploy critical fixes
**Nima o'zgardi:** Webhook mode to'liq ishlash uchun 6 ta kritik fix
**Fayllar:**
- `bot/state.ts` (YANGI) — `userState` + `cleanExpiredState` alohida modul
- `bot/webhook-setup.ts` (YANGI) — `setupBotHandlers(bot)` — handler registration webhook uchun
- `bot/handlers/start.ts`, `callback.ts`, `message.ts` — `../index` → `../state` import fix
- `bot/handlers/callback.ts` — `svc:` handlerda `clinicId` yo'qolishi bug'i tuzatildi (`{ ...state, ... }`)
- `bot/index.ts` — `userState` eksporti olib tashlandi, `./state`dan import
- `src/app/api/webhook/telegram/route.ts` — `setupBotHandlers` chaqiriladi (handlers endi ulangan)
- `src/app/api/reminders/route.ts` — GET handler qo'shildi (Vercel cron uchun) + `Authorization: Bearer` support
- `vercel.json` (YANGI) — cron konfiguratsiya (day_before: 03:00 UTC, two_hours: har soat)
- `next.config.mjs` — `node-telegram-bot-api` serverExternalPackages'ga qo'shildi

**Asosiy qoidalar (o'zgarmagan):**
- `bot/index.ts` faqat local polling uchun — Vercel'da ISHLATILMAYDI
- Webhook: `src/app/api/webhook/telegram/route.ts` — prod entry point
- userState in-memory (serverless limitatsiya, Redis kerak yuqori traffic'da)

---

### 2026-04-28 — WebApp button
**Nima o'zgardi:** WebApp button integratsiya qilindi (`bot/handlers/start.ts`)
**Fayllar:** `bot/handlers/start.ts`
**Nima:** `NEXT_PUBLIC_WEBAPP_URL` env bo'lsa `web_app: { url }` tugmasi service list'dan oldin ko'rinadi. Bo'sh bo'lsa keyboard o'zgarmaydi.

---

### 2026-04-27 (taxminiy)
**Nima o'zgardi:** tibId global foydalanuvchi ID tizimi qo'shildi
**Fayllar:** `prisma/schema.prisma`, `src/lib/services/tib-id.service.ts`, `src/app/api/user/tib/route.ts`, `src/app/api/user/by-tibid/route.ts`, `bot/api.ts`, `bot/handlers/callback.ts`, `prisma/backfill-tib-ids.ts`
**Nima:** `User.tibId String? @unique`, sequential `tib000001` format, in-memory cache (TTL 2 min), bot tasdiqlash xabarida ID ko'rsatiladi

**Nima o'zgardi:** Telefon normalizatsiya qo'shildi
**Fayllar:** `src/lib/utils/phone.ts`, `src/lib/__tests__/phone.test.ts`, barcha kiritish nuqtalari
**Nima:** `normalizePhone()` — 4 xil format qabul qilib `+998XXXXXXXXX` qaytaradi

**Nima o'zgardi:** Structured error codes
**Fayllar:** `src/lib/api-response.ts`, `src/lib/services/booking.service.ts`, `src/lib/validators/booking.ts`
**Nima:** `error.code` + `error.message` — `string` o'rniga `ApiError` object

**Nima o'zgardi:** Rate limiting, withRetry, reminder idempotency
**Fayllar:** `src/lib/rate-limit.ts`, `src/lib/prisma.ts`, `src/lib/services/reminder.service.ts`
**Nima:** IP-based rate limit, DB retry P1001/P1002, `notifiedDayBefore`/`notifiedTwoHours` flag'lar

**Nima o'zgardi:** source flag — duplikat notification oldini olish
**Fayllar:** `src/lib/validators/booking.ts`, `src/lib/services/booking.service.ts`, `bot/api.ts`
**Nima:** `BookingInput.source?: "bot" | "webapp"` — bot `source: "bot"` yuboradi, API notification o'tkazib yuboradi

**Nima o'zgardi:** Panel error handling
**Fayllar:** `src/app/doctor/page.tsx`, `src/app/reception/page.tsx`
**Nima:** `errorMsg` state, try/catch, optimistic update + rollback, error banner UI

**Nima o'zgardi:** Timezone fix
**Fayllar:** `bot/handlers/callback.ts`, `src/lib/services/reminder.service.ts`
**Nima:** `sv-SE` locale + `CLINIC_TIMEZONE` → YYYY-MM-DD, UTC server'da ham to'g'ri sana

---

## 13. DEPLOYMENT GUIDE — Bosqichma-bosqich

### PHASE 1 — Database (Supabase yoki Neon)

**Supabase (tavsiya):**
1. https://supabase.com → New project → Region: eu-central-1
2. Settings → Database → Connection string (URI) → copy
3. Format: `postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres`

**Neon:**
1. https://neon.tech → New project → Region: eu-central-1
2. Connection string → copy (pooled connection ishlatiladi)

**Secret kalitlar generatsiya:**
```bash
# JWT_SECRET va NEXTAUTH_SECRET uchun (ikki alohida):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# CRON_SECRET uchun:
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

---

### PHASE 2 — Vercel Deploy

1. https://vercel.com → New Project → GitHub repo import
2. Framework: **Next.js** (avtomatik aniqlanadi)
3. Environment Variables — BARCHASINI qo'shing:

| Name | Value |
|---|---|
| `DATABASE_URL` | postgresql://... (Supabase/Neon dan) |
| `JWT_SECRET` | (generatsiya qilingan, 64 hex belgi) |
| `NEXTAUTH_SECRET` | (generatsiya qilingan, 64 hex belgi) |
| `TELEGRAM_BOT_TOKEN` | BotFather tokenı |
| `DEFAULT_CLINIC_ID` | `clinic-demo` (seed dan, keyinchalik o'zgartirish mumkin) |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |
| `CRON_SECRET` | (generatsiya qilingan) |
| `CLINIC_TIMEZONE` | `Asia/Tashkent` |
| `NEXT_PUBLIC_WEBAPP_URL` | `https://your-app.vercel.app/webapp` (ixtiyoriy) |

4. **Deploy** tugmasini bosing

**Build muvaffaqiyatli bo'lishini tekshirish:**
```
https://your-app.vercel.app/api/health → { "status": "ok", "db": "connected" }
```

---

### PHASE 3 — Database Migration + Seed

Deploy muvaffaqiyatli bo'lgandan keyin, local terminalda:
```bash
# 1. .env ga production DATABASE_URL ni vaqtincha qo'ying
# 2. Migration'ni apply qiling:
npx prisma migrate deploy

# 3. Minimal ma'lumotlarni seed qiling:
npx prisma db seed

# Seed natijasida:
# Klinika ID: clinic-demo
# Admin: +998 90 000 00 00 / admin123
# 5 ta xizmat, 3 ta shifokor, bugungi slotlar
```

**DB tekshiruvi:**
- `users` jadvalida `tibId` ustuni bor: ✅
- `appointments` jadvalida `notifiedDayBefore`, `notifiedTwoHours`: ✅
- Indexlar mavjud: ✅

---

### PHASE 4 — Webhook Ro'yxatdan O'tkazish

Deploy tugagach brauzerda ochish (TOKEN va DOMAIN o'zgartiring):
```
https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://your-app.vercel.app/api/webhook/telegram
```

**Natija tekshirish:**
```
https://api.telegram.org/bot{TOKEN}/getWebhookInfo
```
Javobda: `"url": "https://your-app.vercel.app/api/webhook/telegram"`, `"pending_update_count": 0`

---

### PHASE 5 — 10 ta Tekshiruv

```
1. GET  /api/health                           → { status: "ok", db: "connected" }
2. DB   prisma.$queryRaw`SELECT 1`            → health endpoint orqali ✅
3. POST /api/webhook/telegram (Telegram'dan)  → bot /start yuborish
4. Bot  /start                                → xizmatlar ro'yxati keladi
5. WebApp tugmasi                             → webapp.vercel.app ichida ochiladi
6. POST /api/book                             → bron yaratiladi
7. GET  /api/user/tib?phone=+998...           → tibId qaytadi
8. Bot confirm                                → tasdiqlash xabari + tibId
9. GET  /api/reminders?type=day_before        → Authorization: Bearer {CRON_SECRET}
10. Vercel Logs                               → hech qanday crash yo'q
```

---

### PHASE 6 — Cron Tekshirish

Vercel Dashboard → Project → Settings → Cron Jobs:
```
/api/reminders?type=day_before  — 0 3 * * *  (har kuni 03:00 UTC = 08:00 Toshkent)
/api/reminders?type=two_hours   — 0 * * * *  (har soat)
```

Manual test (curl yoki Postman):
```bash
curl -X GET "https://your-app.vercel.app/api/reminders?type=day_before" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

### BOT DEPLOYMENT CHECKLIST (Tekshirish uchun)

**Vercel Environment Variables**
- [ ] `DATABASE_URL` — PostgreSQL connection string (Supabase/Neon)
- [ ] `JWT_SECRET` — 64 hex belgi (crypto.randomBytes)
- [ ] `NEXTAUTH_SECRET` — 64 hex belgi (crypto.randomBytes)
- [ ] `TELEGRAM_BOT_TOKEN` — BotFather tokenı
- [ ] `DEFAULT_CLINIC_ID` — `clinic-demo` (seed dan)
- [ ] `NEXT_PUBLIC_APP_URL` — `https://your-domain.vercel.app`
- [ ] `CRON_SECRET` — random secret
- [ ] `CLINIC_TIMEZONE` — `Asia/Tashkent`

**Database**
- [ ] `npx prisma migrate deploy` — migration apply qilindi
- [ ] `npx prisma db seed` — klinika, xizmatlar, shifokorlar qo'shildi
- [ ] `/api/health` — `db: "connected"` javob qaytdi

**Webhook**
- [ ] `setWebhook` chaqirildi
- [ ] `getWebhookInfo` — URL to'g'ri, xato yo'q
- [ ] Bot'ga `/start` — xizmatlar ro'yxati keldi

**Cron**
- [ ] Vercel dashboard'da 2 ta cron ko'rinadi
- [ ] Manual `GET /api/reminders?type=day_before` — `{ sent, failed, messages }` qaytdi

**`bot/index.ts` — Vercel'da ISHLATILMAYDI** (faqat local `npm run bot`)
