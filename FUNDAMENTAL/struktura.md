┌─────────────────────────┐
                 │     TELEGRAM BOT        │
                 │  (Fast Interaction UI)  │
                 └──────────┬──────────────┘
                            │
                            │ webhook
                            ▼
                 ┌─────────────────────────┐
                 │        API LAYER        │
                 │ (Next.js /api routes)   │
                 └──────────┬──────────────┘
                            │
        ┌───────────────────┼────────────────────┐
        │                   │                    │
        ▼                   ▼                    ▼
┌───────────────┐  ┌────────────────┐  ┌────────────────────┐
│   WEB APP     │  │  ADMIN PANEL   │  │  RECEPTION PANEL   │
│ (User UI)     │  │ (Clinic Admin) │  │ (Operational UI)   │
└──────┬────────┘  └──────┬─────────┘  └─────────┬──────────┘
       │                   │                      │
       └──────────┬────────┴──────────┬───────────┘
                  ▼                   ▼
             ┌────────────────────────────┐
             │       CORE SERVICES        │
             │ booking / user / tibId    │
             └────────────┬──────────────┘
                          ▼
                 ┌──────────────────────┐
                 │     DATABASE         │
                 │  (PostgreSQL)        │
                 └──────────────────────┘


tibId = GLOBAL PRIMARY IDENTITY barcha tizimlar shunga ulanadi:
bot
web
admin
reception
doctor

User
 ├── id
 ├── tibId (UNIQUE)  🔥
 ├── phone
 ├── telegramId
 └── name

Appointment
 ├── id
 ├── userId → User.id
 ├── clinicId
 ├── serviceId
 ├── date
 └── status

Clinic
 ├── id
 ├── name
 └── settings

Staff
 ├── id
 ├── clinicId
 ├── role (admin / doctor / reception)
 └── permissions

 User → Bot → phone
        ↓
assignTibId()
        ↓
User DB ga yoziladi
        ↓
Booking yaratiladi
        ↓
Telegram confirmation (tibId bilan)

Search:
- phone
- tibId 🔥

Natija:
- barcha appointmentlar
- user history

ROLE
You are a senior backend + frontend architect. You MUST integrate tibId as GLOBAL IDENTITY across bot, web, admin. DO NOT break existing logic.
GOAL
Ensure:
tibId is visible in ALL layers
bot ↔️ web share SAME user
no duplicate users
system works as unified SaaS
HARD RULES
DO NOT rewrite project
ONLY extend existing logic
ALL queries must use existing services
NEVER create duplicate user if exists
STEP 1 — USER RESOLUTION (CRITICAL)
Implement unified resolver:
getOrCreateUser({ phone, telegramId })
LOGIC:
find by telegramId
else find by phone
if found → return
else: 
create user
assign tibId
STEP 2 — WEBAPP INTEGRATION
On load:
read Telegram WebApp initData
extract telegramId
Call:
getOrCreateUser()
Store:
user + tibId in global state
STEP 3 — UI REQUIREMENT
Display tibId:
top header (ALWAYS visible)
profile page
confirmation screen
Format:
🆔 tib000123
STEP 4 — BOOKING INTEGRATION
Ensure:
every booking uses existing user
NEVER create new user blindly
STEP 5 — ADMIN PANEL
Modify:
reception table → show tibId
doctor panel → show tibId
search → allow tibId input
STEP 6 — BOT INTEGRATION
After booking:
Send:
✅ Qabul tasdiqlandi 🆔 ID: tib000123
STEP 7 — SAFETY
unique constraint tibId
phone normalized
no duplicate users
STEP 8 — OUTPUT
Return:
changed files
new functions
no explanations
PRIORITY
Data consistency
No duplication
Stability
UX clarity
