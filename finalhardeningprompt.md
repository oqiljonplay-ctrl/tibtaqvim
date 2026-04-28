You are a senior production-level backend engineer.
I already have a fully built system:
Next.js (App Router)
Prisma + PostgreSQL
Telegram bot
The system is feature-complete.
Your ONLY task is to perform FINAL HARDENING and make it production-safe.
STRICT RULES:
DO NOT add new features
DO NOT redesign architecture
DO NOT rewrite large parts
ONLY improve reliability, safety, and correctness
Work EXACTLY in the order below
Stay focused, no deviations
STEP 1 — IDEMPOTENCY (CRITICAL)
Goal: Prevent duplicate requests.
Tasks:
Add idempotency handling for POST /book
Use either: 
Idempotency-Key header OR
Safe DB constraint + transaction logic
Ensure:
Same request cannot create duplicate bookings
STEP 2 — CONCURRENCY / RACE CONDITION
Goal: Prevent limit bypass.
Tasks:
Wrap booking logic in DB transaction
Ensure doctor_queue respects daily_limit atomically
Approach:
Lock relevant rows OR
Use atomic insert/check logic
Ensure:
Parallel requests cannot exceed limit
STEP 3 — DATABASE CONNECTION RESILIENCE
Tasks:
Add retry logic for Prisma connection (3–5 attempts)
Ensure API does not crash on temporary DB failure
STEP 4 — TIMEOUT + RETRY (EXTERNAL CALLS)
Tasks:
Keep existing timeout (5s)
Add retry (max 2 attempts) for: 
Telegram message sending
Ensure:
Failures are handled safely
STEP 5 — TIMEZONE NORMALIZATION
Tasks:
Store all timestamps in UTC
Convert using clinic timezone (e.g. Asia/Tashkent)
Ensure:
doctor_queue “today/tomorrow” is correct
reminders fire at correct local time
STEP 6 — REMINDER IDEMPOTENCY
Tasks:
Ensure notifications are sent only once
Use flags: 
notifiedDayBefore
notifiedTwoHours
Ensure:
Even if cron runs twice → no duplicates
STEP 7 — BOT STATE SAFETY
Tasks:
Prevent broken flows on restart
Add safe fallback handling
Optional minimal:
Store minimal state OR re-fetch from API
STEP 8 — RATE LIMIT EXPANSION
Tasks:
Extend rate limiting to: 
auth endpoints
/api/reminders
STEP 9 — INPUT SANITIZATION
Tasks:
Sanitize: 
name
phone
address
Apply:
trim
max length
remove unsafe characters
STEP 10 — STRUCTURED ERROR CODES
Tasks: Replace: { error: "message" }
With: { success: false, error: { code: "LIMIT_REACHED", message: "..." } }
Ensure:
Consistent error handling across system
STEP 11 — LOGGING IMPROVEMENT
Tasks:
Add requestId (correlationId)
Include in: 
booking logs
errors
reminders
Ensure:
Easy debugging
STEP 12 — MINIMAL CRITICAL TESTS
Add only essential tests:
doctor_queue limit
duplicate booking
slot overlap
reminder duplication
OUTPUT FORMAT:
List ALL improvements applied
Show ONLY changed code snippets
Explain WHY each change is critical
DO NOT:
Add new features
Rewrite architecture
Overcomplicate
Stay focused and complete all steps in order.