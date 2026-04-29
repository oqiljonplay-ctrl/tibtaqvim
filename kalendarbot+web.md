# ROLE
You are a senior full-stack engineer. You will IMPLEMENT (not redesign) a unified calendar system
for BOTH Telegram Bot (inline keyboard) and WebApp (Next.js).
You MUST respect existing architecture and NEVER rewrite unrelated files.

---

# GOAL

Replace all date selection logic with a unified calendar system:

1) Bot → Inline calendar (Telegram constraints)
2) WebApp → Modern UI calendar (rounded, smooth, premium)

Both MUST:
- Use same logic (shared date utils)
- Same constraints (past days disabled, capacity aware)
- Same navigation (< month, > month)
- Same format (YYYY-MM-DD)

---

# HARD RULES (CRITICAL)

- DO NOT rewrite whole project
- DO NOT change existing DB schema
- DO NOT break booking flow
- ONLY extend / refactor date selection parts

- Reuse:
  - booking.service.ts
  - slot logic
  - validators
  - timezone (Asia/Tashkent)

---

# STEP 1 — SHARED CALENDAR CORE (IMPORTANT)

Create shared util:

📁 src/lib/calendar.ts

Implement:

- generateCalendarMatrix(year, month)
  → returns weeks[][] (7 columns)

- isPastDate(date)
- isToday(date)
- formatDateISO(date) → YYYY-MM-DD

- applyConstraints(day):
    {
      disabled: past || full
      isToday
    }

- respect CLINIC_TIMEZONE

---

# STEP 2 — BOT INLINE CALENDAR

📁 bot/handlers/calendar.ts (NEW)

Implement:

## UI STRUCTURE

Header row:
<   April 2026   >

Week row:
Mo Tu We Th Fr Sa Su

Days grid:
[1] [2] [3] ...

## CALLBACK FORMAT

CAL:MONTH:2026-04
CAL:DAY:2026-04-28

---

## BEHAVIOR

- < → previous month
- > → next month
- DO NOT send new message
- USE editMessageReplyMarkup

---

## BUTTON RULES

- disabled days → "·"
- today → wrap with []
- full days → "×"

NO emoji overload.

---

# STEP 3 — WEBAPP CALENDAR (UI LEVEL)

📁 src/components/Calendar.tsx

Use:
- Tailwind
- grid grid-cols-7
- rounded-xl
- soft shadow
- hover effects

---

## DESIGN

- Rounded buttons
- Subtle gradient hover
- Today highlighted
- Disabled → opacity-40
- Selected → primary color

---

## HEADER

<  April 2026  >

Buttons trigger state change

---

## INTERACTION

- click day → select
- selected stored in state
- emits YYYY-MM-DD

---

# STEP 4 — INTEGRATION

REPLACE:

- bot static date buttons → new calendar
- webapp date step → Calendar component

DO NOT touch:
- booking.service.ts logic
- API contracts

---

# STEP 5 — CONSTRAINTS

- Past days disabled
- Capacity aware (if slots full)
- Today selectable
- Max forward range = 30 days

---

# STEP 6 — PERFORMANCE

- No unnecessary re-renders
- No extra DB calls on month switch
- Preload slots per month if needed

---

# STEP 7 — FINAL CHECK

- Bot:
  ✔️ month switching works
  ✔️ day selection triggers next step

- WebApp:
  ✔️ smooth UX
  ✔️ mobile friendly
  ✔️ no layout break

---

# OUTPUT FORMAT

Return ONLY:

1. New files
2. Modified files
3. Short explanation

DO NOT output theory.
DO NOT rewrite entire project.

---

# PRIORITY

1. Stability
2. Consistency
3. UX
4. Performance