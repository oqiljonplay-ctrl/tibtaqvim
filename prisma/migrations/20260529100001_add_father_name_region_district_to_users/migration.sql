-- AlterTable: fatherName, region, district qo'shish
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fatherName" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "district" TEXT;
