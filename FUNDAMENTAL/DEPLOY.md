# Production Deployment Guide

## Stack
- **Next.js** → Vercel
- **PostgreSQL** → Supabase yoki Neon
- **Telegram Bot** → VPS yoki Railway (polling)

---

## 1. Database (Supabase / Neon)

### Supabase
1. [supabase.com](https://supabase.com) → New project
2. Settings → Database → Connection string (URI mode) ni ko'chiring
3. `?pgbouncer=true&connection_limit=1` qo'shing (Vercel uchun)

### Neon
1. [neon.tech](https://neon.tech) → New project
2. Dashboard → Connection string ni ko'chiring
3. `?sslmode=require` qo'shing

### Schema sinxronizatsiya
```bash
# Birinchi marta yoki schema o'zgarganda:
DATABASE_URL="your-db-url" npx prisma db push

# Prisma client yangilash:
npx prisma generate
```

> **Muhim:** Agar mavjud DB'ga `notifiedDayBefore` va `notifiedTwoHours` ustunlari qo'shilmagan bo'lsa, `prisma db push` avtomatik qo'shadi.

---

## 2. Vercel (Next.js)

### Deploy
```bash
npm i -g vercel
vercel --prod
```

### Environment variables (Vercel Dashboard → Settings → Environment Variables)
```
DATABASE_URL          = postgresql://...
JWT_SECRET            = <openssl rand -base64 32>
NEXTAUTH_SECRET       = <openssl rand -base64 32>
NEXTAUTH_URL          = https://yourdomain.vercel.app
NEXT_PUBLIC_APP_URL   = https://yourdomain.vercel.app
NEXT_PUBLIC_WEBAPP_URL= https://yourdomain.vercel.app/webapp
DEFAULT_CLINIC_ID     = <clinic cuid from DB>
TELEGRAM_BOT_TOKEN    = <BotFather token>
CRON_SECRET           = <openssl rand -base64 32>
```

### Vercel Cron (vercel.json)
```json
{
  "crons": [
    { "path": "/api/reminders", "schedule": "0 20 * * *" },
    { "path": "/api/reminders", "schedule": "0 8 * * *" }
  ]
}
```
`/api/reminders` route'da `Authorization: Bearer $CRON_SECRET` tekshiruvi bo'lishi kerak.

---

## 3. Telegram Bot (VPS / Railway)

Bot `polling` rejimida ishlaydi — alohida Node.js jarayon.

### Railway
1. [railway.app](https://railway.app) → New project → Deploy from GitHub
2. Root directory: `bot/`
3. Start command: `npx ts-node bot/index.ts` yoki `node dist/bot/index.js`
4. Environment variables:
   ```
   TELEGRAM_BOT_TOKEN = <token>
   DEFAULT_CLINIC_ID  = <clinic cuid>
   NEXT_PUBLIC_APP_URL= https://yourdomain.vercel.app
   ```

### VPS (PM2)
```bash
npm install -g pm2
pm2 start "npx ts-node bot/index.ts" --name clinic-bot
pm2 save
pm2 startup
```

---

## 4. Birinchi ishga tushirishdan keyin

1. `/api/health` ga GET so'rov yuboring — `"status": "ok"` qaytishi kerak
2. Telegram botga `/start` yozing — xizmatlar ro'yxati chiqishi kerak
3. WebApp URL'ni botga ulang: BotFather → /setmenubutton → URL kiriting

---

## 5. Monitoring

| Nima | Qayerda |
|------|---------|
| Server logs | Vercel Dashboard → Deployments → Functions |
| Bot logs | Railway → Logs yoki `pm2 logs clinic-bot` |
| DB | Supabase → Table Editor / Neon → Dashboard |
| Health | `GET /api/health` |
