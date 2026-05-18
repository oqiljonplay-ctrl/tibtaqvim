You are a senior backend engineer.
I already have a fully working production-ready system:
Next.js (App Router)
Prisma (PostgreSQL)
Telegram bot
Booking system (doctor_queue, diagnostic, home_service)
Your task is to ADD ONLY TWO FEATURES safely:
Global User ID (tib format)
Telegram booking confirmation message
STRICT RULES:
DO NOT rewrite existing architecture
DO NOT break existing logic
DO NOT remove any code
ONLY extend current system
Keep changes minimal and safe
Follow steps EXACTLY
FEATURE 1 — GLOBAL USER ID (tib000001)
GOAL: Each user must have a permanent unique ID: tib000001, tib000002, ...
RULES:
ID belongs to USER, not booking
Generated once and never changes
Must be UNIQUE
STEP 1 — DATABASE UPDATE
Update Prisma User model:
Add field: tib_id String? @unique
STEP 2 — GENERATION LOGIC
When a user is created:
If tib_id is null: Generate:
tib_id = "tib" + String(user.id).padStart(6, "0")
Save it immediately
IMPORTANT:
Must be safe for concurrent requests
No race condition
STEP 3 — BACKFILL EXISTING USERS
If users already exist:
Write script to fill tib_id for all users without it
FEATURE 2 — TELEGRAM CONFIRMATION MESSAGE
GOAL: Send clear confirmation after booking
STEP 4 — MESSAGE FORMAT
Use EXACT format:
✅ Qabul tasdiqlandi
👤 Ism: {name} 📅 Sana: {date} 📋 Navbat: ro‘yxatga qo‘shildingiz 👨‍⚕️ Shifokor: {doctor_name} 🆔 ID: {tib_id}
📍 Klinikaga kelganda ushbu kodni ko‘rsating
STEP 5 — INTEGRATION POINT
After successful booking:
Fetch user (with tib_id)
Fetch doctor/service name
Send Telegram message
STEP 6 — SAFETY
Ensure:
No duplicate messages
If Telegram fails → do not break booking
Wrap in try/catch
STEP 7 — BOT UPDATE
Ensure bot:
Uses tib_id in responses
Never crashes if tib_id missing (fallback safe)
OUTPUT FORMAT:
Show Prisma schema change
Show user creation update logic
Show backfill script
Show booking integration snippet
Show Telegram send function
DO NOT rewrite full files. ONLY show minimal necessary changes.
Stay precise and minimal.