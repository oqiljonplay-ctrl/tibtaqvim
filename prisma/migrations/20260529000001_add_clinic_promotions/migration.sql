-- CLINIC-PROMOTIONS: Telegram widget dropdown uchun yangi jadval + Clinic telegram username maydonlari

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('aksiya', 'yangilik', 'elon', 'umumiy');

-- CreateEnum
CREATE TYPE "PromotionSource" AS ENUM ('kanal', 'guruh');

-- AlterTable: Clinic'ga Telegram username maydonlari
ALTER TABLE "clinics"
  ADD COLUMN "telegramChannelUsername" TEXT,
  ADD COLUMN "telegramGroupUsername"   TEXT;

-- CreateTable
CREATE TABLE "clinic_promotions" (
    "id"                  TEXT          NOT NULL,
    "clinicId"            TEXT          NOT NULL,
    "postUrl"             TEXT          NOT NULL,
    "embedId"             TEXT          NOT NULL,
    "type"                "PromotionType"   NOT NULL DEFAULT 'umumiy',
    "source"              "PromotionSource" NOT NULL DEFAULT 'kanal',
    "title"               TEXT,
    "subscribeUsername"   TEXT,
    "showSubscribeButton" BOOLEAN       NOT NULL DEFAULT true,
    "isActive"            BOOLEAN       NOT NULL DEFAULT true,
    "sortOrder"           INTEGER       NOT NULL DEFAULT 0,
    "publishedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById"         TEXT          NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinic_promotions_clinicId_isActive_idx" ON "clinic_promotions"("clinicId", "isActive");

-- AddForeignKey
ALTER TABLE "clinic_promotions"
  ADD CONSTRAINT "clinic_promotions_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: payments jadval pattern'iga mos (deny all anon/authenticated, Prisma service_role bypass)
ALTER TABLE "clinic_promotions" ENABLE ROW LEVEL SECURITY;
