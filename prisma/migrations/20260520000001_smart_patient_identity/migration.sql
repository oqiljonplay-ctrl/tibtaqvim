-- ============================================================
-- Smart Patient Identity — Dependent jadval, trigger, index
-- ============================================================

-- 1. dependents jadval yaratish
CREATE TABLE "dependents" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName"  TEXT,
  "phone"     TEXT,
  "relation"  TEXT,
  "birthYear" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "dependents_pkey" PRIMARY KEY ("id")
);

-- 2. Index'lar
CREATE INDEX "dependents_userId_idx" ON "dependents"("userId");
CREATE INDEX "dependents_userId_deletedAt_idx" ON "dependents"("userId", "deletedAt");

-- 3. Foreign key
ALTER TABLE "dependents"
  ADD CONSTRAINT "dependents_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. updatedAt auto-update trigger
CREATE OR REPLACE FUNCTION update_dependents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION update_dependents_updated_at() FROM PUBLIC;

CREATE TRIGGER dependents_updated_at
BEFORE UPDATE ON "dependents"
FOR EACH ROW
EXECUTE FUNCTION update_dependents_updated_at();

-- 5. Max 2 aktiv dependent cheklovi (DB darajasida)
CREATE OR REPLACE FUNCTION check_dependents_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM "dependents"
    WHERE "userId" = NEW."userId"
      AND "deletedAt" IS NULL
      AND "id" != COALESCE(NEW."id", '')
  ) >= 2 THEN
    RAISE EXCEPTION 'DEPENDENTS_LIMIT_EXCEEDED: maximum 2 active dependents allowed per user';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION check_dependents_limit() FROM PUBLIC;

CREATE TRIGGER dependents_limit_check
BEFORE INSERT OR UPDATE ON "dependents"
FOR EACH ROW
WHEN (NEW."deletedAt" IS NULL)
EXECUTE FUNCTION check_dependents_limit();

-- 6. Dublikat bron oldini olish — bir telefon + shifokor + kun = 1 bron
-- (faqat booked/arrived statuslarda, diagnostika xizmatlari uchun emas — doctorId NULL)
CREATE UNIQUE INDEX "appointments_unique_patient_doctor_date"
ON "appointments" ("patientPhone", "doctorId", "date")
WHERE "doctorId" IS NOT NULL
  AND "status" IN ('booked', 'arrived');

-- 7. RLS
ALTER TABLE "dependents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dependents_super_admin" ON "dependents"
  FOR ALL TO authenticated
  USING (current_setting('app.user_role', true) = 'super_admin');

CREATE POLICY "dependents_owner" ON "dependents"
  FOR ALL TO authenticated
  USING ("userId" = current_setting('app.user_id', true));

-- 8. Audit trigger (mavjud log_audit_event() funksiyasi ishlatiladi)
CREATE TRIGGER "audit_dependents"
AFTER INSERT OR UPDATE OR DELETE ON "dependents"
FOR EACH ROW EXECUTE FUNCTION log_audit_event();
