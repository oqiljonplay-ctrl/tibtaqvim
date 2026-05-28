-- CLINIC-CURRENT-01: user_clinics — isCurrent + lastSelectedAt
-- Bemor tanlagan klinikani DB darajasida doimiy saqlash

-- 1. Yangi ustunlar qo'shish
ALTER TABLE "user_clinics"
  ADD COLUMN "isCurrent"      BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN "lastSelectedAt" TIMESTAMP(3);

-- 2. Tez topish uchun composite index
CREATE INDEX "user_clinics_userId_isCurrent_idx"
  ON "user_clinics"("userId", "isCurrent");

-- 3. DB kafolat: har user uchun faqat BITTA isCurrent=true (partial unique index)
CREATE UNIQUE INDEX "user_clinics_one_current_per_user"
  ON "user_clinics"("userId")
  WHERE "isCurrent" = true;

-- 4. Data migration: mavjud bemorlar uchun eng so'nggi qo'shilgan klinikani aktiv qil
UPDATE "user_clinics"
SET "isCurrent" = true
WHERE id IN (
  SELECT DISTINCT ON ("userId") id
  FROM "user_clinics"
  WHERE "isActive" = true
  ORDER BY "userId", "joinedAt" DESC
);
