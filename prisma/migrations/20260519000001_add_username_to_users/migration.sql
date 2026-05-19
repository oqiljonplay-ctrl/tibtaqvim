-- AlterTable: add username column to users
ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- CreateIndex: unique constraint on username
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex: performance index on username
CREATE INDEX "users_username_idx" ON "users"("username");
