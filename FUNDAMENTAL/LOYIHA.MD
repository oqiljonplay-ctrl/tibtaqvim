You are a senior full-stack engineer.
Build a production-ready multi-tenant clinic management system with the following requirements.
TECH STACK:
Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
Backend: Next.js API routes (or Express if better structured)
Database: PostgreSQL (with Prisma ORM)
Telegram Bot: node-telegram-bot-api
Architecture: scalable, clean, modular
CORE REQUIREMENTS:
MULTI-CLINIC SYSTEM:
Multiple clinics
Each clinic has its own: 
branches
services
doctors
staff
All data must be scoped by clinic_id
SERVICE TYPES (DYNAMIC): Each service must have configurable type:
doctor_queue
diagnostic
home_service
Each service must include:
name
type
price
requires_slot (boolean)
requires_address (boolean)
daily_limit (nullable, configurable by admin)
IMPORTANT:
No hardcoded values
Everything must be configurable via database
DOCTOR QUEUE LOGIC:
Daily booking without time slots
Configurable daily_limit (not fixed 40)
Prevent booking if limit reached
Status: 
booked
arrived
missed
DIAGNOSTIC SERVICES:
Optional slot-based booking
Or unlimited booking (configurable)
HOME SERVICE:
Requires address
Assignable to staff
DATABASE (PRISMA): Design full schema with:
clinics
branches
services
doctors
staff
users
appointments
slots (optional)
roles (admin, doctor, receptionist)
ADMIN PANEL (Next.js):
Manage clinics
Manage services (including limits)
Manage doctors
View statistics
Change daily limits dynamically
DOCTOR PANEL:
View today's patient list
Mark: 
arrived
missed
RECEPTION PANEL:
Mark patient arrival
Manage queue
TELEGRAM BOT:
Dynamic menu (fetch from API)
Service selection
Doctor queue booking
No hardcoded services
API integration
TELEGRAM WEB APP:
Service selection
Slot picker (if needed)
Form: 
name
phone
address (if required)
API ENDPOINTS:
GET /services
POST /book
GET /appointments
POST /arrived
Admin CRUD endpoints
CODE QUALITY:
Clean architecture
Separation of concerns
Reusable components
Environment variables (.env)
OUTPUT REQUIRED:
Full project folder structure
Prisma schema
Backend API code
Telegram bot code
Next.js frontend (basic UI)
Instructions to run the project locally
Make the system scalable and production-ready.