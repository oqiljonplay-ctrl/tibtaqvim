# 🏢 FILIAL IZOLYATSIYASI — Arxitektura + To'liq Kodli Reja
## Bosh ofis va filiallar mustaqil bo'lishi

> Bu hujjat 2 qismdan: (1) Arxitektura tushunchasi va qarorlar, (2) VS Code Claude uchun bosqichma-bosqich kodli prompt. To'liq o'qing.

---

# QISM 1 — ARXITEKTURA TUSHUNCHASI

## 1.1 — Maqsad

Hozir: barcha xizmat/shifokor/bron klinika darajasida aralash. Filial admini hamma narsani ko'radi.

Kerak:
- **Bosh ofis = klinikaning o'zi** (`branchId = NULL`)
- **Filiallar** = alohida `branch` yozuvlari, har biri **mustaqil**
- Har bir admin **faqat o'z darajasini** ko'radi:
  - **super_admin** → hamma klinika, hamma filial
  - **clinic_admin (bosh ofis)** → faqat bosh ofis ma'lumotlari (`branchId = NULL`)
  - **branch_admin (filial)** → faqat o'z filiali (`branchId = <o'z filiali>`)
- Bosh ofis xizmat/shifokor yaratsa → faqat bosh ofisда (filialga tegmaydi)
- Filial xizmat/shifokor yaratsa → faqat o'z filialida
- **Filial admini admin yarata olmaydi** (faqat super_admin admin yaratadi)

## 1.2 — Model (eng muhim qaror)

**Bosh ofis = `branchId IS NULL`**. Filial = `branchId = <branch.id>`.

Har bir resurs (`service`, `doctor`, `appointment`, `slot`, `staff`, `user`) `branchId` ga ega:
- `branchId IS NULL` → bosh ofisники
- `branchId = X` → X filialники

**Scope qoidasi** (har bir API'da):
```
super_admin   → barcha (ixtiyoriy clinicId filter)
clinic_admin  → clinicId = auth.clinicId AND branchId IS NULL   (faqat bosh ofis)
branch_admin  → clinicId = auth.clinicId AND branchId = auth.branchId  (faqat o'z filiali)
```

## 1.3 — Eng katta o'zgarish: `services.branchId`

`services` jadvalida hozir `branchId` **YO'Q**. Qo'shamiz (nullable). Bu butun rejaning markazi.

## 1.4 — Data migratsiyasi (mavjud ma'lumot) — TASDIQLANGAN

Hozir: 7 shifokor `branch-main` (KAMALAK) da, 9 xizmat `branchId`siz (faqat clinicId).

**Tahlil natijasi** (audit_logs + createdAt): Kamalak admin **21-may**'da yaratilgan, barcha shifokor/xizmat **undan oldin** mavjud edi. Ya'ni Kamalak admini hali hech narsa yaratmagan — hammasi **bosh ofisники**.

**TASDIQLANGAN migratsiya qarori (2026-05-22)**:
- **7 shifokor → bosh ofis** (`branchId = NULL`)
- **9 xizmat → bosh ofis** (`branchId = NULL`)
- **KAMALAK → BO'SH** qoladi — admini keyin o'zi to'ldiradi
- Bronlar → tegishli shifokor branchId'siga moslab (hozir → NULL)

> Bu maqsadga mukammal mos: filial admini o'zi yaratganда, o'sha filialда paydo bo'ladi. KAMALAK toza start oladi. Claude bu migratsiyani S1 dan keyin bajaradi.

## 1.5 — Ruxsatlar matritsasi

| Amal | super_admin | clinic_admin (bosh ofis) | branch_admin (filial) |
|---|---|---|---|
| Klinika yaratish | ✅ | ❌ | ❌ |
| Filial yaratish | ✅ | ✅ (o'z klinikasiga) | ❌ |
| Admin yaratish (clinic/branch) | ✅ | ❌ | ❌ |
| Xizmat yaratish | ✅ | ✅ (bosh ofisga) | ✅ (o'z filialiga) |
| Shifokor yaratish | ✅ | ✅ (bosh ofisga) | ✅ (o'z filialiga) |
| Bron/statistika ko'rish | barcha | bosh ofis | o'z filiali |

> **TASDIQLANGAN** (2026-05-22): Filial yaratish — **super_admin + clinic_admin**. Admin yaratish — **faqat super_admin**. Filial admini na filial, na admin yarata oladi (faqat o'z filialiga xizmat/shifokor qo'shadi).

---

# QISM 2 — TEXNIK BOSQICHLAR

Bu katta migratsiya. **5 ta sprint**ga bo'linadi. Har birини alohida bajaring, sinab, keyin keyingisiga o'ting.

| Sprint | Nima | Risk |
|---|---|---|
| **S1** | DB: `services.branchId` qo'shish + migration | O'rta |
| **S2** | Data: mavjud xizmat/shifokorni to'g'ri taqsimlash | Yuqori (Claude/Supabase qiladi) |
| **S3** | API scope: barcha admin API'ga 3-darajali scope | Yuqori |
| **S4** | UI: admin panel filial konteksti + tugmalar | O'rta |
| **S5** | Bron oqimi: WebApp/bot branchId bilan | O'rta |

---

# 🔧 SPRINT 1 — `services.branchId` qo'shish

## S1.1 — Prisma schema o'zgarishi

**Fayl**: `prisma/schema.prisma`

`model Service` ichida `clinicId` qatoridan keyin `branchId` qo'shing:
```prisma
model Service {
  id        String   @id @default(cuid())
  clinicId  String
  branchId  String?                          // YANGI — null = bosh ofis
  // ... mavjud maydonlar ...

  clinic    Clinic   @relation(fields: [clinicId], references: [id])
  branch    Branch?  @relation(fields: [branchId], references: [id], onDelete: SetNull)  // YANGI
  // ... mavjud relation'lar ...

  @@index([clinicId])
  @@index([branchId])                        // YANGI
  // ... mavjud @@map ...
}
```

`model Branch` ichiga reverse relation qo'shing (services ro'yxati):
```prisma
model Branch {
  // ... mavjud maydonlar ...
  services  Service[]                        // YANGI reverse relation
  // ... mavjud ...
}
```

## S1.2 — Migration SQL (Claude Supabase'da apply qiladi — siz faqat fayl yaratasiz)

**Fayl**: `prisma/migrations/<timestamp>_add_service_branch_id/migration.sql`
```sql
-- services jadvaliga branchId qo'shish (nullable, null = bosh ofis)
ALTER TABLE "services" ADD COLUMN "branchId" TEXT;

ALTER TABLE "services"
  ADD CONSTRAINT "services_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "services_branchId_idx" ON "services"("branchId");
```

> **MUHIM**: Bu migration faylni faqat **commit** qiling. Apply qilmang (`prisma migrate dev` ishlatmang). Claude buni Supabase MCP orqali apply qiladi.

## S1.3 — Commit
```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add branchId to services (branch isolation S1)

- services.branchId (nullable, null=bosh ofis)
- FK to branches, ON DELETE SET NULL
- index on branchId
- Branch.services reverse relation"
```

**Keyin menga ayting** — men Supabase'da migration apply qilaman va data migratsiyasini (S2) bajaraman.

---

# 🔧 SPRINT 2 — Data migratsiyasi (CLAUDE qiladi)

Bu sprint'ni **men (Claude)** Supabase'da bajaraman, siz emas. S1 commit qilingach menga ayting.

## ✅ TAQSIMOT QARORI (TASDIQLANGAN — 2026-05-22)

`audit_logs` va yaratilish vaqtlari tahlili ko'rsatdi: **Kamalak admin 21-may'da yaratilgan**, lekin barcha 7 shifokor + 9 xizmat **undan oldin** mavjud edi. Ya'ni Kamalak admini hali hech narsa yaratmagan. Demak hozircha hamma narsa **bosh ofisники**.

**Kelishilgan migratsiya**:
- **7 shifokor → bosh ofis** (`branchId = NULL`):
  Jasur Toshmatov, Dilnoza Yusupova, Nodir Rahimov, Oqil Sayfiyev, Ruslan Qilichev, Sami Amonov, Fariz Abdullayev
- **9 xizmat → bosh ofis** (`branchId = NULL`):
  EKG, MRT, Mskt, Nevropatolog Neyroxirurg, Ortopedga kunlik kvota, Terapevt qabuli, Kardiolog qabuli, Qon tahlili (umumiy), Uyda bemor ko'rish
- **KAMALAK filiali → BO'SH** qoladi. Kamalak admini keyinchalik o'zi shifokor/xizmat yaratadi → ular avtomatik `branchId = branch-main` bo'ladi (Sprint 3 `resolveBranchIdForCreate` orqali)
- **Mavjud bronlar** → tegishli shifokor/xizmatning branchId'siga moslab to'ldiriladi (hozir hammasi bosh ofis bo'lgani uchun → NULL)

> Bu sizning arxitektura maqsadingizga mukammal mos: filial admini o'zi yaratganда, o'sha filialда paydo bo'ladi. Hozir KAMALAK toza start oladi.

## Men (Claude) bajaradigan SQL (S1 dan keyin)
1. `UPDATE services SET "branchId" = NULL WHERE "clinicId" = 'clinic-demo'` (bosh ofis)
2. `UPDATE doctors SET "branchId" = NULL WHERE "clinicId" = 'clinic-demo'` (bosh ofis)
3. Bronlarni shifokor branchId'siga moslash
4. Test klinika data'sini ham tekshirish (alohida klinika)

---

# 🔧 SPRINT 3 — API Scope (eng muhim kod qismi)

## S3.0 — Markazlashtirilgan scope helper yaratish

**Fayl**: `src/lib/branch-scope.ts` (YANGI)

```typescript
import { JwtPayload } from "@/lib/auth";

/**
 * Admin API'lar uchun branch-darajali scope filtri.
 * 3 daraja:
 *   super_admin   → barcha (clinicId ixtiyoriy)
 *   clinic_admin  → o'z klinikasi, faqat bosh ofis (branchId = null)
 *   branch_admin  → o'z klinikasi, faqat o'z filiali (branchId = auth.branchId)
 *
 * @param auth - requireAuth natijasi
 * @param explicitClinicId - super_admin uchun ?clinicId= parametri
 * @returns Prisma where filtri (clinicId + branchId)
 */
export function getBranchScope(
  auth: JwtPayload,
  explicitClinicId?: string | null
): { clinicId?: string; branchId?: string | null } {
  if (auth.role === "super_admin") {
    // super_admin: ixtiyoriy clinicId, branchId filtri yo'q (hammasini ko'radi)
    return explicitClinicId ? { clinicId: explicitClinicId } : {};
  }

  if (auth.role === "clinic_admin") {
    // bosh ofis: o'z klinikasi, branchId = null
    return { clinicId: auth.clinicId!, branchId: null };
  }

  if (auth.role === "branch_admin") {
    // filial: o'z klinikasi, o'z filiali
    return { clinicId: auth.clinicId!, branchId: auth.branchId ?? undefined };
  }

  // boshqa rollar (doctor, receptionist) — eng cheklangan
  return { clinicId: auth.clinicId! };
}

/**
 * Yangi resurs yaratishda branchId ni aniqlaydi.
 *   super_admin   → body.branchId (ixtiyoriy)
 *   clinic_admin  → null (bosh ofis)
 *   branch_admin  → auth.branchId (o'z filiali, majburiy)
 */
export function resolveBranchIdForCreate(
  auth: JwtPayload,
  bodyBranchId?: string | null
): string | null {
  if (auth.role === "super_admin") return bodyBranchId ?? null;
  if (auth.role === "clinic_admin") return null; // bosh ofis
  if (auth.role === "branch_admin") return auth.branchId ?? null;
  return null;
}

/** Admin yaratishga ruxsat — faqat super_admin */
export function canCreateAdmin(auth: JwtPayload): boolean {
  return auth.role === "super_admin";
}

/** Filial yaratishga ruxsat — super_admin va clinic_admin */
export function canCreateBranch(auth: JwtPayload): boolean {
  return auth.role === "super_admin" || auth.role === "clinic_admin";
}

/** Xizmat/shifokor yaratishga ruxsat — admin rollar */
export function canManageResources(auth: JwtPayload): boolean {
  return ["super_admin", "clinic_admin", "branch_admin"].includes(auth.role);
}
```

## S3.1 — `services` API

**Fayl**: `src/app/api/admin/services/route.ts`

**GET** — scope qo'shish:
```typescript
import { getBranchScope, resolveBranchIdForCreate, canManageResources } from "@/lib/branch-scope";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const explicitClinicId = new URL(req.url).searchParams.get("clinicId");
    const scope = getBranchScope(auth, explicitClinicId);

    const services = await prisma.service.findMany({
      where: { ...scope, isActive: true },
      // ... mavjud include/orderBy ...
    });
    // ... mavjud return ...
  } catch {
    return error("Server error", 500);
  }
}
```

**POST** — branchId aniqlash:
```typescript
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!canManageResources(auth)) return forbidden();

    const body = await req.json();
    // ... validatsiya ...

    const clinicId = auth.role === "super_admin" ? body.clinicId : auth.clinicId;
    if (!clinicId) return error("clinicId required");

    const branchId = resolveBranchIdForCreate(auth, body.branchId);

    const service = await prisma.service.create({
      data: {
        clinicId,
        branchId,                    // YANGI
        // ... mavjud maydonlar ...
      },
      // ...
    });
    // ... return ...
  } catch {
    return error("Server error", 500);
  }
}
```

## S3.2 — `doctors` API

**Fayl**: `src/app/api/admin/doctors/route.ts`

**GET**:
```typescript
import { getBranchScope, resolveBranchIdForCreate, canManageResources } from "@/lib/branch-scope";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const explicitClinicId = new URL(req.url).searchParams.get("clinicId");
    const scope = getBranchScope(auth, explicitClinicId);

    const doctors = await prisma.doctor.findMany({
      where: { ...scope, isActive: true },
      // ... mavjud include/orderBy ...
    });
    // ... return ...
  }
}
```

**POST**:
```typescript
export async function POST(req: NextRequest) {
  // ...
  if (!canManageResources(auth)) return forbidden();
  // ...
  const clinicId = auth.role === "super_admin" ? body.clinicId : auth.clinicId;
  const branchId = resolveBranchIdForCreate(auth, body.branchId);
  // doctor.create data ichida: clinicId, branchId, ...
}
```

## S3.3 — `stats` API

**Fayl**: `src/app/api/admin/stats/route.ts`

```typescript
import { getBranchScope } from "@/lib/branch-scope";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

    const explicitClinicId = new URL(req.url).searchParams.get("clinicId");
    const scope = getBranchScope(auth, explicitClinicId);

    // appointment'lar branchId ga ega — scope to'g'ridan-to'g'ri ishlaydi
    const [totalAppointments, todayAppointments, ...] = await Promise.all([
      prisma.appointment.count({ where: { ...scope } }),
      prisma.appointment.count({ where: { ...scope, ...todayFilter } }),
      // ...
      prisma.doctor.count({ where: { ...scope, isActive: true } }),
      prisma.service.count({ where: { ...scope, isActive: true } }),
      // ...
    ]);
    // ... return ...
  }
}
```

## S3.4 — `branches` API

**Fayl**: `src/app/api/admin/branches/route.ts`

**GET** — super_admin va clinic_admin ko'radi (filiallar ro'yxati klinika darajasi):
```typescript
export async function GET(req: NextRequest) {
  // super_admin va clinic_admin: o'z klinikasining filiallari
  // branch_admin: filiallar ro'yxatiga kirmaydi (faqat o'z filiali)
  if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();
  // ... mavjud kod (clinicId scope) ...
}
```

**POST** — filial yaratish (super_admin + clinic_admin):
```typescript
import { canCreateBranch } from "@/lib/branch-scope";

