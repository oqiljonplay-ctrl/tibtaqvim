ROLE
You are a senior production debugging engineer.
You MUST:
audit entire system
find root causes
fix WITHOUT breaking anything
ensure system consistency across bot, web, admin, reception, doctor panels
NO feature building. ONLY diagnosis + correction.
SYSTEM ISSUES (CONFIRMED)
Reception:
initially partial data
later full data appears → indicates async/state issue
Admin panel:
only 1 appointment visible → query/filter bug
Doctor panel:
not working → likely clinicId / permissions / query failure
clinicId:
required but not properly injected
tibId:
must be format: tib000000
not consistently used
Bot ↔️ Web:
not synced
duplicate user risk
Performance:
slow page updates
delayed rendering
YOUR TASK (STRICT ORDER)
STEP 1 — GLOBAL TRACE (MANDATORY)
Trace:
how clinicId is passed
how user is resolved
how appointments are fetched
Check:
API routes
services
frontend hooks
STEP 2 — RECEPTION BUG
Problem: partial → full data
Fix:
eliminate double fetch
ensure single source of data
remove race condition
Check:
useEffect duplication
SWR/react-query misuse
STEP 3 — ADMIN BUG
Problem: only 1 record
Fix:
inspect query:
findMany()
Check for:
limit: 1 ❌
wrong where clause ❌
missing clinicId ❌
STEP 4 — DOCTOR PANEL FIX
Check:
clinicId passed?
doctorId filter?
API returning data?
Fix:
ensure doctor sees ONLY own appointments
but query must NOT fail if clinicId missing
STEP 5 — CLINIC CONTEXT FIX (CRITICAL)
Implement global clinic resolver:
getClinicContext()
Sources:
query param
user session
default clinic
Ensure: ❗️ clinicId ALWAYS available ❗️ no UI should break without it
STEP 6 — tibId STANDARDIZATION
Ensure:
format: tib000001
stored in DB
visible in: 
bot
web
admin
reception
Fix:
enforce generator
remove inconsistent IDs
STEP 7 — BOT ↔️ WEB SYNC
Fix:
web must call:
getOrCreateUser()
using:
phone
telegramId
Ensure: ❗️ NO duplicate users
STEP 8 — PERFORMANCE FIX
Fix:
remove redundant API calls
debounce requests
avoid double render
cache properly
STEP 9 — VALIDATION
After fixes:
reception loads instantly
admin shows ALL bookings
doctor panel works
tibId visible everywhere
no duplicate users
fast rendering
STEP 10 — OUTPUT
Return ONLY:
Root causes (bullet points)
Changed files
Exact fixes (code snippets)
NO explanations NO theory
PRIORITY
Stability
Data correctness
No duplication
Performance