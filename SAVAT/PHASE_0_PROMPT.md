# PHASE 0 — Technical Debt Cleanup
## VS Code Claude Code uchun mukammal bajarish ko'rsatmasi

> **MUHIM**: Bu vazifa **5 ta mustaqil task**dan iborat. Har birini **alohida tartibda** bajar. Hech qaysi task'ni boshqasi bilan qo'shma. Har task tugagandan keyin **commit qil** va **deploy bo'lishini kut**, keyingisiga o'tma agar build muvaffaqiyatsiz bo'lsa.

---

## 📚 LOYIHA KONTEKSTI

**Loyiha**: Tibtaqvim — multi-tenant klinika boshqaruv tizimi
- **Stack**: Next.js 14 (App Router) + TypeScript + Tailwind + Prisma 6 + Supabase Postgres 17
- **Bot**: node-telegram-bot-api 0.67 (local polling / prod webhook)
- **Deploy**: Vercel (auto-deploy main → tibtaqvim.vercel.app)
- **Supabase project ref**: `lxqimithjjabhnldcugc`
- **Timezone**: Asia/Tashkent
- **Auth**: JWT cookie (24h, httpOnly)

**Repo strukturasi**:
```
tibtaqvim/
├── bot/                    # Telegram bot (local polling)
│   ├── index.ts
│   ├── api.ts, state.ts, webhook-setup.ts
│   ├── handlers/           # start, callback, message, editedMessage
│   └── helpers/            # calendar, phone, render
├── src/
│   ├── app/
│   │   ├── api/            # REST API (auth, book, services, slots, ...)
│   │   ├── admin/          # Admin panel + super admin
│   │   ├── doctor/, reception/, webapp/, login/, stats/
│   │   ├── layout.tsx, page.tsx, middleware.ts
│   ├── lib/
│   │   ├── services/       # booking, tib-id, user, reminder, ...
│   │   ├── validators/, utils/
│   │   ├── auth.ts, auth-edge.ts, prisma.ts, env.ts, api-response.ts,
│   │   │   rate-limit.ts, logger.ts, bigint-fix.ts, calendar.ts, locationLinks.ts
│   └── components/         # Calendar, DoctorCard, LiveLocationPanel, ...
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts, seed-m2m.ts
│   └── migrations/
└── .env.example, vercel.json, next.config.mjs, package.json
```

---

## 🎯 PHASE 0 — UMUMIY MAQSAD

5 ta texnik qarzni yopish, hech qanday foydalanuvchi-yuzli xulq-atvorni o'zgartirmasdan:

| # | Task | Joy | Migration kerakmi |
|---|---|---|---|
| 0.1 | `log_audit_event` xavfsizlik fix | Supabase | ✅ Ha |
| 0.2 | 6 funksiya `search_path` fix | Supabase | ✅ Ha |
| 0.3 | `.env.example` to'liqlash | Repo file | ❌ Yo'q |
| 0.4 | `/api/health` kengaytirish | Repo file | ❌ Yo'q |
| 0.5 | `NEXTBOT.md` changelog yangilash | Repo file | ❌ Yo'q |

---

# 🔴 TASK 0.1 — `log_audit_event` xavfsizlik fix

## Muammo
`log_audit_event` funksiyasi `SECURITY DEFINER` huquqiga ega va `anon` + `authenticated` rollar uni Supabase REST `/rest/v1/rpc/log_audit_event` orqali to'g'ridan-to'g'ri chaqirishi mumkin. Bu real xavfsizlik teshigi: tashqaridan birov soxta `audit_logs` yozuvi kiritishi mumkin.

## Yechim
Funksiyani SECURITY DEFINER'da qoldiramiz (DB owner huquqi trigger uchun zarur), lekin `EXECUTE` huquqini `public`, `anon`, `authenticated` rollardan **REVOKE** qilamiz. Trigger'lar funksiyani DB ichidan chaqiradi — REVOKE ularga ta'sir qilmaydi.

