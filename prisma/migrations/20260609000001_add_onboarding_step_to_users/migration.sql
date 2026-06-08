-- AlterTable
ALTER TABLE "users" ADD COLUMN "onboardingStep" TEXT;

-- Backfill: mavjud telefonli userlar onboarding ko'rmasin
UPDATE "users" SET "onboardingStep" = 'done' WHERE phone IS NOT NULL;
