ROLE

You are a senior full-stack engineer.
You MUST refactor WebApp into a USER DASHBOARD (cabinet) without breaking existing system.
You MUST preserve all current booking APIs and logic.

---

GOAL

Transform /webapp into:

1) Returning user → Dashboard (NOT booking flow)
2) New user → Booking flow (current flow stays)

Ensure:

- Single user identity (tibId)
- No duplicate users
- Full integration with DB + API + bot

---

HARD RULES (CRITICAL)

- DO NOT rewrite booking.service.ts logic
- DO NOT change DB schema unless strictly needed
- DO NOT create new user if exists
- ALWAYS resolve user via shared logic
- ALL requests must include clinicId
- MUST keep backward compatibility

---

STEP 1 — USER RESOLUTION (GLOBAL)

Create/verify function:

getOrCreateUser({
phone?: string,
telegramId?: number
})

Logic:

1. normalize phone
2. find by telegramId
3. else find by phone
4. if found → return existing user
5. if not → create + assign tibId (tib000001 format)

REUSE existing tib-id.service.ts

---

STEP 2 — WEBAPP BOOTSTRAP

On WebApp load:

- read Telegram initData:
  window.Telegram.WebApp.initDataUnsafe

Extract:

- telegramId
- first_name (optional)

Call:
getOrCreateUser({ telegramId })

Store user in global state (React context or Zustand)

---

STEP 3 — ROUTING LOGIC (CRITICAL)

Modify /webapp entry:

IF:
user exists AND user.phone EXISTS
→ SHOW DASHBOARD

ELSE:
→ SHOW BOOKING FLOW (current UI)

---

STEP 4 — DASHBOARD UI (NEW)

📁 src/app/webapp/dashboard/page.tsx

UI MUST include:

HEADER:
🆔 tib000123 (ALWAYS visible)

SECTION 1 — TODAY APPOINTMENT

- service name
- date
- queue number
- status (booked / arrived / missed)

SECTION 2 — ALL APPOINTMENTS
List:

- service
- date
- status
- clinic

SECTION 3 — ACTIONS
Buttons:
[➕ New Booking]
[🔁 Rebook]
[❌ Cancel]

---

STEP 5 — API INTEGRATION

Use existing endpoints OR add:

GET /api/appointments?userId=...
→ return all appointments

GET /api/appointments/today
→ filter by current date (timezone aware)

POST /api/appointments/cancel
→ cancel booking

---

STEP 6 — CANCEL LOGIC

Allowed only if:
status = booked

Update:
status → cancelled

---

STEP 7 — REBOOK

Button:
"Rebook same service"

Flow:

- reuse last appointment.serviceId
- redirect to booking with prefilled service

---

STEP 8 — BOOKING FLOW (KEEP)

Current booking UI stays, but:

- skip phone input if user.phone exists
- prefill name if exists

---

STEP 9 — BOT ↔️ WEB SYNC

Ensure:

- bot creates user with tibId
- web finds SAME user

NO DUPLICATION

---

STEP 10 — CLINIC CONTEXT

Ensure:

- clinicId always passed
- fallback to DEFAULT_CLINIC_ID

---

STEP 11 — PERFORMANCE

- avoid double fetch
- cache user
- avoid re-render loops

---

STEP 12 — VALIDATION

After implementation:

- bot user opens web → sees dashboard (NOT form)
- tibId visible
- appointments visible
- cancel works
- rebook works
- no duplicate users

---

OUTPUT FORMAT

Return ONLY:

1. Changed files
2. New files
3. Code snippets (minimal)

NO explanations.

---

PRIORITY

1. Identity consistency
2. Non-breaking changes
3. UX clarity
4. Performance