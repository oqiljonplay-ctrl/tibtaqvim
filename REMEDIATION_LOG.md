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

## TO'LQIN 2 — BRON OQIMI YAXLITLIGI & RACE CONDITIONS

| # | Jiddiylik | Muammo | Ildiz sababi | Tuzatish | Isbot | Migration? | Qoldiq risk | Commit |
|---|-----------|--------|--------------|----------|-------|------------|-------------|--------|
| 2.1 | 🔴 KRITIK → ✅ | queueNumber TOCTOU: parallel bronlarda bir xil navbat raqami | `findFirst(max)+1+create` — READ COMMITTED'da atomic emas. 5 parallel curl → [2,1,2,1,1] — 3 ta duplicate! | `pg_advisory_xact_lock(hashtext(serviceId:date))` — transaksiya boshida lock. Parallel tx'lar seriallashadi. | BEFORE: [2,1,2,1,1]. AFTER: [2,1,5,4,3] — 5 ta unikal ✅. Lock transaction-level, pgBouncer bilan mos. | Yo'q | Juda past: lock granularity — bir xil serviceId+date uchun barcha bronlar seriallashadi. Faol kundagi performance ta'siri minimal (ms-darajada delay). | `260610c` |
| 2.2+2.3 | 🟡 → ✅ | Duplicate check TOCTOU + Slot TOCTOU: advisory lock faqat queueNumber blokida edi | Duplicate check (serviceId+phone+date) va slot capacity check transaksiya boshiga lock qo'yilmagan edi | Lock transaksiya boshiga ko'chirildi (duplicate+limit+queue hammani qamrab oladi). bookDiagnostic: `slot:${slotId}` advisory lock qo'shildi | Code analysis: lock endi barcha kritik checklar oldida ✅. Slot: production'da `requiresSlot=true` xizmat yo'q — latent bug tuzatildi | Yo'q | Yo'q | `01cea3f` |
| 2.4 | 🔴 KRITIK → ✅ | Holat mashinasi: `expired → paid` va `expired → arrived` ikkisi ham HTTP 200 qaytardi | `markAsPaid/markAsArrived/markAsMissed/resetToBooked` faqat `cancelled` ni bloklagan, `expired` terminal holatini emas | Har funksiyaga `expired` (va tegishli boshqa invalid holatlarga) explicit check qo'shildi. State machine tuzatildi. | BEFORE: `expired → paid` HTTP 200 ✅. AFTER: HTTP 400 "Muddati o'tgan bron uchun to'lov belgilab bo'lmaydi" ✅. Regression: `cancelled → arrived` HTTP 400 ✅ (buzilmadi) | Yo'q | Test artefakt: appt `cmpv6c4jl0003jx041zimglj9` test sababli `status:arrived, paymentStatus:paid` holatida — MANUAL_CHECKLIST | `01cea3f` |
| 2.5 | ✅ OK | To'lov idempotentligi — markAsPaid ikki marta | — | Tekshirildi: 1-chi call → `paymentStatus:paid`. 2-chi call → `"Bu bron allaqachon to'langan"` (400) ✅ | Real curl: sequential double call → ikkinchisi 400 qaytardi | Yo'q | Parallel mode farqlari (masalan full+discount bir vaqtda) — juda past ehtimol | — |

---

## TO'LQIN 3 — (keyingi bosqich)

_Hali boshlanmadi._

---

> **Oxirgi yangilanish:** 2026-06-02
