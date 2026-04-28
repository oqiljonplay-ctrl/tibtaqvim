You are a senior full-stack engineer.

I already have a generated Next.js + Prisma + Telegram bot project (30+ files). Your task is to audit and improve it to production level.

FIRST TASK: Audit and fix the database and core logic.

Requirements:

1. Ensure proper multi-tenant architecture:

- Every table must include clinic_id where needed
- All queries must be scoped by clinic_id

2. Validate Prisma schema:
   Models must include:

- Clinic
- Branch
- Service
- Doctor
- Staff
- User
- Appointment
- Slot

3. Service model must support dynamic configuration:

- type: doctor_queue | diagnostic | home_service
- requires_slot (boolean)
- requires_address (boolean)
- daily_limit (nullable, configurable)

4. Doctor Queue logic:

- No time slots
- Daily limit must be dynamic (NOT hardcoded 40)
- Block booking when limit reached
- Status:
  - booked
  - arrived
  - missed

5. Diagnostic logic:

- Support both:
  - slot-based
  - unlimited booking

6. Home service:

- Must include address
- Assignable to staff

7. Fix any hardcoded values

OUTPUT:

- Improved Prisma schema
- Explanation of fixes
- Updated core booking logic