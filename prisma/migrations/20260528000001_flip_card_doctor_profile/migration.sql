-- FLIP-CARD-01: Doctor profil maydonlari + 4 yangi jadval

-- 1. doctors jadvaliga yangi ustunlar
ALTER TABLE "doctors"
  ADD COLUMN "education"       TEXT,
  ADD COLUMN "position"        TEXT,
  ADD COLUMN "department"      TEXT,
  ADD COLUMN "workSchedule"    TEXT,
  ADD COLUMN "operationsCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bio"             TEXT;

-- 2. doctor_specialties
CREATE TABLE "doctor_specialties" (
  "id"        TEXT NOT NULL,
  "doctorId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "doctor_specialties_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "doctor_specialties_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "doctor_specialties_doctorId_idx" ON "doctor_specialties"("doctorId");

-- 3. doctor_directions
CREATE TABLE "doctor_directions" (
  "id"        TEXT NOT NULL,
  "doctorId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "doctor_directions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "doctor_directions_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "doctor_directions_doctorId_idx" ON "doctor_directions"("doctorId");

-- 4. doctor_experiences
CREATE TABLE "doctor_experiences" (
  "id"        TEXT NOT NULL,
  "doctorId"  TEXT NOT NULL,
  "place"     TEXT NOT NULL,
  "startYear" INTEGER NOT NULL,
  "endYear"   INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "doctor_experiences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "doctor_experiences_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "doctor_experiences_doctorId_idx" ON "doctor_experiences"("doctorId");

-- 5. doctor_workplaces
CREATE TABLE "doctor_workplaces" (
  "id"        TEXT NOT NULL,
  "doctorId"  TEXT NOT NULL,
  "place"     TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "doctor_workplaces_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "doctor_workplaces_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "doctor_workplaces_doctorId_idx" ON "doctor_workplaces"("doctorId");

-- 6. RLS — deny-by-default (Prisma service_role bypass qiladi)
ALTER TABLE "doctor_specialties"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "doctor_directions"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "doctor_experiences"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "doctor_workplaces"   ENABLE ROW LEVEL SECURITY;