export async function POST(req: NextRequest) {
  // ...
  if (!canCreateBranch(auth)) return forbidden();
  // ... mavjud kod ...
}
```

## S3.5 — `staff` API

**Fayl**: `src/app/api/admin/staff/route.ts`

GET'ga scope, POST'ga `canManageResources` (branch_admin o'z xodimini qo'sha oladi):
```typescript
import { getBranchScope, resolveBranchIdForCreate, canManageResources } from "@/lib/branch-scope";

// GET: where: { ...getBranchScope(auth, explicitClinicId) }
// POST: if (!canManageResources(auth)) return forbidden();
//       branchId = resolveBranchIdForCreate(auth, body.branchId);
```

## S3.6 — Commit
```bash
git add src/lib/branch-scope.ts src/app/api/admin/
git commit -m "feat(api): 3-level branch scope for all admin endpoints (S3)

- branch-scope.ts: getBranchScope, resolveBranchIdForCreate, can* helpers
- super_admin: barcha; clinic_admin: bosh ofis (branchId=null);
  branch_admin: o'z filiali (branchId=auth.branchId)
- services GET/POST: branchId scope + create
- doctors GET/POST: branchId scope + create
- stats: scope (appointments+doctors+services)
- branches: GET super+clinic, POST canCreateBranch
- staff: GET scope, POST canManageResources
- Admin yaratish faqat super_admin (canCreateAdmin)"

