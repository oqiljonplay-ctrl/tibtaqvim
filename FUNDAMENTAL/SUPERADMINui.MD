ROLE
You are a senior full-stack architect. You will EXTEND an existing Next.js + Prisma + Telegram bot system. DO NOT rewrite the project. DO NOT break existing booking logic.
Your task: build a SuperAdmin Panel with multi-clinic constructor system (modular, toggleable, scalable).
PRIMARY GOAL
Create a system where:
One platform manages MANY clinics
Each clinic is configurable like LEGO (modular features)
SuperAdmin can control EVERYTHING centrally
Clinics can have different configs, services, limits, UI behavior
HARD RULES (CRITICAL)
DO NOT modify existing working flows (booking, tibId, reminders)
DO NOT rename core models unless extending
ONLY extend schema safely
ALL features must be toggleable (feature flags)
ALL actions must be scoped by clinicId
SYSTEM ARCHITECTURE
You will introduce:
SuperAdmin role
Clinic-level configuration system
Feature flag engine
Modular service builder
UI constructor logic
Audit + safety layer
DATABASE EXTENSION (PRISMA)
Extend schema:
Model: ClinicSettings
id
clinicId (unique)
daily_limit (int)
timezone
booking_window_days (int)
allow_same_day (bool)
enable_queue (bool)
enable_slots (bool)
enable_home_service (bool)
enable_webapp (bool)
enable_bot (bool)
Model: FeatureFlag
id
clinicId
key (string)
enabled (bool)
Model: ModuleConfig
id
clinicId
module (doctor_queue | diagnostic | home_service)
enabled
config (JSON)
Model: AuditLog
id
actorId
clinicId
action
payload (JSON)
createdAt
SUPERADMIN UI (NEXT.JS)
📁 /admin/super
DASHBOARD
Total clinics
Active bookings
System health
Feature usage
CLINIC MANAGEMENT
List:
name
status (active / disabled)
branches count
doctors count
Actions:
create clinic
disable / enable
delete (soft delete only)
CLINIC BUILDER (CORE FEATURE)
This is the MOST IMPORTANT PART.
For each clinic:
1. MODULE TOGGLE PANEL
Switches:
Doctor Queue ✅/❌
Diagnostic Slots ✅/❌
Home Service ✅/❌
WebApp ✅/❌
Telegram Bot ✅/❌
2. SERVICE CONSTRUCTOR
Drag-like configuration (logic level):
Each service has:
name
type
duration
price (optional)
requires_slot (bool)
requires_address (bool)
3. DOCTOR CONFIG
daily_limit (dynamic, not hardcoded 40)
working_days
working_hours
break_time
4. CALENDAR RULES
max booking days ahead
disable past days
slot interval (e.g., 15 min)
5. FEATURE FLAGS
UI toggles:
enable reminders
enable tibId display
enable confirmation message
enable auto-close webapp
enable queue mode
6. LIVE PREVIEW (IMPORTANT)
Right side panel:
Simulate:
Bot UI
WebApp flow
STAFF MANAGEMENT
assign roles: 
superadmin
admin
doctor
reception
AUDIT LOG
who changed what
timestamp
rollback capability (basic)
BACKEND LOGIC
Create:
📁 services/config.service.ts
Functions:
getClinicConfig(clinicId)
isFeatureEnabled(clinicId, key)
getModuleConfig(clinicId, module)
INTEGRATION RULES
Modify existing logic:
booking.service.ts must read clinic config
bot handlers must respect enabled modules
webapp must hide disabled features
SAFETY
If module disabled → endpoint must reject request
No feature works without clinicId
All inputs validated
OUTPUT REQUIREMENT
Return:
New Prisma models
New API routes
New UI pages
Modified integration points
No explanations beyond necessary
PRIORITY
Stability
Modularity
Clean architecture
No regression bugs
FINAL GOAL
System must behave like:
"Clinic Operating System (Clinic OS)"
Where each clinic is fully configurable independently.