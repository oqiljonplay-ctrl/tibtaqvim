# NEXTBOT.md — Single Source of Truth

> **QOIDA:** Har qanday kod o'zgarishidan OLDIN bu faylni o'qi.
> Har qanday o'zgarishdan KEYIN ushbu faylni yangilang.

---

## 1. PROJECT OVERVIEW

**Nima:** Multi-tenant klinika boshqaruv tizimi.

**Asosiy oqim:**
```
Telegram Bot → xizmat/sana/shifokor tanlash → ism/telefon → API /book → DB → Telegram tasdiqlash
Telegram WebApp → service/slot tanlash → forma → API /book → DB → Telegram tasdiqlash
Reception Panel → keldi/kelmadi belgilash
Doctor Panel → bugungi bemonlar ro'yxati
```

**Hozirgi holat:** Mahalliy ishlamoqda (polling rejimida). Production deploy uchun webhook rejimiga o'tish kerak.

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
│    POST /api/auth/login                                 │
│    GET  /api/user/tib                                   │
│    GET  /api/user/by-tibid                              │
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
│       ├── start.ts              # /start → service list + WebApp button
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
│   │   │   ├── admin/                  # Admin CRUD routes
│   │   │   └── webhook/telegram/route.ts  # POST webhook (prod)
│   │   ├── doctor/page.tsx        # Doctor panel
│   │   ├── reception/page.tsx     # Reception panel
│   │   ├── webapp/                # Telegram WebApp UI
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   │
│   └── lib/
│       ├── prisma.ts              # Singleton PrismaClient + withRetry
│       ├── auth.ts                # JWT sign/verify, bcrypt, requireAuth
│       ├── api-response.ts        # ok(), error(), unauthorized() helpers
│       ├── rate-limit.ts          # In-memory rate limiter
│       ├── logger.ts              # Structured logger + generateRequestId
│       ├── env.ts                 # Env validation (validateEnv, getEnv)
│       ├── auth-edge.ts           # Edge runtime auth
│       ├── services/
│       │   ├── booking.service.ts       # processBooking() — asosiy
│       │   ├── reminder.service.ts      # Cron reminder sender
│       │   ├── tib-id.service.ts        # assignTibId, getTibIdByPhone
│       │   ├── confirmation.service.ts  # buildConfirmationMessage, sendTelegramConfirmation
│       │   └── appointment.service.ts
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
id           String  @id @default(cuid())
clinicId     String? (nullable — patient yoki super_admin)
telegramId   String? @unique
tibId        String? @unique  ← GLOBAL permanent ID (tib000001 format)
phone        String?          ← +998XXXXXXXXX (normalized)
firstName    String
lastName     String?
role         UserRole (super_admin|clinic_admin|doctor|receptionist|patient)
passwordHash String?
```

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
- State steps: `select_service → select_date → select_doctor_or_slot → enter_name → enter_phone → (enter_address) → confirm`
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
