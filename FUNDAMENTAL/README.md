# ClinicBot — Ko'p Klinikali Boshqaruv Tizimi

## Texnologiyalar
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + Prisma ORM
- Telegram Bot (node-telegram-bot-api)

## Loyiha Strukturasi

```
nextBOT/
├── prisma/
│   ├── schema.prisma          # To'liq DB sxema
│   └── seed.ts                # Test ma'lumotlari
├── src/
│   ├── app/
│   │   ├── api/               # REST API
│   │   │   ├── auth/login/    # POST /api/auth/login
│   │   │   ├── services/      # GET /api/services
│   │   │   ├── book/          # POST /api/book
│   │   │   ├── appointments/  # GET /api/appointments
│   │   │   ├── arrived/       # POST /api/arrived
│   │   │   ├── slots/         # GET /api/slots
│   │   │   ├── admin/         # Admin CRUD
│   │   │   └── webhook/       # Telegram webhook
│   │   ├── admin/             # Admin panel
│   │   ├── doctor/            # Shifokor panel
│   │   ├── reception/         # Qabulxona panel
│   │   └── webapp/            # Telegram WebApp
│   ├── lib/                   # prisma, auth, api-response
│   ├── components/ui/         # Reusable components
│   └── types/                 # TypeScript types
└── bot/                       # Telegram bot
    ├── index.ts
    ├── api.ts
    └── handlers/
```

## Ishga Tushirish

### 1. O'rnatish

```bash
npm install
```

### 2. .env sozlash

```bash
cp .env.example .env
# .env faylini tahrirlang:
# DATABASE_URL — PostgreSQL ulanish satri
# TELEGRAM_BOT_TOKEN — BotFather'dan oling
# DEFAULT_CLINIC_ID — seed'dan olinadigan klinika ID
```

### 3. PostgreSQL ma'lumotlar bazasi

```bash
# PostgreSQL o'rnatilgan bo'lishi kerak
# Ma'lumotlar bazasini yarating:
createdb clinic_db

# Migratsiya ishlatish:
npm run db:migrate

# Test ma'lumotlar:
npm run db:seed
```

### 4. Prisma generate

```bash
npm run db:generate
```

### 5. Next.js serverni ishga tushirish

```bash
npm run dev
# http://localhost:3000 da ochiladi
```

### 6. Telegram botni ishga tushirish

```bash
npm run bot
```

## Panellar

| Panel | URL |
|-------|-----|
| Asosiy sahifa | http://localhost:3000 |
| Admin panel | http://localhost:3000/admin |
| Shifokor panel | http://localhost:3000/doctor |
| Qabulxona | http://localhost:3000/reception |
| Telegram WebApp | http://localhost:3000/webapp?clinicId=clinic-demo |

## API Endpoints

| Method | URL | Tavsif |
|--------|-----|--------|
| GET | /api/services | Xizmatlar ro'yxati |
| POST | /api/book | Qabulga yozilish |
| GET | /api/appointments | Qabullar ro'yxati |
| POST | /api/arrived | Holat yangilash |
| GET | /api/slots | Bo'sh uyachalar |
| POST | /api/auth/login | Tizimga kirish |
| GET | /api/admin/stats | Statistika |
| GET/POST | /api/admin/services | Xizmatlar CRUD |
| GET/POST | /api/admin/doctors | Shifokorlar CRUD |
| GET/POST | /api/admin/clinics | Klinikalar CRUD |

## Admin Login (seed dan)

- Telefon: `+998 90 000 00 00`
- Parol: `admin123`

## Muhim Eslatmalar

- Barcha ma'lumotlar `clinic_id` bilan izolyatsiya qilingan
- `dailyLimit: null` = cheksiz; raqam = kunlik limit
- Panellarda `localStorage.setItem("auth_token", token)` orqali token saqlash kerak
- Ishlab chiqarish (production)da Redis dan session uchun foydalaning
