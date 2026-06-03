# TibTaqvim — Qo'lda Tekshirish Kerak Bo'lgan Narsalar

> Yaratildi: 2026-06-02
> Bu ro'yxatdagi narsalar Claude Code tomonidan avtomatik tekshirib bo'lmaydi.
> Har punkt — aniq, bajarib bo'ladigan topshiriq.

---

## 1. FRONTEND — WebApp initData header qo'shish (LOG-ONLY → ENFORCE ga o'tish)

**Maqsad:** `R1` riskni yopish — enforce rejimga o'tish

**Bajarish kerak:**
1. `src/app/webapp/` barcha sahifalarda `window.Telegram.WebApp.initData` dan header olish
2. `fetch()` chaqiruvlariga `headers: { "x-telegram-init-data": tg.initData }` qo'shish
3. `resolveWebappTelegramId()` ichida `LOG_ONLY_MODE = false` qilish yoki enforce bo'ladigan parametr qo'shish
4. Real Telegram qurilmada sinash: profilni, bronlarni, bekor qilishni sinab ko'rish

---

## 2. PAYME SANDBOX TEST

**Maqsad:** To'lov oqimini haqiqiy sandbox muhitida tekshirish

**Kerak:**
- [ ] Payme merchant sandbox akkauntni ochish (merchant.payme.uz)
- [ ] Sandbox `merchantId` va `secretKey` ni Vercel env'ga qo'shish:
  ```
  PAYME_MERCHANT_ID=<sandbox merchant id>
  PAYME_KEY=<sandbox secret key>
  ```
- [ ] Bir klinikada to'lov config'ni sandbox ma'lumotlar bilan sozlash
- [ ] `/webapp/appointments/[id]/pay` sahifasidan "Payme" ni tanlash
- [ ] Real to'lov qilishga urinish (sandbox rejimida)
- [ ] Callback webhook'ni tekshirish: `POST /api/payments/payme` 200 qaytaradimi?
- [ ] `Appointment.paymentStatus` `paid` bo'lganini tasdiqlash

---

## 3. CLICK SANDBOX TEST

**Maqsad:** Click to'lov oqimini haqiqiy sandbox muhitida tekshirish

**Kerak:**
- [ ] Click merchant sandbox akkauntni ochish (my.click.uz)
- [ ] Sandbox `serviceId` va `merchantId` ni Vercel env'ga qo'shish
- [ ] Xuddi Payme kabi real sinov

---

## 4. PAYMENT_ENCRYPTION_KEY O'RNATISH

**Maqsad:** Merchant kalitlarni AES-256-GCM bilan shifrlash

**Kerak:**
- [ ] 32 byte random kalit generatsiya qilish: `openssl rand -hex 32`
- [ ] Vercel Project Settings → Environment Variables'ga qo'shish: `PAYMENT_ENCRYPTION_KEY=<hex>`
- [ ] `src/lib/payment/config-schema.ts` da encrypt/decrypt logikasini yoqish (hozir placeholder)

---

## 5. VERCEL ENV — TEKSHIRISH KERAK

Quyidagi o'zgaruvchilar Production'da o'rnatilganmi?

| O'zgaruvchi | Holat | Izoh |
|-------------|-------|------|
| `DATABASE_URL` | ✅ | pooler URL |
| `DIRECT_URL` | ✅ | migration uchun |
| `JWT_SECRET` | ✅ | |
| `TELEGRAM_BOT_TOKEN` | ✅ | |
| `TELEGRAM_WEBHOOK_SECRET` | ✅ | |
| `CRON_SECRET` | ✅ | |
| `SUPERADMIN_KEY` | ✅ | |
| `PAYMENT_ENCRYPTION_KEY` | ❌ | Qo'shilmagan — merchant kalit kelganda kerak |
| `NEXT_PUBLIC_BOT_USERNAME` | ❌ | Ads sahifasida ko'rinadigan bot username (ixtiyoriy) |

---

## 6. SUPABASE DASHBOARD — RLS POLICY TEKSHIRUV

**URL:** https://supabase.com/dashboard/project/lxqimithjjabhnldcugc/database/tables

**Tekshirish:** Quyidagi jadvallar uchun RLS yoqilgan va policy mavjudmi?

