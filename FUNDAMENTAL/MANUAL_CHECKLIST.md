# TibTaqvim — MANUAL CHECKLIST (Faqat siz bajara olasiz)

> **Yangilandi:** 2026-06-05 (To'lqin 1–6 yakunida)  
> Ustuvorlik tartibi: 🔴 KRITIK → 🟠 MUHIM → 🟡 KEYINROQ

---

## 🔴 KRITIK (Hozir bajaring — production xavf)

### M-1. Vercel: DATABASE_URL ga `connection_limit=1` qo'shing

**Nima qilish:**
```
Vercel Dashboard → tibtaqvim project → Settings → Environment Variables
DATABASE_URL qiymatiga ?connection_limit=1 qo'shing:

postgresql://postgres.lxqimithjjabhnldcugc:...@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**Qayerda:** https://vercel.com/oqiljonplay-ctrls-projects/tibtaqvim/settings/environment-variables

**Nega muhim:** pgBouncer transaction mode (Supabase free) max ~10 connection. `connection_limit=1` yo'q bo'lsa Prisma 10+ parallel request'da pool exhaustion → **HTTP 500**. Wave 2 testida 3×500 xato shu sababli bo'ldi. `.env.local` da qo'shilgan, lekin Vercel production env'da HALI YO'Q.

**Qilmasa nima bo'ladi:** Peak load'da (≥10 parallel) production 500 xatosi. Bron qabul qilinmaydi.

---

### M-2. ✅ Test artefaktlarini tozalash — TUGALLANDI (2026-06-05)

**Nima qilindi:**

Bazadan barcha TEST bronlari o'chirildi:
- `cmpv6c4jl0003jx041zimglj9` (arrived/paid, statistic buzgan) ✓ o'chirildi
- 13 ta `__TEST__Bemor*` va `__WAVE5TEST__` bronlar ✓ o'chirildi
- Barcha TEST service'lar: 0 ta topildi (ROLLBACK'dan o'chirilgan)
- Tasdiq: SELECT tekshiruvi — **0 ta TEST bron qoldi**

**Tafsilot:**
```
Clinic-demo'da Wave 2 test paytida yaratilgan 13 ta test bron:
- Duplicate TOCTOU test: cmpxsw1l80001lg04mu27u907 va boshqalar (2026-06-02)
- Holat mashinasi test: cmq0gpdwc0002kz04u4t5us5p `cancelled` (2026-06-03)

Ularning barchasi Supabase'dan Node.js + Prisma orqali o'chirildi.
```

---

### M-2. Test artefaktlarini tozalash

---

## 🟠 MUHIM (1–3 kun ichida)

### M-3. ✅ `RATE_LIMIT_ENFORCE=true` — TUGALLANDI (2026-06-05)

**Nima qilindi:**
- `RATE_LIMIT_ENFORCE=true` Vercel Environment Variables ga qo'shildi va deploy qilindi.
- Short test: frontend login formasidan ketma-ket 6 urinish qilganda `429` ("Juda ko'p urinish") qaytdi — bloklash tasdiqlandi.

**DB tekshiruvi:**
```
SELECT key, count, window_start, window_ms FROM rate_limits ORDER BY window_start DESC LIMIT 20;

Natija: mavjud yozuvlar — `auth:min:<IP>`, `auth:hour:<IP>` kabi yozuvlar ko'rildi; `auth:hour` count qiymati oshgan (misol: 25, 34) — counter to'planmoqda.
```

**Keyingi qadamlar:**
- 24–48 soat loglarni kuzatib false-positive yo'qligini tasdiqlang.
- Zarur bo'lsa `RATE_LIMIT_ENFORCE` parametrini sozlang yoki limit darajasini qayta ko'rib chiqing.

**Qilmasa nima bo'ladi:** Login brute-force va booking spamdan himoya to'liq bo'lmaydi.

---

### M-4. Frontend: WebApp initData header qo'shish

**Nima qilish:** `src/app/webapp/` da barcha `fetch()` chaqiruvlarida:
```typescript
headers: { 
  "x-telegram-init-data": window.Telegram?.WebApp?.initData ?? ""
}
```

Keyin `src/lib/telegram/webapp-auth.ts`'da enforce rejimga o'ting:
```typescript
// fallback telegramId ni yo'q qilib qo'ying — faqat verified initData
```

**Nega muhim:** R1 riski — hozir `initData` tekshiruvi LOG-ONLY rejimda. Soxta `telegramId` bilan boshqa bemorning bronlarini ko'rish texnik mumkin. Real Telegram WebApp'da `initData` avtomatik bor, lekin enforce qilinmasa brauzerdan kirish mumkin.

**Qilmasa nima bo'ladi:** Xakerlik xavfi past (Telegram WebApp orqali kelinadi), lekin enforcing yo'q.

---

## 🟡 KEYINROQ (7–30 kun)

### M-5. Payme Sandbox Test

**Kerak:**
- [ ] Payme merchant sandbox akkauntni ochish: https://merchant.payme.uz
- [ ] Sandbox `merchantId` va `secretKey` → Vercel env: `PAYME_MERCHANT_ID`, `PAYME_KEY`
- [ ] Bir klinikada to'lov config'ni sozlash: `/admin/super/clinics/clinic-demo` → To'lov tab
- [ ] `/webapp/appointments/[id]/pay` sahifasida Payme tanlash
- [ ] Callback webhook: `POST /api/payments/payme` 200 qaytaradimi?
- [ ] `Appointment.paymentStatus = 'paid'` bo'lganini tasdiqlash

---

### M-6. Click Sandbox Test

**Kerak:**
- [ ] Click merchant sandbox: https://my.click.uz
- [ ] Sandbox `serviceId` va `merchantId` → Vercel env
- [ ] Xuddi Payme kabi sinov
- [ ] **Muhim:** Wave 5 da `appointments_payment_status_check` constraint'da `failed` yo'q edi — tuzatildi. Click `failed` holat yozishini tekshiring.

---

### M-7. PAYMENT_ENCRYPTION_KEY o'rnatish

**Kerak:**
```bash
# Kalit generatsiya:
openssl rand -hex 32
```
→ Vercel env: `PAYMENT_ENCRYPTION_KEY=<hex>`

**Holat:** `src/lib/payment/config-schema.ts` AES-256-GCM poydevori tayyor, lekin kalit yo'q → merchant kalitlar hozir plain text.

---

### M-8. Cron joblarni tekshirish

**URL:** https://vercel.com/oqiljonplay-ctrls-projects/tibtaqvim/settings/crons

- [ ] `0 3 * * *` → `/api/reminders?type=day_before` — aktifmi?
- [ ] `0 8 * * *` → `/api/cron/ad-broadcast` — aktifmi?
- [ ] `0 19 * * *` → `/api/cron/expire-bookings` — aktifmi?

> ⚠️ Vercel Hobby plan: **faqat 1 ta cron** ruxsat etilgan. 3 ta kerak bo'lsa → Pro plan yoki [cron-job.org](https://cron-job.org)

---

### M-9. Supabase Storage — Uy xizmati natijalari

- [ ] Supabase Dashboard → Storage → "New Bucket"
- [ ] Bucket: `appointment-results`, Private, max 10MB
- [ ] MIME types: `image/*`, `application/pdf`

---

### M-10. Telegram Webhook holati tekshirish

```bash
curl "https://api.telegram.org/bot8510744887:AAGoBuoGP7GEtXDF4b4zEct6vSQ05do95zM/getWebhookInfo"
```

Kutilgan: `url` to'g'ri, `last_error_message` bo'sh.

---

## ✅ BAJARILDI (Ma'lumot uchun)

| Vazifa | To'lqin | Sana |
|--------|---------|------|
| RLS: barcha 29 jadval RESTRICTIVE deny_all_anon | Wave 5 | 2026-06-05 |
| Rate limiting DB-backed (shadow mode) | Wave 4 | 2026-06-05 |
| Bot state DB-backed | Wave 4 | 2026-06-03 |
| IDOR: clinicId tekshiruvi barcha workflow'da | Wave 1 | 2026-06-02 |
| getBranchScope guard | Wave 1 | 2026-06-02 |
| queueNumber TOCTOU | Wave 2 | 2026-06-04 |
| Slot capacity TOCTOU | Wave 2 | 2026-06-04 |
| State machine (expired terminal) | Wave 2 | 2026-06-04 |
| CHECK constraint (paymentStatus `failed` fix) | Wave 5 | 2026-06-05 |

---

> **Oxirgi yangilanish:** 2026-06-05 (To'lqin 6 auditdan keyin)
