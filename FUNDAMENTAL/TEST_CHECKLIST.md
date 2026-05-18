# Test Checklist

## A. Doctor Queue (navbat)

- [ ] Xizmat tanlash → sana tanlash → shifokor tanlash → ism/telefon → tasdiqlash → bron muvaffaqiyatli
- [ ] Shifokorni tanlamasdan ("Shifokor tanlashsiz davom etish") bron qilish ishlaydi
- [ ] Bir xil telefon raqam bilan ikkinchi marta bron qilishga urinish → "allaqachon bron" xatosi
- [ ] `dailyLimit` to'lgandan keyin bron qilishga urinish → "kunlik limit to'ldi" xatosi
- [ ] Navbat raqami (`queueNumber`) ketma-ket o'sib boradi (1, 2, 3...)
- [ ] O'tgan sanaga bron qilishga urinish → validator xatosi

## B. Diagnostic (tashxis)

- [ ] `requiresSlot = true` xizmat uchun uyacha tanlash majburiy
- [ ] `requiresSlot = false` xizmat — uyachasiz bron ishlaydi
- [ ] To'lgan uyachani tanlashga urinish → "uyacha to'lgan" xatosi
- [ ] Faol bo'lmagan uyachani tanlash → "uyacha mavjud emas" xatosi
- [ ] `dailyLimit` tekshiruvi ishlaydi

## C. Home Service (uy xizmati)

- [ ] Manzilsiz yuborish → "manzil majburiy" xatosi
- [ ] Manzil bilan to'g'ri bron qilinadi
- [ ] `dailyLimit` tekshiruvi ishlaydi

## D. Telegram Bot

- [ ] `/start` — xizmatlar ro'yxati chiqadi
- [ ] Noto'g'ri xizmat ID → xato xabari
- [ ] Sessiya 30 daqiqada muddati tugaydi → "Sessiya muddati tugadi" xabari
- [ ] Tasdiqlash tugmasini ikki marta bosish ikkinchi bronga olib kelmaydi
- [ ] "Bekor qilish" tugmasi state'ni tozalaydi
- [ ] Eskirgan callback (eski xabar tugmasi) → "Eskirgan havola" xabari
- [ ] Bot xatosida `/start` ni taklif qiladi

## E. WebApp

- [ ] Klinika xizmatlari yuklanadi
- [ ] Sana tanlash ishlaydi (bugun / ertaga)
- [ ] `alert()` ishlatilmaydi — xatolar inline banner bilan ko'rsatiladi
- [ ] Forma yuborilayotganda tugma disabled bo'ladi (ikki marta yuborishni oldini oladi)
- [ ] API xatosi — banner xabar ko'rsatadi
- [ ] Tarmoq xatosi — banner xabar ko'rsatadi
- [ ] Muvaffaqiyatli bron — tasdiqlash ekrani ko'rsatiladi

## F. API Endpoints

- [ ] `POST /api/book` — rate limit ishlaydi (1 daqiqada 10+ so'rov → 429)
- [ ] `GET /api/health` — `{ status: "ok", db: "connected", uptime, environment, version }` qaytadi
- [ ] `GET /api/services?clinicId=...` — faol xizmatlar ro'yxati
- [ ] `GET /api/slots?serviceId=...&date=...` — bo'sh uyachalar

## G. Reminder Service

- [ ] `sendDayBeforeReminders()` — ertaga qabuli bor bemorlarga xabar yuboriladi
- [ ] Ikkinchi marta ishga tushirilganda bir xil bemorgqa qayta xabar ketmaydi (`notifiedDayBefore = true`)
- [ ] `sendTwoHourReminders()` — 2 soat ichida qabuli bo'lgan bemorlarga xabar
- [ ] Ikkinchi marta ishga tushirilganda qayta xabar ketmaydi (`notifiedTwoHours = true`)
- [ ] Telegram token bo'lmasa — xatoliksiz `false` qaytadi

## H. Environment

- [ ] `.env` faylida barcha kerakli o'zgaruvchilar bor
- [ ] `DATABASE_URL` yo'q → server ishga tushmaydi (xato chiqadi)
- [ ] `CRON_SECRET` yo'q → production'da ogohlantirish konsolda ko'rinadi
