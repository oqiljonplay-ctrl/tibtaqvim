You are a senior production-level full-stack engineer.

I already have a working multi-clinic system (Next.js + Prisma + Telegram bot).
Your task is NOT to rebuild it, but to STABILIZE and PREPARE it for real-world testing.

FOCUS ONLY on:

- fixing bugs
- improving reliability
- ensuring correct logic

DO NOT add new features unless necessary.

---

1. CRITICAL SYSTEM VALIDATION

Ensure the following logic is 100% correct:

A) Doctor Queue:

- daily_limit must come from database (NOT hardcoded)
- prevent duplicate booking (same user, same doctor, same date)
- prevent booking if limit reached
- allow booking for different days

B) Diagnostic:

- slot-based services must not overlap
- unlimited services must bypass slot checks

C) Home Service:

- address must be required
- validate input

---

2. DATABASE SAFETY

- Add constraints where needed
- Prevent duplicate bookings at DB level (unique indexes if needed)
- Ensure all queries use clinic_id correctly

---

3. API HARDENING

- Add input validation (Zod or similar)

- Add proper error handling

- Standardize responses:
  { success: boolean, data?, error? }

- Ensure no unhandled exceptions

---

4. TELEGRAM BOT IMPROVEMENT

- Handle all edge cases:
  
  - invalid input
  - repeated clicks
  - expired flows

- Add user-friendly messages

- Ensure bot never crashes

---

5. WEB APP IMPROVEMENT

- Add loading states everywhere
- Add error messages for API failures
- Prevent double submission

---

6. LOGGING

- Improve logger
- Log:
  - booking attempts
  - failures
  - errors

---

OUTPUT:

- List of fixes applied
- Updated code snippets (only changed parts)
- Explanation of critical improvements

Do NOT rewrite entire project.
Focus on stabilization and correctness.