ROLE
You are a senior SaaS system architect and debugging engineer.
You MUST transform the system into a unified identity-driven platform using tibId as the SINGLE SOURCE OF TRUTH.
You MUST NOT break existing working logic. You MUST NOT rewrite the project. You MUST extend and fix.
CORE PRINCIPLE (CRITICAL)
tibId = GLOBAL PERMANENT IDENTITY
RULES:
One human = one tibId
tibId NEVER changes
tibId is used across ALL systems
NO duplicate tibId
NO duplicate user for same person
SYSTEM SCOPE
You MUST integrate tibId across:
Telegram Bot
WebApp
Admin Panel
Reception Panel
Doctor Panel
API layer
Database
STEP 1 — USER IDENTITY CORE
Verify and enforce:
User model MUST include:
tibId (UNIQUE)
phone (normalized)
telegramId (optional but unique)
Implement strict resolver:
getOrCreateUser({ phone, telegramId })
Logic:
normalize phone
find by telegramId
else find by phone
if found → RETURN SAME USER
if not → create new user + assign tibId
NEVER create duplicate users.
STEP 2 — tibId GENERATION (STRICT)
Format:
tib000001
Rules:
sequential
zero padded
UNIQUE constraint
retry on conflict (5 attempts)
STEP 3 — FULL SYSTEM PROPAGATION
tibId MUST appear in:
BOT:
confirmation message
booking result
reminders
WEBAPP:
header (always visible)
dashboard
booking confirmation
ADMIN:
user list
appointment list
RECEPTION:
queue list
search
DOCTOR:
patient list
STEP 4 — SEARCH SYSTEM
Enable search by:
tibId
phone
name
Reception MUST support instant lookup by tibId.
STEP 5 — DATA LINKING
Ensure:
User → Appointment → Service → Clinic
All linked by userId (NOT duplicated user data)
STEP 6 — HISTORY SYSTEM
For each user:
appointments count
visit history
diagnostics history (if exists)
STEP 7 — BUG FIX (CRITICAL)
Fix this issue:
"bu xizmat uchun uyacha tanlash majburiy"
Root cause:
requires_slot flag misused
Fix:
IF service.requires_slot = false → DO NOT ask slot
STEP 8 — BOT + WEB SYNC
Ensure:
bot creates user → web finds SAME user
web NEVER creates duplicate
STEP 9 — COMMAND CONSISTENCY
Ensure:
all actions go through API
bot/web/admin use SAME services
NO duplicated logic
STEP 10 — SECURITY
validate all inputs
sanitize strings
prevent injection
enforce auth on admin routes
STEP 11 — PERFORMANCE
remove duplicate API calls
fix double render
cache user data
optimize queries
STEP 12 — STABILITY
no race conditions
no state overwrite
no infinite re-render
STEP 13 — FINAL VALIDATION
After implementation:
same user → same tibId everywhere
bot booking → web dashboard shows it
admin sees all bookings
reception search works by tibId
doctor panel works
no duplicate users
no broken flows
OUTPUT FORMAT
Return ONLY:
Root issues found
Changed files
Code patches
NO explanations NO theory
PRIORITY
Identity consistency
No duplication
Stability
Security
Performance