-- ============================================================
-- Multi-Clinic Foundation — Bosqich 1
-- clinics: 5 faol + 4 kelajak ustun
-- branches: 5 faol ustun
-- ============================================================

-- Yangi enum'lar
CREATE TYPE "SubscriptionPlan" AS ENUM ('starter', 'standard', 'premium');
CREATE TYPE "SubscriptionStatus" AS ENUM ('trial', 'active', 'past_due', 'suspended', 'cancelled');

-- Clinic — faol ustunlar
ALTER TABLE "clinics"
  ADD COLUMN "description"  TEXT,
  ADD COLUMN "city"         TEXT,
  ADD COLUMN "workingHours" TEXT,
  ADD COLUMN "rating"       REAL NOT NULL DEFAULT 0,
  ADD COLUMN "ratingCount"  INTEGER NOT NULL DEFAULT 0;

-- Clinic — kelajak uchun nofaol ustunlar (maydon bor, lekin bosqich 2/3 gacha ishlatilmaydi)
ALTER TABLE "clinics"
  ADD COLUMN "paymentConfig"         JSONB,
  ADD COLUMN "subscriptionPlan"      "SubscriptionPlan" NOT NULL DEFAULT 'starter',
  ADD COLUMN "subscriptionStatus"    "SubscriptionStatus" NOT NULL DEFAULT 'trial',
  ADD COLUMN "subscriptionExpiresAt" TIMESTAMP(3);

-- Branch — faol ustunlar
ALTER TABLE "branches"
  ADD COLUMN "latitude"     DOUBLE PRECISION,
  ADD COLUMN "longitude"    DOUBLE PRECISION,
  ADD COLUMN "nearbyMetro"  TEXT,
  ADD COLUMN "workingHours" TEXT,
  ADD COLUMN "sortOrder"    INTEGER NOT NULL DEFAULT 0;

-- Indexlar
CREATE INDEX "clinics_isActive_city_idx" ON "clinics"("isActive", "city");
CREATE INDEX "clinics_subscriptionStatus_idx" ON "clinics"("subscriptionStatus");
CREATE INDEX "branches_clinicId_sortOrder_idx" ON "branches"("clinicId", "sortOrder");

-- ============================================================
-- BACKWARD COMPATIBILITY — Mavjud klinikani to'liq sozlash
-- ============================================================

UPDATE "clinics" SET
  "city"                  = COALESCE("city", 'Toshkent'),
  "description"           = COALESCE("description", 'Tibbiy klinika — sifatli xizmatlar'),
  "workingHours"          = COALESCE("workingHours", '08:00-20:00'),
  "subscriptionPlan"      = 'premium',
  "subscriptionStatus"    = 'active',
  "subscriptionExpiresAt" = NOW() + INTERVAL '1 year'
WHERE "subscriptionPlan" = 'starter' AND "subscriptionStatus" = 'trial';

UPDATE "branches" SET
  "workingHours" = COALESCE("workingHours", '08:00-20:00')
WHERE "workingHours" IS NULL;