- [ ] `clinics` — anon o'qiy olmasin
- [ ] `appointments` — anon o'qiy olmasin (KRITIK!)
- [ ] `users` — anon o'qiy olmasin
- [ ] `payments` — anon o'qiy olmasin (KRITIK!)
- [ ] `clinic_settings` — anon o'qiy olmasin
- [ ] `staff` — anon o'qiy olmasin
- [ ] `audit_logs` — anon o'qiy olmasin

> **Diqqat:** Prisma `service_role` ishlatgani uchun policy qo'shilsa ham mavjud Prisma oqimi buzilmaydi. Lekin anon PostgREST kirishi bloklangani kerak.

---

## 7. TELEGRAM WEBHOOK HOLATI

**Tekshirish:**
```bash
curl "https://api.telegram.org/bot8510744887:.../getWebhookInfo"
```

**Kutilgan:**
- `url`: `https://tibtaqvim.vercel.app/api/webhook/telegram`
- `has_custom_certificate`: false
- `pending_update_count`: 0
- `last_error_message`: bo'sh yoki eskirgan

> Hozir `lastErrorMessage: "Wrong response from the webhook: 500 Internal Server Error"` bor — bu bot'da /start komandasidan tashqari narsa yuborilganda yuzaga keladi. Deploy qilingandan keyin tekshirish.

---

## 8. SUPABASE STORAGE

**Maqsad:** Uy xizmati natijalari (photo/PDF upload) uchun bucket

- [ ] Supabase Dashboard → Storage → "New Bucket"
- [ ] Bucket nomi: `appointment-results`
- [ ] Public: Yo'q (private)
- [ ] Max file size: 10MB
- [ ] Allowed MIME types: `image/*`, `application/pdf`

---

## 9. CRON JOB HOLATI — VERCEL

**URL:** https://vercel.com/oqiljonplay-ctrls-projects/tibtaqvim/settings/crons

**Tekshirish:**
- [ ] `0 3 * * *` → `/api/reminders?type=day_before` — aktifmi?
- [ ] `0 8 * * *` → `/api/cron/ad-broadcast` — aktifmi?
- [ ] `0 19 * * *` → `/api/cron/expire-bookings` — aktifmi?

> Vercel Hobby plan: faqat 1 ta cron ruxsat etilgan. Agar 3 ta kerak bo'lsa → Pro plan yoki tashqi cron (cron-job.org).

---

## 10. TEST ARTEFAKTLARINI TOZALASH

Quyidagi bronlar Wave 2 testi davomida yaratildi (`__TEST__` prefiksi bor yoki test sababli buzilgan):

**Tozalash kerak (qo'lda, Prisma Studio yoki SQL orqali):**

| Appointment ID | Holat | Sabab |
|---|---|---|
| `cmpv6c4jl0003jx041zimglj9` | `status:arrived, paymentStatus:paid` (real: expired bo'lishi kerak) | expired→paid va expired→arrived testi sababli o'zgartirildi |
| `2026-06-25` sanasidagi barcha `__TEST__Bemor` bronlar | booked | queueNumber TOCTOU testi |
| `2026-06-26` sanasidagi barcha `__TEST__Bemor` bronlar | booked | Parallel race test (duplicate queueNumber'lar mavjud!) |
| `2026-06-27` sanasidagi barcha `__TEST__BemV2` bronlar | booked | Fix tasdiqlash testi |

**SQL (Prisma Studio yoki Supabase SQL editor):**
```sql
-- Ko'rish:
SELECT id, status, "paymentStatus", "patientName", date 
FROM appointments 
WHERE "patientName" LIKE '__TEST__%' OR date IN ('2026-06-25', '2026-06-26', '2026-06-27');

-- O'chirish (faqat __TEST__ bronlar):
DELETE FROM appointments WHERE "patientName" LIKE '__TEST__%';
```

> **DIQQAT:** `cmpv6c4jl0003jx041zimglj9` ni qo'lda `status:expired, paymentStatus:pending` ga qaytaring.

---

## 11. BOT STATE — TEKSHIRISH

**Maqsad:** `bot/state.ts` hali in-memory Map ishlatayaptimi yoki DB-backed?

**Tekshirish:**
```bash
# DB'da bot_states bormi?
npx prisma studio
# bot_states jadvaliga qarash
```

Agar hali `userState` global Map ishlatilayotgan bo'lsa — bu R5 riskini tasdiqlaydi.

---

> **Oxirgi yangilanish:** 2026-06-02
