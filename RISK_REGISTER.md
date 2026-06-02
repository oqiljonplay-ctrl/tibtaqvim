# TibTaqvim — Risk Register

> Yaratildi: 2026-06-02
> Tuzatilmagan yoki keyinga qoldirilgan risklar.

---

| # | Risk | Jiddiylik | Nega hozir tuzatilmadi | Xavf darajasi | Vaqtinchalik yumshatish | Qachon tuzatish |
|---|------|-----------|------------------------|---------------|------------------------|-----------------|
| R1 | **WebApp initData enforce qilinmagan (log-only)** — initData yubormaydigan clientlar hali ham ishlaydi. Soxta `telegramId` bilan boshqa bemorning ma'lumotini ko'rish mumkin (appointments read). | 🟠 YUQORI | Backward compat: mavjud webapp frontend `x-telegram-init-data` header yubormasligi mumkin. Avval frontend yangilanishi kerak. | Telegramdan tashqari (brauzerda) kirish juda kam. Haqiqiy Telegram WebApp'da `initData` avtomatik mavjud. | `console.warn` log yoziladi. Monitoring orqali unverified access ko'rish mumkin. | Frontend `x-telegram-init-data` header qo'shgandan keyin enforce rejimga o'tish. **Wave 4** |
| R2 | **Rate limiting in-memory (Vercel'da ishlamaydi)** — Login brute-force, book spam himoyasi yo'q | 🟠 YUQORI | Redis/Upstash hozir ulanmagan. DB-backed counter ham yo'q. | Login endpoint'da 5 req/min limit bor, lekin Vercel'da har invocation yangi instance → limit ishlaydi deyarli faqat bitta serverda. | IP-based blocking bo'lmaydi. Parollar bcrypt — brute-force sekin. | **Wave 4** — Upstash Redis yoki DB token bucket |
| R3 | **RLS policy'lar to'liq emas (15 jadval)** — `service_role` bypass qiladi (Prisma), lekin PostgREST orqali anon kirish mumkin | 🟡 O'RTA | Ko'p jadval uchun policy yozish zarur. Prisma `service_role` bilan ishlaydi → hozir xavfsiz. | Frontend Supabase JS client ishlatilmaydi → anon PostgREST kirishi yo'q. | Faqat `service_role` kalit serverda, frontend bundle'da yo'q. | **Wave 5** |
| R4 | **`/api/appointments/[id]/payment-info` — tgid HMAC tekshiruvisiz** | 🟡 O'RTA | UUID appointment ID + telegramId ikkalasini bilish kerak. Practical risk past. | UUID tahmin qilish amaliy emas. | Mavjud ownership check ishlaydi | **Wave 4** — webapp-auth pattern bilan yoplash |
| R5 | **Bot state hali in-memory Map qoldiq bormi?** | 🟠 YUQORI | `bot_states` DB jadval mavjud. Lekin `bot/state.ts` hali in-memory Map'mi? Tekshirish kerak. | Vercel webhook handler'da state yo'qolishi mumkin. | Har webhook call stateless bo'lishi kerak. | **Wave 4 boshida tekshirish** |
| R6 | **Vercel 10s timeout — broadcast** — ko'p kanalga yuborishda timeout xavfi | 🟡 O'RTA | `waitUntil()` qo'shilmagan. Hozircha kanallar soni kam. | Broadcast to'liq tugamay qolishi mumkin. | Har kampaniya uchun kanallar soni limit qo'yish | **Wave 3** |
| R7 | **PAYMENT_ENCRYPTION_KEY o'rnatilmagan** — merchant kalitlari shifrlanmadan saqlanyapti | 🟡 O'RTA | Hozir hech qanday real merchant ulanmagan → shifrlanadigan kalit yo'q | Merchant kalitlar plain text DB'da | AES-256-GCM poydevori tayyor emas | **Wave 5 / Sprint 4** |
| R8 | **Ad campaign/channel IDOR: 403 vs 404** — `forbidden()` qaytaradi, `notFound()` emas | 🔵 PAST | Admin endpoint (valid JWT kerak) → mavjudlikni oshkor qilish xavfi minimal | Juda past | — | Keyingi code-quality round |

---

> **Oxirgi yangilanish:** 2026-06-02
