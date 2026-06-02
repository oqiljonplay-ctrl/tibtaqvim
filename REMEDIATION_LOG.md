# TibTaqvim — Remediation Log

> Yaratildi: 2026-06-02 | Asosiy muhandis: Claude Code
> Har tuzatilgan muammo quyidagi jadvalda qayd etiladi.

---

## TO'LQIN 1 — XAVFSIZLIK & MA'LUMOT YAXLITLIGI

| # | Jiddiylik | Muammo | Ildiz sababi | Tuzatish | Isbot | Migration? | Qoldiq risk | Fayl/Branch |
|---|-----------|--------|--------------|----------|-------|------------|-------------|-------------|
| 1.1 | 🔴 KRITIK | WebApp initData validatsiyasi yo'q — `/api/webapp/appointments`, `/cancel`, `/profile` endpoint'lari `telegramId` ni query/body'dan tekshiruvsiz oladi. Soxta telegramId bilan boshqa bemorning tibbiy tarixini ko'rish yoki profilini o'zgartirish mumkin. | JWT yo'q, initData HMAC tekshiruvi yo'q. Telegram WebApp identifikatsiyasi client-tarafdan kelgan qiymatga ishonadi. | `src/lib/telegram/webapp-auth.ts` — HMAC-SHA256 validatsiya utility yaratildi. `resolveWebappTelegramId()` funksiya: initData bor → validate → telegramId olish; initData yo'q → fallback (log-only). 3 endpoint yangilandi. | `npx tsc --noEmit` toza. initData bilan test: `validateTelegramInitData()` noto'g'ri hash → `valid:false`. Soxta initData → `resolveWebappTelegramId()` → `null` → 401. | Yo'q | **LOG-ONLY rejim** — initData yubormaydigan eski clientlar hali ham ishlaydi. Keyingi bosqich: frontend'da `x-telegram-init-data` header qo'shish va enforce rejimga o'tish. | `src/lib/telegram/webapp-auth.ts`, 3 ta endpoint |
| 1.2 | 🟡 PAST | `/api/appointments/[id]/payment-info` — `tgid` query param HMAC tekshiruvisiz | Appointment UUID + telegramId ikkisini bilish kerak | Mavjud ownership check (`appointment.user?.telegramId !== tgid`) to'g'ri ishlaydi. UUID guessing amaliy emas. | IDOR tekshiruvi: appointmentId UUID bo'lgani uchun taxminlash deyarli imkonsiz | Yo'q | UUID guessing imkonsiz. Keyingi bosqichda webapp-auth pattern bilan yoplash mumkin | RISK_REGISTER'da qayd |
| 1.3 | ✅ OK | getBranchScope() qamrovi | — | Tekshirildi: `services`, `doctors`, `staff`, `stats`, `reception` — barchasi `getBranchScope()` yoki manual clinicId filter ishlatadi | Grep orqali tasdiqlangan | Yo'q | Yo'q | — |
| 1.4 | ✅ OK | service_role kaliti NEXT_PUBLIC_ orqali sizib chiqmagan | — | Tekshirildi: faqat `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WEBAPP_URL`, `NEXT_PUBLIC_BOT_USERNAME` — barchasi public info | grep `NEXT_PUBLIC_` | Yo'q | Yo'q | — |
| 1.5 | ✅ OK | JWT cookie HttpOnly/Secure/SameSite | — | `httpOnly:true`, `secure:prod`, `sameSite:"lax"`, `maxAge:86400` — barchasi to'g'ri | `src/app/api/auth/login/route.ts` ko'rildi | Yo'q | Yo'q | — |
| 1.6 | ✅ OK | AuthZ matritsa — reception/doctor endpoints clinicId scope | — | `markAsPaid/markAsMissed/markAsArrived` — `actorClinicId && appt.clinicId !== actorClinicId → error` | `appointment-workflow.ts` ko'rildi | Yo'q | Yo'q | — |

---

## TO'LQIN 2 — (keyingi bosqich)

_Hali boshlanmadi. Wave 1 tasdiqlanganidan keyin boshlanadi._

---

## TO'LQIN 3 — (keyingi bosqich)

_Hali boshlanmadi._

---

> **Oxirgi yangilanish:** 2026-06-02
