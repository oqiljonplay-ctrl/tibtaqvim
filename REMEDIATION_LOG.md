# TibTaqvim — Remediation Log

> Yaratildi: 2026-06-02 | Asosiy muhandis: Claude Code
> Har tuzatilgan muammo quyidagi jadvalda qayd etiladi.

---

## TO'LQIN 1 — XAVFSIZLIK & MA'LUMOT YAXLITLIGI

| # | Jiddiylik | Muammo | Ildiz sababi | Tuzatish | Isbot | Migration? | Qoldiq risk | Fayl/Branch |
|---|-----------|--------|--------------|----------|-------|------------|-------------|-------------|
| 1.1 | 🔴 KRITIK | WebApp initData validatsiyasi yo'q — `/api/webapp/appointments`, `/cancel`, `/profile` endpoint'lari `telegramId` ni query/body'dan tekshiruvsiz oladi. Soxta telegramId bilan boshqa bemorning tibbiy tarixini ko'rish yoki profilini o'zgartirish mumkin. | JWT yo'q, initData HMAC tekshiruvi yo'q. Telegram WebApp identifikatsiyasi client-tarafdan kelgan qiymatga ishonadi. | `src/lib/telegram/webapp-auth.ts` — HMAC-SHA256 validatsiya utility yaratildi. `resolveWebappTelegramId()` funksiya: initData bor → validate → telegramId olish; initData yo'q → fallback (log-only). 3 endpoint yangilandi. | `npx tsc --noEmit` toza. initData bilan test: `validateTelegramInitData()` noto'g'ri hash → `valid:false`. Soxta initData → `resolveWebappTelegramId()` → `null` → 401. | Yo'q | **LOG-ONLY rejim** — initData yubormaydigan eski clientlar hali ham ishlaydi. Keyingi bosqich: frontend'da `x-telegram-init-data` header qo'shish va enforce rejimga o'tish. | `src/lib/telegram/webapp-auth.ts`, 3 ta endpoint |
| 1.2 | 🔴 KRITIK → ✅ TUZATILDI | IDOR: cross-clinic appointment ID bilan 400 + "Bu bron boshqa klinikaga tegishli" qaytardi — appointment mavjudligi va klinikasini oshkor qilardi. `payment-info` 403 qaytardi. | `findUnique(id)` + keyin explicit check: noto'g'ri klinikada ham bron topiladi, xato mesajida clinic info sızırdı | `appointment-workflow.ts`: barcha 5 funksiya `findFirst(id + clinicId)` ga o'tdi. Boshqa klinikaning broni "Topilmadi" kabi ko'rinadi. Route handler: `notFound→404`. `payment-info`: 403→404. | **Real curl (production):** BEFORE: `HTTP 400 "Bu bron boshqa klinikaga tegishli"`. AFTER: `HTTP 404 "Topilmadi"`. Testlangan: `cmpmgmbci0001jp04ayo6q9tf` (Test klinika) → clinic-demo admin bilan → 404. Regression: clinic-demo admin o'z broniga kirdi → `HTTP 200` ✅ | Yo'q | Yo'q | `appointment-workflow.ts`, reception/payment, doctor/attendance, payment-info |
| 1.3 | 🔴 KRITIK → ✅ TUZATILDI | `getBranchScope()` clinicId undefined bo'lsa Prisma filter yo'qoladi — barcha klinika ma'lumotlari qaytadi | `auth.clinicId!` TypeScript non-null assertion runtime'da kafolatlamaydi. `undefined` qiymat Prisma where'da ignored bo'ladi | `branch-scope.ts`: non-super_admin uchun `if (!auth.clinicId) throw new Error(...)` runtime guard qo'shildi. Node.js test: `getBranchScope({clinicId: undefined})` → `{}` → Prisma where'da clinicId yo'q → barcha records qaytardi (confirmed). Guard bundan keyin exception tashlaydi. | `node -e` test: `{ clinicId: undefined }` → Prisma where `{ isActive: true }` (clinicId yo'q — barcha records). Runtime guard deploy qilindi. | Yo'q | Yo'q | `src/lib/branch-scope.ts` |
| 1.4 | ✅ OK | service_role kaliti NEXT_PUBLIC_ orqali sizib chiqmagan | — | Tekshirildi: faqat `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WEBAPP_URL`, `NEXT_PUBLIC_BOT_USERNAME` — barchasi public info | grep `NEXT_PUBLIC_` | Yo'q | Yo'q | — |
| 1.5 | ✅ OK | JWT cookie HttpOnly/Secure/SameSite | — | `httpOnly:true`, `secure:prod`, `sameSite:"lax"`, `maxAge:86400` — barchasi to'g'ri | `src/app/api/auth/login/route.ts` ko'rildi | Yo'q | Yo'q | — |
| 1.6 | ✅ OK | service_role kaliti NEXT_PUBLIC_ orqali sizib chiqmagan | — | Tekshirildi: faqat public info | grep toza | Yo'q | Yo'q | — |

---

## TO'LQIN 2 — (keyingi bosqich)

_Hali boshlanmadi. Wave 1 tasdiqlanganidan keyin boshlanadi._

---

## TO'LQIN 3 — (keyingi bosqich)

_Hali boshlanmadi._

---

> **Oxirgi yangilanish:** 2026-06-02
