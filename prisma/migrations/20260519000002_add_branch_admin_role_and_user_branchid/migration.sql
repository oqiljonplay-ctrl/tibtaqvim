-- Add branch_admin to UserRole enum
ALTER TYPE "UserRole" ADD VALUE 'branch_admin' AFTER 'clinic_admin';

-- Add branchId column to users
ALTER TABLE "users" ADD COLUMN "branchId" TEXT;

-- Add FK constraint
ALTER TABLE "users" ADD CONSTRAINT "users_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index
CREATE INDEX "users_branchId_idx" ON "users"("branchId");
