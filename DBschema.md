ROLE
You are a senior production engineer. You MUST stabilize an existing Next.js + Prisma + Telegram system. NO new features. ONLY fix architecture inconsistencies.
OBJECTIVE
Fix ALL of the following in ONE pass:
Identity inconsistency (telegramId / phone / userId)
clinicId context gaps
Date/timezone mismatch
Double fetch / race conditions
Wrong query filters (admin shows only 1)
Bot ↔️ Web desync
System must become: → single identity → consistent data → deterministic UI → production-stable
HARD RULES (CRITICAL)
DO NOT rewrite project
DO NOT break booking.service.ts
DO NOT change DB schema unless minimal + safe
DO NOT introduce duplicate users
ALL fixes must be backward compatible
STEP 1 — SINGLE IDENTITY (MANDATORY)
Create/verify ONE resolver used EVERYWHERE:
getOrCreateUser({ telegramId?, phone? })
LOGIC:
normalize phone → +998XXXXXXXXX
if telegramId → findUnique({ telegramId })
else if phone → findUnique({ phone })
if found → RETURN
else → create user + assign tibId (tib000001)
ENFORCE:
used in bot handlers
used in all /api routes
used in web bootstrap
NO other user creation allowed.
STEP 2 — TELEGRAM TRUST SOURCE
WebApp MUST use:
window.Telegram.WebApp.initDataUnsafe.user.id
DO NOT use:
URL tgid
query params for identity
Fallback ONLY if Telegram absent: → phone lookup
STEP 3 — CLINIC CONTEXT (GLOBAL)
Implement:
getClinicContext()
Priority:
explicit query (?clinicId=)
user’s last clinic (optional)
DEFAULT_CLINIC_ID
ENFORCE:
ALL API queries include clinicId
UI must NEVER crash if clinicId missing → fallback automatically
STEP 4 — DATE FIX (CRITICAL)
Current issue: @db.Date + timezone mismatch
Fix ALL queries:
INSTEAD OF: where: { date: today }
USE RANGE:
const start = startOfDay(TASHKENT) const end = endOfDay(TASHKENT)
where: { date: { gte: start, lte: end } }
Timezone: Asia/Tashkent (env: CLINIC_TIMEZONE)
NO direct equality checks.
STEP 5 — QUERY FIXES
Audit ALL findMany():
REMOVE:
limit: 1
incorrect where clauses
ENSURE:
admin → ALL clinic appointments
doctor → ONLY own (doctorId + clinicId)
reception → clinic-wide
STEP 6 — DOUBLE FETCH / RACE
Find ALL:
useEffect duplicates
multiple fetch calls
FIX:
single fetch per screen
no state overwrite
guard with loading flag
Example:
if (loaded) return
STEP 7 — INPUT FREEZE FIX
Root cause: controlled input reset
CHECK:
value tied to state?
useEffect overwriting?
FIX:
isolate form state
NEVER reset on render
no async overwrite
STEP 8 — BOT ↔️ WEB SYNC
Ensure:
bot uses getOrCreateUser()
web uses SAME resolver
RESULT:
same user → same tibId
NO duplicates.
STEP 9 — tibId STANDARD
Ensure:
format: tib000001
unique index enforced
visible in: 
bot confirmation
web header
admin/reception
STEP 10 — PERFORMANCE
remove redundant calls
debounce where needed
avoid re-render loops
cache user context
STEP 11 — VALIDATION (MANDATORY)
You MUST verify:
✔️ same phone → same tibId ✔️ bot booking → visible in web ✔️ admin sees all records ✔️ doctor panel works ✔️ reception loads instantly ✔️ no input freeze ✔️ no duplicate users ✔️ timezone correct
STEP 12 — OUTPUT
Return ONLY:
Root causes (bullet list)
Changed files
Exact code patches
NO theory NO explanations NO skipping steps
PRIORITY
Data consistency
Identity correctness
Stability
Performance