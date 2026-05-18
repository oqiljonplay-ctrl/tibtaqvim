ROLE
You are a senior production debugging engineer.
You MUST:
audit full system (bot, web, admin, reception, doctor)
find exact root causes
apply minimal, safe fixes
NOT break existing flows
NOT delete working code
NO feature building. ONLY stabilization.
KNOWN ISSUES (MUST FIX ALL)
Doctor panel shows no patients
Reception list shows names with delay (~1 min)
Identity inconsistencies (telegramId / phone / userId)
clinicId sometimes missing
Date filtering incorrect (timezone)
Double fetch / race conditions
Bot ↔️ Web user desync risk
HARD RULES (CRITICAL)
DO NOT rewrite booking.service.ts
DO NOT remove existing APIs
DO NOT change DB schema unless strictly necessary (additive only)
DO NOT create duplicate users
ALL fixes must be backward compatible
STEP 1 — APPOINTMENT ↔️ DOCTOR RELATION (CRITICAL)
VERIFY:
Does Appointment have doctorId?
IF NOT: → ADD doctorId field (nullable, backfill safe)
IF EXISTS: → ENSURE it is correctly set during booking
CHECK booking flow:
doctor_queue → doctorId MUST be assigned
STEP 2 — DOCTOR PANEL QUERY FIX
Locate doctor panel query.
REPLACE with:
findMany({ where: { clinicId: currentClinicId, doctorId: currentDoctorId }, include: { user: true, service: true } })
ENSURE:
clinicId always present
doctorId always present
NO empty filters allowed.
STEP 3 — RECEPTION DELAY FIX (CRITICAL)
ROOT CAUSE to fix:
double fetch OR delayed user join
FIND:
multiple useEffect calls
sequential fetching (appointments → users)
FIX:
Single query:
findMany({ where: { clinicId }, include: { user: true, service: true, doctor: true } })
REMOVE:
second fetch
polling overwrite issues
STEP 4 — DOUBLE FETCH / RACE CONDITION
Audit frontend:
find duplicate useEffect
find multiple API calls
FIX:
only ONE fetch per screen
guard with:
if (loaded) return
remove state overwrite loops
STEP 5 — IDENTITY UNIFICATION
Enforce everywhere:
getOrCreateUser({ telegramId?, phone? })
RULE:
ALWAYS try telegramId first
fallback phone
NEVER create user blindly
ENSURE:
same user → same tibId
no duplicates
STEP 6 — CLINIC CONTEXT FIX
Implement:
getClinicContext()
Priority:
query (?clinicId)
fallback DEFAULT_CLINIC_ID
ENSURE:
ALL queries include clinicId
no undefined clinicId
STEP 7 — DATE / TIMEZONE FIX
REMOVE:
where: { date: today }
REPLACE:
const start = startOfDay(TASHKENT) const end = endOfDay(TASHKENT)
where: { date: { gte: start, lte: end } }
Timezone = Asia/Tashkent
STEP 8 — INPUT FREEZE FIX
Find controlled inputs:
Issue: state overwritten on render
FIX:
isolate form state
remove useEffect resetting state
no async overwrite
STEP 9 — BOT ↔️ WEB SYNC
ENSURE:
bot uses same getOrCreateUser
web uses same resolver
RESULT: same tibId everywhere
STEP 10 — PERFORMANCE
remove redundant API calls
avoid re-render loops
cache user context
no polling overwrite
STEP 11 — VALIDATION (MANDATORY)
You MUST verify:
✔️ doctor panel shows correct patients ✔️ reception loads instantly (no delay) ✔️ admin shows all appointments ✔️ no duplicate users ✔️ tibId consistent ✔️ clinicId always present ✔️ no input freeze ✔️ timezone correct
STEP 12 — OUTPUT
Return ONLY:
Root causes (exact, bullet list)
Changed files
Minimal code patches
NO explanations NO theory NO skipping
PRIORITY
Doctor panel fix
Reception delay fix
Identity consistency
Stability
Performance