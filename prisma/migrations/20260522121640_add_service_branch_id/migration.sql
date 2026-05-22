-- services jadvaliga branchId qo'shish (nullable, null = bosh ofis)
ALTER TABLE "services" ADD COLUMN "branchId" TEXT;

ALTER TABLE "services"
  ADD CONSTRAINT "services_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "services_branchId_idx" ON "services"("branchId");