## Bajarish

### Qadam 1: Migration faylini yarat

**Fayl**: `prisma/migrations/20260517000001_revoke_audit_function_public_execute/migration.sql`

(Sana papkasi nomini siz lokal `date +%Y%m%d%H%M%S` bilan generatsiya qilib qo'yishingiz mumkin — eng muhimi `_revoke_audit_function_public_execute` suffix bo'lsin.)

**Kontent**:
```sql
-- Phase 0.1 — log_audit_event REST orqali chaqirilishini bloklash
-- SECURITY DEFINER funksiyasi sifatida saqlanadi (trigger uchun zarur),
-- lekin tashqi (PostgREST) chaqiruv huquqi olib tashlanadi.
-- Trigger'lar funksiyani DB ichidan chaqirgani uchun ular ishlayveradi.

REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM authenticated;

-- postgres rol DB owner sifatida saqlanadi — trigger ishlashi uchun zarur
-- service_role ham saqlanadi — backend ehtiyot uchun (lekin biz hech qachon to'g'ridan-to'g'ri chaqirmaymiz)

COMMENT ON FUNCTION public.log_audit_event() IS
  'Trigger function — DB ichidan chaqiriladi. PostgREST orqali chaqirish bloklangan (Phase 0.1).';
```

### Qadam 2: Tasdiq

Migration apply qilishdan oldin **lokal'da Supabase CLI ishlamasa**, bu migration faqat fayl sifatida saqlanadi va Vercel build paytida `prisma migrate deploy` chaqirilmaydi.

**MUHIM**: Bu migration'ni **avtomatik apply qilma**. Sababi:
1. Supabase MCP orqali biz uni allaqachon apply qilamiz (Claude tomondan)
2. Lokal `prisma migrate dev` Supabase'ga ulanishi kerak bo'lardi — bu xavfli

