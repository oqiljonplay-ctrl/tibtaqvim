# PHASE 0.8 — Kritik Xatolarni Tuzatish
## VS Code Claude Code uchun mukammal bajarish ko'rsatmasi

> **MUHIM**: Bu vazifa **3 ta mustaqil fix**dan iborat. Har birini **alohida tartibda** bajar. Hech qaysi fix'ni boshqasi bilan qo'shma. Har fix tugagandan keyin **commit qil** va **deploy bo'lishini kut**, keyingisiga o'tma agar build muvaffaqiyatsiz bo'lsa.

---

## 📚 LOYIHA KONTEKSTI

**Loyiha**: Tibtaqvim — multi-clinic boshqaruv tizimi
- **Stack**: Next.js 14 + Prisma 6 + Supabase Postgres 17 + Vercel
- **Hozirgi commit**: `dcb8f3d` (Sprint 3 — Click)
- **Branch**: `main`
- **Joriy holatlar**:
  - 19 jadval, RLS to'liq yopilgan (Phase 0.6-0.7)
  - DB ma'lumotlari tozalangan (Phase 0.8.1 by Supabase MCP)
  - Phase 0.1, 0.2 muvaffaqiyatli — search_path, audit fn
  - Multi-clinic (Faza 1-5), Payment (Sprint 1-3) tugagan
  - **2 ta haqiqiy Payme to'lov muvaffaqiyatli o'tgan**

---

## 🎯 PHASE 0.8 — UMUMIY MAQSAD

3 ta kritik xatolarni tuzatish:

| # | Task | Fayl(lar) | Migration kerakmi |
|---|---|---|---|
| 0.8.1 | `branch_admin` middleware integratsiya | `src/lib/auth-edge.ts`, `src/middleware.ts` | ❌ |
| 0.8.2 | `/admin/super` sa_key cookie gating | `src/middleware.ts` | ❌ |
| 0.8.3 | Payment secrets AES-256-GCM encryption | `src/lib/payment/secrets.ts` + ENV | ❌ (kelajak migration) |

---

# 🔴 TASK 0.8.1 — `branch_admin` middleware integratsiya

