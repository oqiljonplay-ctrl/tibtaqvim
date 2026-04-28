You are a senior production-level backend engineer.
I already have a fully working system:
Next.js (App Router)
Prisma + PostgreSQL
Telegram bot
Global user tibId system (tib000001)
Booking + confirmation fully working
Your task is to APPLY 3 SMALL FIXES (POLISH) safely.
STRICT RULES:
DO NOT rewrite existing logic
DO NOT change architecture
DO NOT break working code
ONLY extend and integrate
Follow steps EXACTLY
Keep code minimal and safe
FIX 1 — PHONE NORMALIZATION (CRITICAL)
GOAL: Ensure all phone numbers are stored and compared in ONE format.
TARGET FORMAT: +998901234567
STEP 1: Create utility:
normalizePhone(phone: string): string
RULES:
Remove spaces, dashes, brackets
If starts with "998" → convert to "+998"
If starts with "9" (local) → convert to "+9989..."
Ensure final format always: +998XXXXXXXXX
STEP 2: Apply normalization in ALL places:
user creation
booking
lookup (getTibIdByPhone)
API endpoints
bot input handling
IMPORTANT:
Always normalize BEFORE saving and querying
STEP 3: Ensure:
No duplicate users due to phone variations
Update existing logic safely
FIX 2 — tibId CACHE (PERFORMANCE)
GOAL: Reduce repeated DB queries for tibId
STEP 4: Add simple in-memory cache:
Map<string, string>
Key:
phone OR telegramId
Value:
tibId
STEP 5: Cache rules:
TTL: 2 minutes
On cache hit → return tibId
On miss → fetch from DB, then store
STEP 6: Apply cache ONLY in:
getTibIdByPhone
getTibIdByTelegramId
FIX 3 — RECEPTION SEARCH OPTIMIZATION
GOAL: Fast lookup by tibId
STEP 7: Ensure Prisma query:
findUnique({ where: { tib_id } })
STEP 8: Verify:
tib_id is UNIQUE (already)
Query uses index (automatic)
STEP 9: Optional improvement:
Add search endpoint:
GET /api/user/by-tibid?tibId=...
Return:
user
appointments (optional)
OUTPUT FORMAT:
Show normalizePhone function
Show where it is integrated
Show cache implementation
Show updated tibId fetch functions
Show optimized search snippet
DO NOT rewrite files. ONLY show minimal required changes.
Stay precise and do not overcomplicate.