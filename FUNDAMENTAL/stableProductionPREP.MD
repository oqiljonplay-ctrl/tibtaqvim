You are a senior production-level full-stack engineer.
I already have a working multi-clinic system:
Next.js (App Router)
Prisma + PostgreSQL
Telegram bot (node-telegram-bot-api)
Your task is NOT to rebuild anything.
Your task is to STRICTLY FOLLOW THIS PLAN and prepare the system for production-level stability.
IMPORTANT RULES:
Do NOT add new features
Do NOT change architecture
Do NOT rewrite everything
ONLY improve, fix, and stabilize
Follow steps EXACTLY in order
Work step-by-step, do not skip
STEP 1 — ENV & CONFIG VALIDATION
Create or improve .env.example with:
DATABASE_URL
BOT_TOKEN
JWT_SECRET
CRON_SECRET
BASE_URL
Validate all env variables at app startup
Throw clear errors if missing
STEP 2 — DATABASE HARDENING
Verify Prisma schema:
All models correctly related
clinic_id used everywhere needed
Add constraints:
Prevent duplicate booking: (user_id, service_id, date) UNIQUE
Ensure:
Doctor queue uses dynamic daily_limit from DB
No hardcoded limits
Prepare migration:
Safe for production
STEP 3 — BACKEND STABILIZATION
Standardize API responses: { success: true, data } { success: false, error }
Add input validation (Zod or equivalent)
Ensure:
No unhandled errors
Try/catch everywhere needed
Add timeout handling (5s)
Add rate limiting:
/api/book → 10 req/min/IP
STEP 4 — CORE LOGIC VALIDATION
Fix and guarantee correctness:
A) Doctor Queue:
Prevent duplicate booking
Enforce daily_limit from DB
Allow different days booking
B) Diagnostic:
Slot-based → prevent overlap
Unlimited → bypass slot logic
C) Home Service:
Address required
Validate properly
STEP 5 — TELEGRAM BOT STABILIZATION
Ensure:
Fully dynamic (no hardcoded services)
API-driven
Handle:
Invalid input
Repeated clicks
Expired flows
Improve UX:
Clear messages
No crashes
STEP 6 — WEB APP HARDENING
Add:
Loading states
Error states
Prevent:
Double submission
Ensure:
Conditional UI works correctly (slot / address)
STEP 7 — PANELS VALIDATION
Doctor Panel:
Today list
arrived / missed
Reception Panel:
Filter
Arrival marking
Ensure:
Correct status transitions
No invalid state changes
STEP 8 — REMINDER SYSTEM HARDENING
Prevent duplicate notifications:
notifiedDayBefore
notifiedTwoHours
Add:
Timeout (5s)
Safe execution
Ensure endpoints:
/api/reminders?type=day_before
/api/reminders?type=two_hours
STEP 9 — SECURITY
Ensure:
JWT auth works
Role-based access works
Protect:
Admin routes
Sensitive endpoints
STEP 10 — LOGGING
Improve logger:
Log:
booking attempts
errors
reminder execution
STEP 11 — HEALTH SYSTEM
Ensure:
/api/health returns: 
database status
uptime
STEP 12 — DEPLOY PREPARATION (CODE SIDE ONLY)
Ensure:
build works
no env leaks
Prisma:
generate works
BASE_URL correctly used
STEP 13 — FINAL INTERNAL TEST CHECKLIST
Verify system logic:
doctor queue limit works
duplicate booking blocked
slot overlap prevented
home service validates address
bot flow works
web app works
OUTPUT FORMAT:
List ALL fixes applied
Show ONLY changed code snippets
Explain WHY each fix was needed
DO NOT rewrite entire project. DO NOT add new features. ONLY stabilize and prepare for production.
Stay focused and follow the plan strictly.