## Muammo
1. `prisma/schema.prisma`'da `UserRole` enum'ga `branch_admin` qo'shilgan, `User.branchId` field bor.
2. `src/lib/auth.ts`'da JWT payload'ga `branchId` qo'shilgan.
3. `src/lib/permissions.ts`'da `canManageBranch`, `canCreateBranchAdmin` helper'lari bor.
4. **AMMO**: 
   - `src/lib/auth-edge.ts`'da JWT payload interfeysida `branchId` YO'Q (edge runtime middleware uni o'qiy olmaydi)
   - `src/middleware.ts`'da `ROLE_PATHS` va `ROLE_HOME` lar'ida `branch_admin` YO'Q

**Natija**: `branch_admin` rolida user login qila oladi, lekin admin panelga kira olmaydi (middleware redirect qiladi).

## Bajarish

### Qadam 1: `src/lib/auth-edge.ts` ni to'liq almashtirish

**Fayl**: `src/lib/auth-edge.ts`

**Hozir** (17 satr):
```typescript
import { jwtVerify } from "jose";

export interface JwtPayload {
  userId: string;
  clinicId: string | null;
  role: string;
}

export async function verifyTokenEdge(token: string): Promise<JwtPayload | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
```

**Yangi to'liq kontent**:
```typescript
import { jwtVerify } from "jose";

/**
 * Edge runtime uchun JWT payload.
 * Bu interfeys `src/lib/auth.ts` ichidagi JwtPayload bilan sinxron bo'lishi shart.
 * branchId — branch_admin rolida ishlatiladi (Faza 3).
 */
export interface JwtPayload {
  userId: string;
  clinicId: string | null;
  branchId: string | null;
  role: string;
}

export async function verifyTokenEdge(token: string): Promise<JwtPayload | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    // jose JWTPayload type'i Record<string, unknown> dan keladi, kerakli field'lar bo'lmasligi mumkin
    if (
      typeof payload.userId !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      clinicId: typeof payload.clinicId === "string" ? payload.clinicId : null,
      branchId: typeof payload.branchId === "string" ? payload.branchId : null,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
```

### Qadam 2: `src/middleware.ts` ni to'liq almashtirish

**Fayl**: `src/middleware.ts`

**Yangi to'liq kontent**:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyTokenEdge } from "@/lib/auth-edge";

const PUBLIC_PATHS = [
  "/login",
  "/webapp",
  "/api/services",
  "/api/book",
  "/api/slots",
  "/api/webhook",
  "/api/clinics",
];

/**
 * Sahifalar va ularga ruxsat etilgan role'lar.
 * branch_admin — Faza 3'da qo'shilgan, /admin va uning subroute'lariga kira oladi
 * (lekin permissions.ts helper'lari clinicId/branchId scope tekshiradi)
 */
const ROLE_PATHS: Record<string, string[]> = {
  "/admin/super": ["super_admin"],
  "/admin": ["super_admin", "clinic_admin", "branch_admin"],
  "/doctor": ["doctor", "clinic_admin", "branch_admin", "super_admin"],
  "/reception": ["receptionist", "clinic_admin", "branch_admin", "super_admin"],
  "/stats": ["super_admin", "clinic_admin", "branch_admin", "doctor"],
};

const ROLE_HOME: Record<string, string> = {
  super_admin: "/admin/super",
  clinic_admin: "/admin",
  branch_admin: "/admin",
  doctor: "/doctor",
  receptionist: "/reception",
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public sahifalar va asosiy /
  if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // API route'lar uchun authentication har route'da alohida tekshiriladi
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Token tekshiruvi
  const token = req.cookies.get("auth_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyTokenEdge(token);
  if (!payload) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("auth_token");
    return res;
  }

  // Role-based access control
  for (const [path, roles] of Object.entries(ROLE_PATHS)) {
    if (pathname.startsWith(path) && !roles.includes(payload.role)) {
      const home = ROLE_HOME[payload.role] ?? "/login";
      return NextResponse.redirect(new URL(home, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)"],
};
```

### Qadam 3: Commit

```bash
git add src/lib/auth-edge.ts src/middleware.ts
git commit -m "fix(auth): branch_admin role in middleware + auth-edge branchId

Phase 0.8.1 — Faza 3 to'liq integratsiya:
- auth-edge.ts: JwtPayload interfeysiga branchId qo'shildi
- auth-edge.ts: payload validation (type guard) qo'shildi
- middleware.ts: ROLE_PATHS, ROLE_HOME ga branch_admin qo'shildi
- branch_admin endi /admin, /doctor, /reception, /stats ga kira oladi
- Scope tekshiruvi lib/permissions.ts helper'larida (canManageBranch, ...)

Schema'da role bor edi, JWT da branchId bor edi, lekin middleware
bilmasdi — bu fix shu gap'ni yopadi."
```

### Tekshirish
1. Vercel deploy `READY` bo'lishini kuting
2. `/api/health` — `status: "ok"`
3. `branch_admin` username yaratish testi: `tib_badmin_xxxxxx` username bilan login qilib /admin sahifaga kirib ko'ring

---

# 🟡 TASK 0.8.2 — `/admin/super` sa_key cookie gating

## Muammo
`SUPERADMIN_KEY` env variable bor, `.env.example`'da kommentariya `/admin/super/auth` sahifasi orqali kiritilsa `sa_key` cookie o'rnatiladi va middleware ruxsat beradi. **AMMO**: hozirgi middleware'da `sa_key` cookie tekshirilmayapti — faqat `role === "super_admin"` ko'riladi.

Bu degani: agar super_admin token leak bo'lsa, hujumchi /admin/super'ga kira oladi. Ikkinchi himoya qatlami yo'q.

## Yechim
Middleware'ga ikkinchi tekshiruv qo'shamiz:
- `/admin/super/auth` o'zi gate'siz ochiq (key kiritish uchun)
- `/admin/super/*` qolgan barchasi:
  1. role === "super_admin" (allaqachon ROLE_PATHS'da)
  2. **VA** `sa_key` cookie SUPERADMIN_KEY ga teng bo'lishi shart

Agar `SUPERADMIN_KEY` env var set qilinmagan bo'lsa (dev environment), bu tekshiruv skip qilinadi.

## Bajarish

### Qadam 1: `src/middleware.ts` ni qayta yangilash

**MUHIM**: Bu fix Task 0.8.1 dan **keyin** bajariladi. Hozirgi `src/middleware.ts` (0.8.1 dan keyin) ni quyidagicha o'zgartiring:

`src/middleware.ts` — **butun fayl**:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyTokenEdge } from "@/lib/auth-edge";

const PUBLIC_PATHS = [
  "/login",
  "/webapp",
  "/api/services",
  "/api/book",
  "/api/slots",
  "/api/webhook",
  "/api/clinics",
];

const ROLE_PATHS: Record<string, string[]> = {
  "/admin/super": ["super_admin"],
  "/admin": ["super_admin", "clinic_admin", "branch_admin"],
  "/doctor": ["doctor", "clinic_admin", "branch_admin", "super_admin"],
  "/reception": ["receptionist", "clinic_admin", "branch_admin", "super_admin"],
  "/stats": ["super_admin", "clinic_admin", "branch_admin", "doctor"],
};

const ROLE_HOME: Record<string, string> = {
  super_admin: "/admin/super",
  clinic_admin: "/admin",
  branch_admin: "/admin",
  doctor: "/doctor",
  receptionist: "/reception",
};

/**
 * /admin/super uchun ikkinchi himoya qatlami.
 * super_admin roli yetarli emas — sa_key cookie ham bo'lishi kerak.
 * sa_key qiymati SUPERADMIN_KEY env var bilan tekshiriladi.
 * /admin/super/auth — gate'siz (foydalanuvchi key kiritadi).
 * SUPERADMIN_KEY set qilinmagan bo'lsa (dev), gate skip qilinadi.
 */
function checkSuperAdminGate(req: NextRequest): boolean {
  const pathname = req.nextUrl.pathname;

  // /admin/super/auth — gate yo'q (foydalanuvchi key kiritadi)
  if (pathname === "/admin/super/auth" || pathname.startsWith("/admin/super/auth/")) {
    return true;
  }

  // Faqat /admin/super/* uchun ishlaydi
  if (!pathname.startsWith("/admin/super")) {
    return true;
  }

  const expected = process.env.SUPERADMIN_KEY;
  // Dev: SUPERADMIN_KEY set qilinmagan bo'lsa, gate'ni skip qil
  if (!expected) return true;

  const saKey = req.cookies.get("sa_key")?.value;
  return saKey === expected;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("auth_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyTokenEdge(token);
  if (!payload) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("auth_token");
    return res;
  }

  // Role-based access
  for (const [path, roles] of Object.entries(ROLE_PATHS)) {
    if (pathname.startsWith(path) && !roles.includes(payload.role)) {
      const home = ROLE_HOME[payload.role] ?? "/login";
      return NextResponse.redirect(new URL(home, req.url));
    }
  }

  // SuperAdmin sa_key gate (ikkinchi qatlam)
  if (!checkSuperAdminGate(req)) {
    return NextResponse.redirect(new URL("/admin/super/auth", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)"],
};
```

### Qadam 2: Commit

```bash
git add src/middleware.ts
git commit -m "security(middleware): add sa_key gate for /admin/super

Phase 0.8.2 — Ikkinchi himoya qatlami:
- super_admin roli yetarli emas, sa_key cookie kerak
- /admin/super/auth gate'siz (foydalanuvchi key kiritadi)
- SUPERADMIN_KEY env'da bo'lmasa (dev), gate skip
- Token leak bo'lsa ham, sa_key cookie kerak

ENV: SUPERADMIN_KEY allaqachon set qilingan (Vercel dashboard'da)"
```

### Tekshirish
1. Deploy `READY` kuting
2. Browser'da `sa_key` cookie'ni o'chiring (DevTools → Application → Cookies)
3. `/admin/super`'ga kiring — `/admin/super/auth` ga redirect bo'lishi kerak
4. `/admin/super/auth`'da SUPERADMIN_KEY kiriting → cookie set bo'ladi → /admin/super ga kirish ochiladi

---

# 🔴 TASK 0.8.3 — Payment Secrets AES-256-GCM Encryption

## Muammo
`src/lib/payment/secrets.ts` hozir **identity** — secret'lar ochiq matnda. `clinics.paymentConfig.payme.secretKey` va `click.secretKey` DB'da plaintext. Agar DB dump leak bo'lsa, to'lov tizimi to'liq buziladi.

## Yechim
- **AES-256-GCM** symmetric encryption (NodeJS native `crypto`)
- Master key — `PAYMENT_ENCRYPTION_KEY` env var (32 byte base64)
- Format: `enc:v1:<iv_base64>:<ciphertext_base64>:<authtag_base64>`
- Prefix `enc:v1:` orqali eski plaintext secret'lardan farqlanadi (backward compatible)
- `decryptSecret()` plaintext (eski) va `enc:v1:...` (yangi) ikkalasini ham qabul qiladi
- Yangi yozilgan secret'lar har doim encrypt qilinadi

**MUHIM**: Bu fix faqat kod o'zgaradi. DB'dagi mavjud secret'lar **plaintext qoladi** (backward compat). Yangi yozilganlar encrypted bo'ladi. Migration script (`scripts/migrate-payment-secrets.ts`) keyinroq yaratamiz — hozir kerak emas.

## Bajarish

### Qadam 1: ENV variable qo'shish

**Vercel Dashboard → Settings → Environment Variables**'da yangi variable qo'shing:
- **Name**: `PAYMENT_ENCRYPTION_KEY`
- **Value**: `openssl rand -base64 32` ning natijasi (32 byte base64)
- **Environment**: Production, Preview, Development

**Generatsiya** (terminalda):
```bash
openssl rand -base64 32
# Misol natija: kJ8vL2pX9zQ3mY7nR4wB6tC1sH5fA8dG2eI0uK4jN9c=
```

Bu qiymatni Vercel'da set qiling. Hech qaerda commit qilinmaydi.

### Qadam 2: `.env.example` ga qo'shish

**Fayl**: `.env.example`

`SUPERADMIN_KEY` blokidan **keyin** (faylning oxiriga) quyidagi blokni qo'shing:

```bash

# ─── Payment Secrets Encryption ──────────────────────────────────────────────
# Klinika payment konfiguratsiyasi (Payme/Click secret keys)
# uchun AES-256-GCM symmetric encryption master key.
# Generatsiya: openssl rand -base64 32
# Eslatma: bu kalitni o'zgartirsangiz, eski encrypted secret'lar dekriptsiya
# qilinmaydi. Production'da rotate qilish uchun migration script kerak.
PAYMENT_ENCRYPTION_KEY="generate-32-byte-base64-key-here"
```

### Qadam 3: `src/lib/payment/secrets.ts` ni to'liq almashtirish

**Fayl**: `src/lib/payment/secrets.ts`

**Yangi to'liq kontent** (eski 24 satr o'rniga):
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Payment provider secret'larini AES-256-GCM bilan shifrlash/deshifrlash.
 *
 * Format: enc:v1:<iv_base64>:<ciphertext_base64>:<authtag_base64>
 *
 * Backward compatibility: agar matn "enc:v1:" prefiksi bilan boshlanmasa,
 * u plaintext deb hisoblanadi va o'zgartirilmasdan qaytariladi (eski data).
 * Bu Phase 0.8.3 deployment'idan oldin yozilgan secret'lar bilan ishlash uchun.
 *
 * KELAJAK (Sprint 5): migrate-payment-secrets.ts script orqali barcha eski
 * plaintext secret'lar encrypted formatga ko'chiriladi va backward compat olib tashlanadi.
 */

const ENC_PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM uchun standart
const KEY_LENGTH = 32; // AES-256 uchun 32 byte

function getMasterKey(): Buffer {
  const raw = process.env.PAYMENT_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "PAYMENT_ENCRYPTION_KEY env variable not set. Generate one with: openssl rand -base64 32"
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `PAYMENT_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (current: ${key.length}). ` +
      `Use: openssl rand -base64 32`
    );
  }
  return key;
}

/**
 * Plaintext matnni encrypt qiladi.
 * Natija: enc:v1:<iv>:<ciphertext>:<authtag> formatda string.
 */
export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  // Idempotency: agar allaqachon encrypted bo'lsa, qayta encrypt qilmaymiz
  if (plain.startsWith(ENC_PREFIX)) return plain;

  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return (
    ENC_PREFIX +
    iv.toString("base64") + ":" +
    ciphertext.toString("base64") + ":" +
    authTag.toString("base64")
  );
}

/**
 * Encrypted matnni decrypt qiladi.
 * Backward compat: agar enc:v1: prefiksi yo'q bo'lsa, plaintext deb qaytaradi.
 */
export function decryptSecret(stored: string): string {
  if (!stored) return stored;
  // Backward compat: eski plaintext secret'lar
  if (!stored.startsWith(ENC_PREFIX)) return stored;

  const payload = stored.slice(ENC_PREFIX.length);
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format (expected enc:v1:iv:ct:tag)");
  }
  const [ivB64, ctB64, tagB64] = parts;

  const key = getMasterKey();
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Secret'ni UI'da ko'rsatish uchun mask qiladi.
 * Mavjud holatda decrypt qilmaydi — buni faqat secret yaratuvchi sahifalar uchun chaqir.
 */
export function maskSecret(secret: string | undefined): string {
  if (!secret) return "(yo'q)";
  // Encrypted bo'lsa, "(shifrlangan)" deb qaytar
  if (secret.startsWith(ENC_PREFIX)) return "(shifrlangan)";
  if (secret.length <= 4) return "****";
  return secret.slice(0, 2) + "****" + secret.slice(-2);
}

/**
 * Encryption mavjudligini tekshirish (debug/health uchun).
 */
export function isEncryptionConfigured(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}
```

### Qadam 4: Test fayl yaratish

**Fayl**: `src/lib/__tests__/payment-secrets.test.ts`

Bu fayl yangi yaratiladi. Loyihada Vitest sozlangan (`vitest.config.ts` bor, `package.json`'da `"test": "vitest run"`).

**Kontent**:
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret, maskSecret, isEncryptionConfigured } from "../payment/secrets";

// Test uchun deterministik key
beforeAll(() => {
  // 32 byte base64 — test uchun
  process.env.PAYMENT_ENCRYPTION_KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
});

describe("payment/secrets", () => {
  it("encrypts and decrypts roundtrip", () => {
    const plain = "my-very-secret-key-12345";
    const encrypted = encryptSecret(plain);
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain(plain);

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(plain);
  });

  it("backward compat: plaintext passes through decrypt", () => {
    const plain = "old-plaintext-secret";
    expect(decryptSecret(plain)).toBe(plain);
  });

  it("encrypting already-encrypted is idempotent", () => {
    const plain = "my-secret";
    const encrypted = encryptSecret(plain);
    const doubleEncrypted = encryptSecret(encrypted);
    expect(doubleEncrypted).toBe(encrypted);
  });

  it("different IV each time (non-deterministic)", () => {
    const plain = "same-secret";
    const enc1 = encryptSecret(plain);
    const enc2 = encryptSecret(plain);
    expect(enc1).not.toBe(enc2);
    expect(decryptSecret(enc1)).toBe(plain);
    expect(decryptSecret(enc2)).toBe(plain);
  });

  it("tampering with ciphertext throws", () => {
    const encrypted = encryptSecret("my-secret");
    const tampered = encrypted.slice(0, -10) + "AAAAAAAAAA";
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("mask encrypted secret shows (shifrlangan)", () => {
    const encrypted = encryptSecret("my-secret");
    expect(maskSecret(encrypted)).toBe("(shifrlangan)");
  });

  it("mask plaintext shows first 2 + **** + last 2", () => {
    expect(maskSecret("abcdefgh")).toBe("ab****gh");
  });

  it("mask empty/undefined", () => {
    expect(maskSecret(undefined)).toBe("(yo'q)");
    expect(maskSecret("")).toBe("(yo'q)");
    expect(maskSecret("abc")).toBe("****");
  });

  it("isEncryptionConfigured returns true when key set", () => {
    expect(isEncryptionConfigured()).toBe(true);
  });

  it("empty string passes through encrypt", () => {
    expect(encryptSecret("")).toBe("");
  });

  it("throws if key is wrong length", () => {
    const oldKey = process.env.PAYMENT_ENCRYPTION_KEY;
    process.env.PAYMENT_ENCRYPTION_KEY = "tooshort";
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
    process.env.PAYMENT_ENCRYPTION_KEY = oldKey;
  });
});
```

### Qadam 5: Test'larni mahalliy ishga tushirish

```bash
npm test
```

Hammasi yashil bo'lishi kerak. Agar xato bo'lsa:
- `Cannot find module 'crypto'` → Node 18+ bo'lishi kerak (loyiha 24.x'da)
- `vitest not found` → `npm install` qiling

### Qadam 6: Commit

```bash
git add src/lib/payment/secrets.ts src/lib/__tests__/payment-secrets.test.ts .env.example
git commit -m "security(payment): AES-256-GCM encryption for provider secrets

Phase 0.8.3 — Payment secret'larni encrypt qilish:
- AES-256-GCM symmetric encryption (NodeJS native crypto)
- Format: enc:v1:<iv>:<ct>:<authtag> (base64)
- Master key: PAYMENT_ENCRYPTION_KEY env var (32 byte base64)
- Backward compat: eski plaintext secret'lar decrypt'da skip
- Idempotent: ikki marta encrypt qilish bir xil natija
- 10 ta unit test (Vitest)
- maskSecret: encrypted bo'lsa '(shifrlangan)' qaytaradi

ENV (Vercel'da set qilinishi kerak):
- PAYMENT_ENCRYPTION_KEY (32 byte base64)

Migration: hozirgi DB'dagi plaintext secret'lar saqlanadi (backward compat).
Sprint 5'da migration script orqali encrypted formatga ko'chiriladi.

NOTE: production'da PAYMENT_ENCRYPTION_KEY yo'q bo'lsa, payment yaratish
xato beradi (eski secret'lar baribir ishlaydi). Shu uchun deploy'dan
oldin Vercel ENV'ga qo'shish SHART."
```

### Qadam 7: Vercel ENV tekshirish

**Bu qadam ENG MUHIM — kodni push qilishdan oldin** bajariling:

1. Vercel Dashboard → tibtaqvim → Settings → Environment Variables
2. `PAYMENT_ENCRYPTION_KEY` qo'shilgan ekanini tasdiqlang
3. Hammasi (Production + Preview + Development) tanlanganini tekshiring

Agar env yo'q bo'lsa va kod push qilingan bo'lsa, **payment-related endpoint'lar build'da ishlamasligi mumkin** (lekin runtime'da ham, faqat encrypt yangi secret yozish chaqirilsa). Lekin **eski to'lovlar** (plaintext secret bilan) ishlayveradi backward compat tufayli.

### Tekshirish (deploy'dan keyin)
1. `/api/health?verbose=1` — `status: "ok"`
2. Admin panelda klinika payment config sahifasiga kiring (super_admin sifatida)
3. Yangi Payme secret kiriting va save qiling
4. DB'da `clinics.paymentConfig.payme.secretKey` `enc:v1:...` bilan boshlanishi kerak

---

# 📋 YAKUNIY CHECKLIST

**Repo o'zgarishlari** (har task alohida commit):
- [ ] Task 0.8.1 — `auth-edge.ts` + `middleware.ts` (1 commit)
- [ ] Task 0.8.2 — `middleware.ts` sa_key gate (1 commit)
- [ ] Task 0.8.3 — `secrets.ts` + test + `.env.example` (1 commit)
- [ ] Vercel ENV: `PAYMENT_ENCRYPTION_KEY` qo'shildi
- [ ] 3 ta commit push qilindi
- [ ] Vercel'da 3 ta yangi deploy `READY` holatida

**Smoke test** (deploy'dan keyin):
- [ ] `/api/health?verbose=1` — status ok
- [ ] `/api/clinics` — 3 klinika qaytadi
- [ ] `tib_badmin_xxxxxx` username bilan login → /admin ga kira oladi
- [ ] `sa_key` cookie o'chirilgan holda /admin/super → redirect /admin/super/auth
- [ ] `npm test` — 10/10 test yashil
- [ ] Yangi Payme secret kiritish → DB'da `enc:v1:...` formatda

---

# 🚫 QILMASLIK KERAK

- ❌ **`prisma/schema.prisma`'ga tegma** — bu fix'lar uchun migration kerak emas
- ❌ **`src/lib/auth.ts`'ga tegma** (auth-edge.ts emas) — node runtime, branchId allaqachon bor
- ❌ **`src/lib/permissions.ts`'ga tegma** — barcha kerakli helper'lar bor
- ❌ **DB'dagi mavjud `clinics.paymentConfig.secretKey` ni qo'lda encrypt qilma** — backward compat ishlaydi
- ❌ **3 task'ni bir commit'da birlashtirma**

---

# 🆘 AGAR XATO BO'LSA

- **Build fails — `branchId does not exist on JwtPayload`** → `auth-edge.ts`'ni qayta tekshiring, interface'da `branchId` bormi
- **`/admin/super` har doim auth'ga redirect** → Vercel ENV'da `SUPERADMIN_KEY` borligini tekshiring, va siz `sa_key` cookie'ni avval set qilganmisiz
- **`encryptSecret` throws PAYMENT_ENCRYPTION_KEY** → Vercel ENV'da `PAYMENT_ENCRYPTION_KEY` qo'shilganmi
- **Test fails on encrypting** → ENV `AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=` to'g'ri set'lanmagani uchun. Test fayl boshida `beforeAll` ishlashi kerak.

---

**Boshlang. Ishni Task 0.8.1 → 0.8.2 → 0.8.3 tartib bilan bajaring. Har task tugagandan keyin commit + push qiling va Vercel deploy READY bo'lishini kuting.**