**Yechim**: Faylni faqat **commit qil** (versiya nazoratida bo'lishi uchun), apply qilma.

```bash
git add prisma/migrations/20260517000001_revoke_audit_function_public_execute/migration.sql
git commit -m "security(db): revoke audit fn execute from anon/authenticated/public

- log_audit_event SECURITY DEFINER saqlandi (trigger uchun zarur)
- PostgREST orqali tashqi chaqiruv bloklandi
- Triggerlar DB ichidan chaqirgani uchun ishlayveradi
- Phase 0.1"
```

### Tekshirish (foydalanuvchi qiladi)
- Bot ishlayaptimi: `/start` → service list keladi
- Booking ishlayaptimi: admin panelda yangi appointment INSERT bo'lganda `audit_logs` jadvalida row qo'shilyaptimi (Supabase Dashboard → Table Editor)

---

# 🟡 TASK 0.2 — 6 funksiya `search_path` fix

## Muammo
6 ta funksiya `search_path` aniqlamagan. Bu — theoretical SQL injection xavfi: `public` schema'da soxta funksiya yaratib, original'ni aldash mumkin.

Funksiyalar:
1. `next_tib_id()` — `tib000001` formatda yangi ID qaytaradi (SQL function, ishlatadi `nextval('tib_id_seq')`)
2. `generate_tib_id()` — xuddi shu, plpgsql versiyasi
3. `assign_tib_id_on_insert()` — trigger function, `generate_tib_id()` chaqiradi
4. `cleanup_expired_bot_states()` — `DELETE FROM bot_states WHERE "expiresAt" < now()`
5. `update_bot_states_updated_at()` — trigger function, `NEW."updatedAt" := NOW()`
6. `log_audit_event()` — trigger function, INSERT'ga `audit_logs`

## Yechim
Har biriga `SET search_path = public, pg_catalog` qo'shamiz. `pg_catalog` PostgreSQL system funksiyalari uchun (NOW, nextval, gen_random_uuid). `public` esa `audit_logs`, `bot_states`, `tib_id_seq` uchun. **Hech qaysisi `extensions` schema'sini ishlatmaydi**, shuning uchun `extensions` qo'shilmaydi.

## Bajarish

### Qadam 1: Migration faylini yarat

**Fayl**: `prisma/migrations/20260517000002_function_search_path_hardening/migration.sql`

**Kontent**:
```sql
-- Phase 0.2 — Funksiyalarga search_path qo'shish (injection himoyasi)
-- Har bir funksiya DEFINITION'i o'zgarmaydi, faqat SET search_path qo'shiladi.
-- public — audit_logs, bot_states, tib_id_seq uchun
-- pg_catalog — NOW(), nextval(), gen_random_uuid(), LPAD() uchun

-- 1. next_tib_id (SQL function)
CREATE OR REPLACE FUNCTION public.next_tib_id()
RETURNS text
LANGUAGE sql
SET search_path = public, pg_catalog
AS $function$
  SELECT 'tib' || LPAD(nextval('tib_id_seq')::TEXT, 6, '0');
$function$;

-- 2. generate_tib_id (plpgsql)
CREATE OR REPLACE FUNCTION public.generate_tib_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
DECLARE
  next_num BIGINT;
BEGIN
  next_num := nextval('tib_id_seq');
  RETURN 'tib' || LPAD(next_num::TEXT, 6, '0');
END;
$function$;

-- 3. assign_tib_id_on_insert (trigger)
CREATE OR REPLACE FUNCTION public.assign_tib_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
BEGIN
  IF NEW."tibId" IS NULL THEN
    NEW."tibId" := generate_tib_id();
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. cleanup_expired_bot_states
CREATE OR REPLACE FUNCTION public.cleanup_expired_bot_states()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM bot_states WHERE "expiresAt" < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

-- 5. update_bot_states_updated_at (trigger)
CREATE OR REPLACE FUNCTION public.update_bot_states_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
BEGIN
  NEW."updatedAt" := NOW();
  NEW."expiresAt" := NOW() + INTERVAL '30 minutes';
  RETURN NEW;
END;
$function$;

-- 6. log_audit_event (SECURITY DEFINER trigger)
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_actor_id TEXT;
  v_clinic_id TEXT;
  v_payload JSONB;
BEGIN
  BEGIN
    v_actor_id := current_setting('app.actor_id', true);
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;

  IF v_actor_id IS NULL OR v_actor_id = '' THEN
    v_actor_id := 'system';
  END IF;

  IF TG_OP = 'DELETE' THEN
    BEGIN
      v_clinic_id := OLD."clinicId";
    EXCEPTION WHEN OTHERS THEN
      v_clinic_id := NULL;
    END;
    v_payload := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'INSERT' THEN
    BEGIN
      v_clinic_id := NEW."clinicId";
    EXCEPTION WHEN OTHERS THEN
      v_clinic_id := NULL;
    END;
    v_payload := jsonb_build_object('new', to_jsonb(NEW));
  ELSE
    BEGIN
      v_clinic_id := NEW."clinicId";
    EXCEPTION WHEN OTHERS THEN
      v_clinic_id := NULL;
    END;
    v_payload := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
  END IF;

  INSERT INTO public.audit_logs (id, "actorId", "clinicId", action, payload, "createdAt")
  VALUES (
    gen_random_uuid()::text,
    v_actor_id,
    v_clinic_id,
    TG_OP || ':' || TG_TABLE_NAME,
    v_payload,
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;
```

### Qadam 2: Commit

```bash
git add prisma/migrations/20260517000002_function_search_path_hardening/migration.sql
git commit -m "security(db): set search_path on 6 functions (injection guard)

- next_tib_id, generate_tib_id, assign_tib_id_on_insert
- cleanup_expired_bot_states, update_bot_states_updated_at
- log_audit_event (SECURITY DEFINER saqlandi)
- search_path = public, pg_catalog (injection protection)
- Funksiya logikasi o'zgarmagan, faqat search_path qo'shilgan
- Phase 0.2"
```

### Tekshirish (foydalanuvchi qiladi)
- Bot'da yangi user `/start` bosadi → `tibXXXXXX` ID generatsiya bo'lyaptimi
- Booking ishlayaptimi
- `bot_states` jadvalda eski rowlar avtomatik o'chayaptimi (har 30 min)

---

# 🟢 TASK 0.3 — `.env.example` to'liqlash

## Muammo
Hozirgi `.env.example` faylda **6 ta muhim variable yo'q**, lekin kod ulardan foydalanadi:
- `DIRECT_URL` — Prisma migration uchun (pgBouncer'siz direct connection)
- `JWT_EXPIRES_IN` — `src/lib/auth.ts` ishlatadi (default 24h)
- `TELEGRAM_WEBHOOK_SECRET` — `src/app/api/webhook/telegram/route.ts` (X-Telegram-Bot-Api-Secret-Token validation)
- `NEXT_PUBLIC_WEBAPP_URL` — bot WebApp tugmasi
- `NEXT_PUBLIC_CLINIC_ID` — webapp public clinic ID
- `SUPERADMIN_KEY` — `src/middleware.ts` `/admin/super` gate (sa_key cookie)

## Yechim
`.env.example` faylini to'liq qayta yozamiz — barcha mavjud kod istalgan variable'larni izoh bilan qo'shamiz.

## Bajarish

### Qadam 1: `.env.example` faylini to'liq almashtirish

**Fayl**: `.env.example` (root'da)

**Yangi kontent**:
```bash
# ═══════════════════════════════════════════════════════════════════════════════
# TIBTAQVIM — Environment Variables
# ─────────────────────────────────────────────────────────────────────────────
# Bu fayl shablon. Ishlatish:
#   1. cp .env.example .env
#   2. Har bir qiymatni o'zgartiring (xususan SECRET'larni)
#   3. Production'da Vercel Dashboard → Settings → Environment Variables
# ═══════════════════════════════════════════════════════════════════════════════

# ─── Database (Supabase / Neon / o'zingiznikingiz) ───────────────────────────
# DATABASE_URL  — runtime uchun (pgBouncer pooler, port 6543 yoki ?pgbouncer=true)
# DIRECT_URL    — Prisma migration uchun (direct connection, port 5432)
#
# Supabase format:
#   DATABASE_URL=postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true
#   DIRECT_URL=postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/clinic_db?pgbouncer=true"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/clinic_db"

# ─── Next.js Auth ────────────────────────────────────────────────────────────
# Tasodifiy 32+ belgili matn. Generatsiya: openssl rand -base64 32
NEXTAUTH_SECRET="your-super-secret-key-change-in-production"
NEXTAUTH_URL="http://localhost:3000"

# ─── JWT ─────────────────────────────────────────────────────────────────────
# Admin/Doctor/Reception panel cookie auth uchun.
# Generatsiya: openssl rand -base64 32
JWT_SECRET="your-jwt-secret-key-change-in-production"

# JWT amal qilish muddati (Phase 0 dan oldin 7d edi, hozir 24h security uchun).
# Format: "24h", "7d", "1h" (vercel-ms format)
JWT_EXPIRES_IN="24h"

# ─── App URL ─────────────────────────────────────────────────────────────────
# Production: https://yourdomain.vercel.app
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ─── Telegram Bot ────────────────────────────────────────────────────────────
# BotFather'dan olingan token: https://t.me/BotFather
TELEGRAM_BOT_TOKEN="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"

# Webhook URL (production uchun, polling o'rniga)
# Telegram'ga register: https://api.telegram.org/bot{TOKEN}/setWebhook?url={URL}&secret_token={SECRET}
TELEGRAM_WEBHOOK_URL="https://yourdomain.vercel.app/api/webhook/telegram"

# Webhook secret token (X-Telegram-Bot-Api-Secret-Token header validation)
# Generatsiya: openssl rand -hex 32
# Telegram setWebhook chaqirilganda &secret_token=... bilan birga yuboriladi.
# Webhook handler bu qiymatni har request'da tekshiradi.
TELEGRAM_WEBHOOK_SECRET="your-webhook-secret-change-in-production"

# ─── Telegram WebApp ─────────────────────────────────────────────────────────
# WebApp ochilganda ko'rsatiladigan URL (Telegram Mini App)
# Bot start xabarida tugma sifatida ko'rinadi.
NEXT_PUBLIC_WEBAPP_URL="https://yourdomain.vercel.app/webapp"

# WebApp'da default klinika ID (multi-clinic'da bot per-clinic resolve qiladi)
NEXT_PUBLIC_CLINIC_ID="clinic-demo"

# ─── Bot klinikasi ────────────────────────────────────────────────────────────
# Bot xizmatlar ko'rsatadigan klinika IDsi (Prisma DB'dan, clinics.id)
# Seed natijasida default: "clinic-demo"
DEFAULT_CLINIC_ID="clinic-demo"

# ─── Timezone ────────────────────────────────────────────────────────────────
# Klinika joylashgan vaqt zonasi (IANA format)
# Sana formatlash va reminder ish vaqti uchun ishlatiladi.
CLINIC_TIMEZONE="Asia/Tashkent"

# ─── Cron / Reminder ─────────────────────────────────────────────────────────
# /api/reminders endpoint'ini himoya qiluvchi maxfiy kalit.
# Vercel Cron yoki tashqi cron xizmati Authorization: Bearer <CRON_SECRET> yuboradi.
# Generatsiya: openssl rand -base64 32
CRON_SECRET="your-strong-cron-secret-change-in-production"

# ─── SuperAdmin Developer Gate ───────────────────────────────────────────────
# /admin/super sahifalariga kirish uchun qo'shimcha himoya qatlami.
# Foydalanuvchi /admin/super/auth sahifasida bu qiymatni kiritsa,
# sa_key cookie o'rnatiladi (1 yil) va middleware kirishga ruxsat beradi.
# super_admin roli + bu kalit — ikkita himoya qatlami.
# Generatsiya: openssl rand -base64 24
SUPERADMIN_KEY="your-superadmin-developer-key"
```

### Qadam 2: Commit

```bash
git add .env.example
git commit -m "docs(env): add missing env vars to .env.example

Phase 0.3 — kodda ishlatilgan, lekin .env.example'da yo'q variable'lar:
- DIRECT_URL (Prisma migration)
- JWT_EXPIRES_IN (auth.ts, default 24h)
- TELEGRAM_WEBHOOK_SECRET (webhook validation)
- NEXT_PUBLIC_WEBAPP_URL (bot WebApp button)
- NEXT_PUBLIC_CLINIC_ID (webapp client)
- SUPERADMIN_KEY (sa_key cookie, /admin/super gate)

Production'da .env hech qachon commit qilinmaydi (.gitignore'da).
Yangi onboarding bu shablonni o'qib hech narsa o'tkazmaydi."
```

### Tekshirish
- `cat .env.example` — barcha variable'lar bormi
- `.env` (real) faylga ta'sir yo'q — bu faqat shablon

---

# 🟢 TASK 0.4 — `/api/health` kengaytirish

## Maqsad
Hozirgi `/api/health` faqat DB connection tekshiradi. UptimeRobot / Better Stack monitoring uchun ko'proq ma'lumot kerak: webhook holati, bot states soni, oxirgi appointment qachon yaratilgan, env variable'lar to'liqligi.

## Muhim qoidalar
- **Public endpoint** bo'lib qoladi (auth shart emas)
- **Sensitive ma'lumot chiqarmaydi** (token, secret, password yo'q)
- **Latency past** bo'lishi kerak (< 500ms) — har bir tekshiruv timeout bilan
- **Backward-compatible** — eski monitoring `status === "ok"` ni tekshiradi, shu saqlanadi

## Bajarish

### Qadam 1: `/api/health/route.ts` faylini almashtirish

**Fayl**: `src/app/api/health/route.ts`

**Yangi kontent**:
```typescript
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";
import { NextRequest } from "next/server";

// Vercel cold start'da bu reset bo'ladi — ishonchli uptime emas,
// lekin warm instance'da indikatsiya beradi.
const startedAt = Date.now();

// Vaqt cheklash bilan promise (har bir health check < 1s)
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout: ${label}`)), ms)
    ),
  ]);
}

