ROLE

You are a senior debugging engineer and system architect.
You MUST NOT add new features blindly.
You MUST audit, detect root cause, and fix system inconsistencies.

---

PROBLEM (STRICT CONTEXT)

System already has:

- Telegram bot booking (working)
- WebApp booking (working)
- tibId system exists
- DB is connected

BUT:

❗️ Bot and WebApp behave as TWO SEPARATE SYSTEMS
❗️ WebApp asks user data again (phone, name)
❗️ tibId from bot is NOT visible in WebApp
❗️ duplicate users are likely being created

---

YOUR TASK (CRITICAL)

You MUST:

1. Perform FULL SYSTEM AUDIT
2. Detect EXACT ROOT CAUSE (NOT assumptions)
3. Fix WITHOUT breaking existing flows
4. Ensure SINGLE USER IDENTITY across system

---

STEP 1 — TRACE USER FLOW (MANDATORY)

Trace:

BOT FLOW:

- where user is created
- where tibId is assigned
- how phone is stored

WEB FLOW:

- where user is created
- why it does NOT reuse existing user

OUTPUT:

- exact file + function causing duplication

---

STEP 2 — DETECT ROOT CAUSE

You MUST identify ONE of:

- user is always created (no lookup)
- phone mismatch (normalization issue)
- telegramId not used
- API not called correctly
- cache inconsistency

DO NOT GUESS — VERIFY IN CODE

---

STEP 3 — FIX STRATEGY (STRICT)

Implement unified resolver:

getOrCreateUser({
phone,
telegramId
})

LOGIC:

1. normalize phone
2. find by telegramId
3. if not → find by phone
4. if found → RETURN EXISTING USER
5. if not → create new user + assign tibId

---

STEP 4 — ENFORCE IN BOTH FLOWS

Replace ALL user creation points:

- bot handlers
- web API routes
- auth routes

RULE:

❗️ NEVER create user without checking existing

---

STEP 5 — WEBAPP FIX (CRITICAL)

On WebApp load:

- read Telegram WebApp initData
- extract telegramId
- call getOrCreateUser()

IF user exists:
→ DO NOT show registration form
→ auto-fill data

---

STEP 6 — UI FIX

Ensure tibId is visible:

- confirmation screen
- header (optional)

Format:

🆔 tib000000

---

STEP 7 — ADMIN PANEL FIX

Ensure:

- tibId included in queries
- visible in:
  - reception
  - doctor view

---

STEP 8 — SAFETY

- DO NOT change DB schema unnecessarily
- DO NOT break booking logic
- DO NOT remove working code
- ONLY refactor user resolution

---

STEP 9 — VALIDATION

After fix, ensure:

- same phone → same tibId
- bot booking → web sees same user
- no duplicate users created

---

OUTPUT FORMAT

Return ONLY:

1. Root cause (1-2 lines)
2. Changed files
3. Exact code changes

NO explanations
NO theory

---

PRIORITY

1. Correctness
2. Stability
3. No regression
4. Data consistency