git push origin main
```

---

# 🔧 SPRINT 4 — Admin panel UI

> page.tsx fayllari katta. Avval o'qing. Asosiy o'zgarishlar:

## S4.1 — Filial yaratish/admin yaratish tugmalari
- **Filial yaratish**: faqat super_admin + clinic_admin ko'rsin
- **Admin yaratish**: faqat super_admin ko'rsin (branch_admin'da yashirin)

## S4.2 — Yangi xizmat/shifokor — branchId avtomatik
- clinic_admin yaratganda → `branchId = null` (frontend yubormaydi, backend hal qiladi)
- branch_admin yaratganda → `branchId = auth.branchId` (backend hal qiladi)
- Frontend `branchId` yubormasligi mumkin — backend `resolveBranchIdForCreate` hal qiladi

## S4.3 — super_admin uchun filial tanlovchi (ixtiyoriy)
super_admin xizmat/shifokor yaratganda qaysi filial yoki bosh ofisga ekanini tanlasin.

## S4.4 — Commit
```bash
git add src/app/admin/
git commit -m "feat(ui): branch-aware admin panel (S4)

- Filial yaratish tugmasi: super_admin + clinic_admin
- Admin yaratish: faqat super_admin
- Xizmat/shifokor branchId backend tomonidan hal qilinadi"
git push origin main
```

---

# 🔧 SPRINT 5 — Bron oqimi (WebApp/Bot)

## S5.1 — WebApp xizmat ro'yxati branchId bilan
Bemor klinika tanlaganda, qaysi filialни tanlashi kerak (yoki bosh ofis). Xizmatlar `branchId` bo'yicha ko'rsatiladi.

## S5.2 — Bron yaratishda branchId saqlash
`appointment.create` da `branchId` to'ldiriladi (xizmat qaysi filialники bo'lsa, bron ham o'sha filialники).

## S5.3 — Commit (alohida, keyinroq)

> S5 — keyingi bosqich. Avval S1-S4 ni tugatamiz.

---

# 🧪 UMUMIY SINOV (S1-S4 dan keyin)

1. **super_admin** → barcha klinika/filial ko'radi
2. **clinic_admin (bosh ofis)** → faqat bosh ofis xizmat/shifokor/stat (`branchId=null`)
3. **branch_admin (KAMALAK)** → faqat KAMALAK xizmat/shifokor/stat
4. Bosh ofis yangi xizmat yaratadi → faqat bosh ofisда ko'rinadi (KAMALAK'da yo'q)
5. KAMALAK yangi xizmat yaratadi → faqat KAMALAK'da (bosh ofisда yo'q)
6. branch_admin "Admin yaratish" tugmasini ko'rmaydi
7. branch_admin "Filial yaratish" tugmasini ko'rmaydi

---

# 🚫 QILMASLIK KERAK

- ❌ S1-S2-S3-S4 ni aralashtirib bajarma — har sprint alohida commit + sinov
- ❌ Migration'ni `prisma migrate dev` bilan apply qilma — Claude Supabase'da qiladi
- ❌ Data migratsiyasini (S2) o'zing qilma — Claude qiladi (taqsimot tasdiqlangan: hammasi bosh ofis)
- ❌ `appointment.branchId` ni to'satdan majburiy qilma — nullable qoladi
- ❌ Eski bronlar branchId=null bo'lsa ham buzilmasin

---

# 🆘 BOSHLASH TARTIBI

1. **S1** (schema + migration fayl) → commit → **menga ayting**
2. Men **S2** (Supabase data migratsiya) ni qilaman — taqsimot allaqachon tasdiqlangan (hammasi bosh ofis, KAMALAK bo'sh)
3. **S3** (API scope) → commit → sinov
4. **S4** (UI) → commit → sinov
5. **S5** (bron oqimi) → keyinroq

---

**Boshlang. Faqat SPRINT 1 ni bajaring (schema + migration fayl + commit). Keyin menga ayting — qolganini birga davom ettiramiz.**