// Telegram webhook holatini tekshirish (faqat ?verbose=1 yoki ?check=webhook)
async function checkTelegramWebhook(): Promise<{
  ok: boolean;
  url?: string;
  pendingUpdates?: number;
  lastErrorMessage?: string | null;
  error?: string;
}> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN missing" };

  try {
    const res = await withTimeout(
      fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`),
      3000,
      "telegram"
    );
    const json: any = await res.json();
    if (!json.ok) return { ok: false, error: json.description || "Telegram API error" };
    return {
      ok: !!json.result?.url,
      url: json.result?.url || undefined,
      pendingUpdates: json.result?.pending_update_count ?? 0,
      lastErrorMessage: json.result?.last_error_message ?? null,
    };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}

// Env tekshiruvi — qaysi variable'lar topilmagan (qiymat ko'rsatilmaydi)
function checkEnv(): { missing: string[]; warnings: string[] } {
  const required = ["DATABASE_URL", "JWT_SECRET", "NEXTAUTH_SECRET"];
  const productionRequired = [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_WEBHOOK_SECRET",
    "DEFAULT_CLINIC_ID",
    "CRON_SECRET",
    "NEXT_PUBLIC_APP_URL",
  ];
  const missing = required.filter((k) => !process.env[k]);
  const warnings =
    process.env.NODE_ENV === "production"
      ? productionRequired.filter((k) => !process.env[k])
      : [];
  return { missing, warnings };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const verbose = url.searchParams.get("verbose") === "1";

  // ─── Asosiy: DB tekshiruvi (har doim) ────────────────────────────────────
  let dbOk = false;
  let dbError: string | null = null;
  try {
    await withTimeout(
      prisma.$queryRawUnsafe("SELECT 1"),
      2000,
      "db"
    );
    dbOk = true;
  } catch (err: any) {
    dbError = String(err?.message || err);
  }

  // ─── Base response (har doim qaytadi) ────────────────────────────────────
  const env = checkEnv();
  const base = {
    status: dbOk && env.missing.length === 0 ? "ok" : "degraded",
    db: dbOk ? "connected" : "down",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    environment: process.env.NODE_ENV ?? "development",
    version: process.env.npm_package_version ?? "1.0.0",
    region: process.env.VERCEL_REGION ?? "local",
    env: {
      missing: env.missing,
      warnings: env.warnings,
    },
  };

  // ─── Agar DB ishlamayotgan bo'lsa — darhol 503 qaytar ────────────────────
  if (!dbOk) {
    return error(
      {
        ...base,
        error: dbError,
      } as any,
      503
    );
  }

  // ─── ?verbose=1 — qo'shimcha tekshiruvlar (sekinroq) ──────────────────────
  if (!verbose) {
    return ok(base);
  }

  const [webhook, botStatesCount, lastAppointment] = await Promise.all([
    checkTelegramWebhook(),
    withTimeout(
      prisma.botState.count({
        where: { expiresAt: { gt: new Date() } },
      }),
      2000,
      "bot_states"
    ).catch(() => -1),
    withTimeout(
      prisma.appointment.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      2000,
      "last_appointment"
    ).catch(() => null),
  ]);

  return ok({
    ...base,
    webhook,
    botStates: {
      activeCount: botStatesCount,
    },
    lastAppointmentAt: lastAppointment?.createdAt?.toISOString() ?? null,
  });
}
```

### Qadam 2: Commit

```bash
git add src/app/api/health/route.ts
git commit -m "feat(health): extended health check with verbose mode

Phase 0.4 — /api/health kengaytirildi:
- Default (oddiy): db, env tekshiruvi, region, uptime, version
- ?verbose=1: webhook status (Telegram getWebhookInfo),
  active bot_states count, oxirgi appointment vaqti
- Har tekshiruv timeout bilan (DB 2s, Telegram 3s)
- Sensitive qiymatlar chiqmaydi (faqat var nomlari)
- Backward compatible: status='ok' indikator saqlandi

Monitoring uchun:
- UptimeRobot: GET /api/health
- Detaylar uchun: GET /api/health?verbose=1"
```

### Tekshirish (deploy bo'lgandan keyin)
1. `curl https://tibtaqvim.vercel.app/api/health` — JSON keladi, `status: "ok"`
2. `curl https://tibtaqvim.vercel.app/api/health?verbose=1` — webhook bo'limi keladi
3. Webhook url to'g'rimi: `https://tibtaqvim.vercel.app/api/webhook/telegram`
4. `pendingUpdates` 0 bo'lishi kerak (yoki kichik raqam)
5. `env.warnings` bo'sh bo'lishi kerak (production'da)

---

# 🟢 TASK 0.5 — `NEXTBOT.md` changelog yangilash

## Maqsad
NEXTBOT.md — loyiha Single Source of Truth. Phase 0 o'zgarishlari u yerda yozilishi kerak — keyingi developer (yoki Claude session) tarixni biladi.

## Bajarish

### Qadam 1: NEXTBOT.md ga yangi changelog entry qo'shish

**Fayl**: `NEXTBOT.md`

**Qaerga**: `## 12. RECENT CHANGES LOG` bo'limining **eng tepasiga** (mavjud `### 2026-05-15 — Queue Mode System Phase 1` dan **oldin**) quyidagi blokni qo'sh:

```markdown
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
   - 6 ta yetishmagan variable qo'shildi:
     - `DIRECT_URL` (Prisma migration uchun)
     - `JWT_EXPIRES_IN` (default 24h)
     - `TELEGRAM_WEBHOOK_SECRET` (webhook validation)
     - `NEXT_PUBLIC_WEBAPP_URL` (bot WebApp button)
     - `NEXT_PUBLIC_CLINIC_ID` (webapp client)
     - `SUPERADMIN_KEY` (sa_key cookie /admin/super)
   - Har biriga komment va generatsiya komandasi qo'shildi

4. **`src/app/api/health/route.ts`** (UPDATED)
   - Default `GET /api/health` — db, env check, region, uptime (backward compatible)
   - `?verbose=1` — webhook holati (`getWebhookInfo`), `bot_states` active count, oxirgi appointment vaqti
   - Har tekshiruv timeout bilan (DB 2s, Telegram 3s)
   - Sensitive qiymatlar chiqmaydi
   - `status: "ok" | "degraded"` indikator

**Muhim qoidalar:**
- Hech qanday foydalanuvchi-yuzli xulq-atvor o'zgarmadi
- Bot, WebApp, admin, doctor, reception — barchasi xuddi oldingidek ishlaydi
- Migration fayllar Vercel build paytida `prisma migrate deploy` orqali apply qilinmaydi (Supabase MCP orqali allaqachon apply qilingan)
- `.env.example` o'zgarishi `.env` real faylga ta'sir qilmaydi
- `/api/health` yangi `verbose` parametri ixtiyoriy — eski monitoring tool'lar uchun backward compatible

**Supabase Security Advisor natijasi (Phase 0 dan keyin):**
- `anon_security_definer_function_executable` (log_audit_event) — ❌ → ✅
- `authenticated_security_definer_function_executable` (log_audit_event) — ❌ → ✅
- `function_search_path_mutable` (6 funksiya) — ❌ → ✅
- `rls_enabled_no_policy` (15 jadval) — qoldirildi (Phase 4 — RLS Policy Pack)

---

```

### Qadam 2: Commit

```bash
git add NEXTBOT.md
git commit -m "docs(nextbot): Phase 0 changelog entry

- 2 ta DB migration (audit_fn revoke, search_path hardening)
- .env.example to'liqlandi (6 yangi var)
- /api/health verbose mode qo'shildi
- Hech qanday foydalanuvchi-yuzli o'zgarish yo'q
- Supabase advisor: 8 warning yopildi, 15 RLS qoldi (Phase 4)"

git push origin main
```

### Tekshirish
- GitHub'da NEXTBOT.md ochilsin — yangi entry tepada bo'lishi kerak
- Vercel deploy avtomatik tushadi → `https://tibtaqvim.vercel.app/api/health?verbose=1` ishlaydi

---

# 📋 YAKUNIY CHECKLIST

Bajarganingizda har birini ✅ qiling:

**Repo o'zgarishlari** (siz commit qilasiz):
- [ ] `prisma/migrations/20260517000001_revoke_audit_function_public_execute/migration.sql` yaratildi
- [ ] `prisma/migrations/20260517000002_function_search_path_hardening/migration.sql` yaratildi
- [ ] `.env.example` to'liq yangilandi
- [ ] `src/app/api/health/route.ts` kengaytirildi
- [ ] `NEXTBOT.md` ga Phase 0 entry qo'shildi
- [ ] 4 ta commit qilindi va push qilindi
- [ ] Vercel'da yangi deploy `READY` holatida

**Supabase migration'lari** (Claude Anthropic chat'da apply qiladi):
- [ ] Migration 0.1 apply qilindi
- [ ] Migration 0.2 apply qilindi
- [ ] Supabase Security Advisor da log_audit_event warning yo'q
- [ ] Supabase Security Advisor da 6 ta function_search_path_mutable yo'q

**Smoke test** (deploy bo'lgandan keyin):
- [ ] `curl https://tibtaqvim.vercel.app/api/health` — `status: "ok"`
- [ ] `curl https://tibtaqvim.vercel.app/api/health?verbose=1` — webhook, bot_states ko'rinadi
- [ ] Telegram bot'ga `/start` yuboriladi — javob keladi
- [ ] Test booking yaratiladi — DB'da appointment paydo bo'ladi
- [ ] Doctor panel ochiladi — bemorlar ro'yxati ko'rinadi

---

# 🚫 QILMASLIK KERAK

- ❌ **Lokal `prisma migrate dev` chaqirma** — Supabase'da migration allaqachon apply qilinadi (Claude orqali). Local DB sizda yo'q bo'lsa, migration fayllar faqat versiya nazoratida bo'lishi yetadi.
- ❌ **`.env` (real) faylni o'zgartirma** — bu yerda hech narsa yangilanmaydi.
- ❌ **Mavjud kod fayllarini "yaxshilash" maqsadida o'zgartirma** — faqat ko'rsatilgan fayllar ustida ish olib bor.
- ❌ **`src/lib/services/*` ga tegma** — bu Phase 0 emas.
- ❌ **`prisma/schema.prisma` ga tegma** — schema o'zgarmaydi.
- ❌ **Bir nechta task'ni bir commit'ga qo'shma** — har task alohida commit.

---

# 🆘 AGAR XATO BO'LSA

1. **Build muvaffaqiyatsiz Vercel'da** → so'nggi commit'ni revert qil, mengа log yubor
2. **`prisma generate` xato beradi** → schema.prisma'ga tegmagan bo'lishingiz kerak edi
3. **`/api/health` 500 qaytaradi** → Vercel function logs'ni tekshiring
4. **Hech narsa tushunmadingiz** → mendan so'rang, kontekstdan chiqib ketmang

---

**Boshlang. Ishni Task 0.1 dan tartib bilan bajaring. Har task tugagandan keyin commit + push qiling.**
