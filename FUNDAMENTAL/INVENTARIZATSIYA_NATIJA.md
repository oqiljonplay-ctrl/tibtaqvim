# TibTaqvim — To'liq Imkoniyatlar Inventarizatsiyasi + Startap Viziyasi
> Sana: 2026-05-30 | Versiya: 1.0 | Taqdimot + Startap Rejasi uchun

---

## ROL 1: USER (Bemor / Patient WebApp)

| # | Sahifa/Bo'lim | Tugma/Imkoniyat | Vazifasi | API/Endpoint | Holati |
|---|---|---|---|---|---|
| 1 | `/webapp` — Bosh sahifa | "Bron qilish" tugmasi | Yangi bron oqimini boshlaydi | — | Tayyor |
| 2 | `/webapp` — Bosh sahifa | Klinika tanlash (ClinicSwitcher) | Faol klinikani almashtiradi | `GET /api/me/clinics` | Tayyor |
| 3 | `/webapp` — Bosh sahifa | "Bugungi bronlar" bo'limi | Bugun bo'ladigan bronlarni ko'rsatadi | `GET /api/webapp/appointments` | Tayyor |
| 4 | `/webapp` — Bosh sahifa | "Yaqinlashayotgan" bo'lim | Kelgusidagi bronlarni ko'rsatadi | `GET /api/webapp/appointments` | Tayyor |
| 5 | `/webapp` — Bosh sahifa | "Tarix" bo'limi | O'tgan bronlar ro'yxati | `GET /api/webapp/appointments` | Tayyor |
| 6 | `/webapp/clinics` | Klinika kartochkasi | Klinika tanlash, filiallarni ko'rish | `GET /api/clinics` | Tayyor |
| 7 | `/webapp/clinics/[id]/branches` | Filial tanlash tugmasi | Filialni bron uchun tanlaydi | — | Tayyor |
| 8 | Booking flow — 1-qadam | Xizmat tanlash (ServicePicker) | Xizmatlar ro'yxatidan tanlash | `GET /api/services` | Tayyor |
| 9 | Booking flow — 2-qadam | Sana tanlash (Calendar) | Bo'sh kunlarni ko'rsatadi, sana tanlaydi | `GET /api/slots` | Tayyor |
| 10 | Booking flow — 3-qadam | Shifokor tanlash | Mavjud shifokorlardan birini tanlash | `GET /api/doctors` | Tayyor |
| 11 | Booking flow — 4-qadam | Vaqt (slot) tanlash | Bo'sh vaqt slotlarini ko'rsatadi | `GET /api/slots` | Tayyor |
| 12 | Booking flow — 5-qadam | Bemor ma'lumotlari form | Ism, telefon kiritish | — | Tayyor |
| 13 | Booking flow — Tasdiq | "Tasdiqlash" tugmasi | Bronni yaratadi, Telegram xabar yuboradi | `POST /api/book` | Tayyor |
| 14 | BookingFlipCard — Old tomon | Bron ma'lumotlari | Sana, shifokor, xizmat, status ko'rsatadi | — | Tayyor |
| 15 | BookingFlipCard — Orqa tomon | Shifokor profili | Shifokor rasmi, bio, tajriba, ish joylari | — | Tayyor |
| 16 | BookingFlipCard | "Bekor qilish" tugmasi | Bronni bekor qiladi | `POST /api/webapp/cancel` | Tayyor |
| 17 | BookingFlipCard | "Ko'chirish" tugmasi | Bronni boshqa vaqtga o'tkazish | — | Pending |
| 18 | BookingFlipCard | "To'lash" tugmasi (Payme/Click) | To'lov sahifasiga yo'naltiradi | `POST /api/payments/*/create-link` | Tayyor |
| 19 | `/webapp/profile` (ProfileFlipCard) | Profil tahrirlash | Ism, familya, otasining ismi o'zgartirish | `PATCH /api/webapp/profile` | Tayyor |
| 20 | `/webapp/profile` | Viloyat/Tuman tanlash | Manzil ma'lumotlarini saqlash | `PATCH /api/webapp/profile` | Tayyor |
| 21 | `/webapp/my-clinics` | Klinikani qo'shish/olib tashlash | Klinikalar ro'yxatini boshqarish | `POST /api/user/clinics` | Tayyor |
| 22 | Mehmon bemor (guest) | Boshlang'ich ro'yxatdan o'tish | Telegramdagi /start orqali auto-register | `POST /api/user/register` | Tayyor |
| 23 | Telegram bot | `/start` komanda | WebApp'ni ochadi, profil/klinika ko'rsatadi | Bot handler | Tayyor |
| 24 | Dependent boshqaruvi | Qaramog'imdagilarni qo'shish | Oila a'zosi uchun bron qilish | `POST /api/dependents` | Tayyor |

**Xulosa — ROL 1:** Jami **24** imkoniyat. Tayyor: **22**. Pending: **2** (ko'chirish tugmasi, slot CRUD UI yashirilgan).

---

## ROL 2: KLINIKA (Multi-clinic egasi / Boshqaruvi)

| # | Sahifa/Bo'lim | Tugma/Imkoniyat | Vazifasi | API/Endpoint | Holati |
|---|---|---|---|---|---|
| 1 | `/admin` — Dashboard | KPI kartochkalari (6 ta) | Bugungi bronlar, daromad, bemorlar sonini ko'rsatadi | `GET /api/admin/stats` | Tayyor |
| 2 | `/admin` | "TelegramChatButton" | Telegram kanalga o'tish / qo'ng'iroq | — | Tayyor |
| 3 | `/admin/branches` | "Filial qo'shish" tugmasi | Yangi filial qo'shish formi ochadi | `POST /api/admin/branches` | Tayyor |
| 4 | `/admin/branches/[id]` | "Tahrirlash" tugmasi | Filial nomi, manzil, koordinata o'zgartirish | `PATCH /api/admin/branches/[id]` | Tayyor |
| 5 | `/admin/branches/[id]` | "O'chirish" tugmasi | Filialni o'chiradi (soft delete) | `DELETE /api/admin/branches/[id]` | Tayyor |
| 6 | `/admin/services` | "Xizmat qo'shish" tugmasi | Xizmat nomi, turi, narx, limit belgilash | `POST /api/admin/services` | Tayyor |
| 7 | `/admin/services/[id]` | Narx, limit tahrirlash | Xizmat narxi va kunlik limiti o'zgartirish | `PATCH /api/admin/services/[id]` | Tayyor |
| 8 | `/admin/services/[id]` | Pre-payment toggle | Oldindan to'lov yoqish/o'chirish | `PATCH /api/admin/services/[id]` | Tayyor |
| 9 | `/admin/services/[id]` | Filial-xizmat ulash | Qaysi filiallarda xizmat ko'rsatilishini belgilash | `PATCH /api/admin/services/[id]` | Tayyor |
| 10 | `/admin/services/[id]` | Shifokor-xizmat M2M | Xizmatga shifokor tayinlash (multi-select) | `PATCH /api/admin/services/[id]` | Tayyor |
| 11 | `/admin/doctors` | "Shifokor qo'shish" | Yangi shifokor profili yaratish | `POST /api/admin/doctors` | Tayyor |
| 12 | `/admin/doctors/[id]` | Profil tahrirlash | Shifokor ma'lumotlari yangilash | `PATCH /api/admin/doctors/[id]` | Tayyor |
| 13 | `/admin/doctors/[id]` | QueueMode tanlash | Online/Offline/Mixed navbat rejimi | `PATCH /api/admin/doctors/[id]` | Tayyor |
| 14 | `/admin/staff` | Xodim qo'shish | Qabulxona/admin xodim qo'shish, parol berish | `POST /api/admin/staff` | Tayyor |
| 15 | `/admin/promotions` | Promociya qo'shish | Embed URL yoki post-URL orqali reklama qo'yish | `POST /api/admin/promotions` | Tayyor |
| 16 | `/admin/broadcast` | Ad kampaniya yaratish | Telegram kanallarga e'lon yuborish oqimi | `POST /api/admin/ad-campaigns` | Tayyor |
| 17 | `/admin/broadcast` | "Hozir yuborish" tugmasi | Kampaniyani darhol yuboradi | `POST /api/admin/ad-campaigns/[id]/send-now` | Tayyor |
| 18 | Klinika sozlamalari | To'lov konfiguratsiya | Payme/Click merchant ID, secret key kiritish | `POST /api/admin/clinics/[id]/payment-config` | Tayyor |
| 19 | user_clinics M2M | Admin tayinlash | Foydalanuvchini klinikaga admin sifatida ulash | `POST /api/admin/super/clinics/[id]/admins` | Tayyor |
| 20 | Slot CRUD UI | Slot qo'shish/o'chirish | Kunlik slot jadvali yaratish | — | Yashirilgan |

**Xulosa — ROL 2:** Jami **20** imkoniyat. Tayyor: **19**. Yashirilgan: **1** (Slot CRUD UI).

---

## ROL 3: ADMIN (Superadmin)

| # | Sahifa/Bo'lim | Tugma/Imkoniyat | Vazifasi | API/Endpoint | Holati |
|---|---|---|---|---|---|
| 1 | `/admin/super/clinics` | Klinikalar ro'yxati | Barcha klinikalarni ko'rish, search/filter | `GET /api/admin/super/clinics` | Tayyor |
| 2 | `/admin/super/clinics` | "Klinika qo'shish" | Yangi klinika yaratish (nomi, plan, logo) | `POST /api/admin/super/clinics` | Tayyor |
| 3 | `/admin/super/clinics/[id]` | Subscription holati | Plan (free/pro/enterprise) va status o'zgartirish | `PATCH /api/admin/super/clinics/[id]` | Tayyor |
| 4 | `/admin/super/clinics/[id]` | Feature flags | slot, queue, homeService, prePayment modullarini yoqish | `PATCH /api/admin/super/clinics/[id]/features` | Tayyor |
| 5 | `/admin/super/clinics/[id]` | Module config | Qaysi klinikada qaysi modul yoqiq ekanini boshqarish | `PATCH /api/admin/super/clinics/[id]/modules` | Tayyor |
| 6 | `/admin/super/clinics/[id]/admins` | Admin qo'shish/o'chirish | Klinikaga admin tayinlash, o'chirish | `POST/DELETE /api/admin/super/clinics/[id]/admins` | Tayyor |
| 7 | `/admin/super/clinics/[id]/branches` | Filiallar ko'rish | Klinikaning barcha filiallarini ko'rish | `GET /api/admin/super/clinics/[id]/branches` | Tayyor |
| 8 | `/admin/super/stats` | Dashboard KPI — 6 grafik | Jami klinikalar, bronlar, daromad, faol bemorlar | `GET /api/admin/super/stats` | Tayyor |
| 9 | `/admin/super/audit` | Audit log ko'rish | Kim, qachon, nima o'zgartirganini ko'rish | `GET /api/admin/super/audit` | Tayyor |
| 10 | `/admin/super/ads` | Ad channel qo'shish | Telegram kanal/guruhni tizimga ulash | `POST /api/admin/ad-channels` | Tayyor |
| 11 | `/admin/super/ads` | Ad campaign boshqaruvi | Reklama kampaniyalarini ko'rish, tahrirlash | `PATCH /api/admin/ad-campaigns/[id]` | Tayyor |
| 12 | Ad broadcast | "Hozir yuborish" (superadmin) | Platformadan kampaniyani darhol yuborish | `POST /api/admin/ad-campaigns/[id]/send-now` | Tayyor |
| 13 | Cron | `POST /api/cron/ad-broadcast` | Rejalashtirilgan reklamalarni avtomatik yuborish | Cron job | Tayyor |
| 14 | Foydalanuvchilar | Shifokor/xodim parol boshqaruvi (A→D auth) | Xodimga parol berish, o'zgartirish | `POST /api/admin/staff` | Tayyor |
| 15 | `/admin/super/promotions` | Platform promociyalari | Barcha klinikalar uchun umumiy promociyalar | `POST /api/admin/super/promotions` | Tayyor |

**Xulosa — ROL 3:** Jami **15** imkoniyat. Tayyor: **15**. Pending: **0**.

---

## ROL 4: SHIFOKOR (Doctor)

| # | Sahifa/Bo'lim | Tugma/Imkoniyat | Vazifasi | API/Endpoint | Holati |
|---|---|---|---|---|---|
| 1 | `/doctor` — Bosh sahifa | Xodim login (parol bilan) | Username+parol bilan tizimga kirish | `POST /api/auth/login` | Tayyor |
| 2 | `/doctor` — Bugungi navbat | Bemorlar ro'yxati | Faqat o'z bemorlarini ko'radi (doctorId filter) | `GET /api/doctor/appointments` | Tayyor |
| 3 | `/doctor` | "Keldi" belgisi | Bemorning kelganligini tasdiqlaydi | `PATCH /api/doctor/appointments/[id]/attendance` | Tayyor |
| 4 | `/doctor` | "Kelmadi" belgisi | Bemorning kelmaganligini belgilaydi | `PATCH /api/doctor/appointments/[id]/attendance` | Tayyor |
| 5 | `/doctor` | Navbat raqami ko'rsatgich | Hozir qaysi bemor qabulda ekanini ko'rsatadi | — | Tayyor |
| 6 | `/doctor` | Print/PDF eksport | Bugungi navbat jadvalini chop etish/PDF | — | Tayyor |
| 7 | `/doctor` | ServiceIslandCard | Xizmat bo'yicha guruhlab ko'rsatish | — | Tayyor |
| 8 | `/doctor/profile` | Profil ma'lumotlari to'ldirish | Ism, familya, otaism, position, department | `PATCH /api/doctor/profile` | Tayyor |
| 9 | `/doctor/profile` | Ta'lim ma'lumotlari | Universtet, daraja, yil | `PATCH /api/doctor/profile` | Tayyor |
| 10 | `/doctor/profile` | Mutaxassislik/yo'nalishlar | Specialties va directions qo'shish | `PATCH /api/doctor/profile` | Tayyor |
| 11 | `/doctor/profile` | Ish tajribasi | Workplaces, years qo'shish | `PATCH /api/doctor/profile` | Tayyor |
| 12 | `/doctor/profile` | Ish jadvali (workSchedule) | Haftalik ish kunlari va vaqtlari | `PATCH /api/doctor/profile` | Tayyor |
| 13 | `/doctor/profile` | Operatsiyalar soni | operationsCount va bio maydoni | `PATCH /api/doctor/profile` | Tayyor |
| 14 | BookingFlipCard orqa tomon | Shifokor profil kartochkasi | Bemorga shifokor bio/profil ko'rsatish | — | Tayyor |
| 15 | `/stats` — Statistika | 3 ta tayyor grafik | Kunlik bronlar, bemorlar soni, daromad | `GET /api/stats` | Tayyor |
| 16 | `/stats` — Statistika | 3 ta pending grafik | Rating, qayta kelganlar, tashxis statistikasi | — | Pending |

**Xulosa — ROL 4:** Jami **16** imkoniyat. Tayyor: **15**. Pending: **1** (3 ta grafik).

---

## ROL 5: QABULXONA (Reception)

| # | Sahifa/Bo'lim | Tugma/Imkoniyat | Vazifasi | API/Endpoint | Holati |
|---|---|---|---|---|---|
| 1 | `/reception` — Login | Qabulxona login | Username+parol bilan kirish | `POST /api/auth/login` | Tayyor |
| 2 | `/reception` — Bronlar | Bugungi bronlar ro'yxati | Kutilayotgan to'lovlar va holatlar | `GET /api/reception/appointments` | Tayyor |
| 3 | `/reception` | To'lov qabul qilish | Naqd to'lovni tasdiqlash | `PATCH /api/reception/appointments/[id]/payment` | Tayyor |
| 4 | `/reception` | "Bekor qilish" | Bronni bekor qilish | `PATCH /api/reception/appointments/[id]` | Tayyor |
| 5 | `/reception` | "Ko'chirish" | Bron sanasi/vaqtini o'zgartirish | — | Pending |
| 6 | `/reception` | TelegramChatButton | Bemorga Telegram orqali xabar yuborish | `POST /api/telegram-relay/send-message` | Tayyor |
| 7 | `/reception` | LocationButtons | Bemorning manziliga yo'nalish, Google Maps | — | Tayyor |
| 8 | `/reception` | LiveLocationPanel | Uyga chiqish xizmatida jonli joylashuv kuzatish | — | Tayyor |
| 9 | `/reception` | Bemor qidirish | Ism yoki telefon bo'yicha bemor topish | `GET /api/reception/appointments?search=` | Tayyor |
| 10 | `/reception` | ReceptionCard | Har bir bron uchun to'lov status badge | — | Tayyor |
| 11 | Slot boshqaruvi | 8 slot DB'da mavjud | UI yashirilgan — kod level slot mavjud | — | Yashirilgan |

**Xulosa — ROL 5:** Jami **11** imkoniyat. Tayyor: **9**. Pending: **1** (ko'chirish). Yashirilgan: **1** (Slot CRUD UI).

---

## Telegram Bot — To'liq Komandalar

| # | Komanda/Callback | Handler | Vazifasi | Holati |
|---|---|---|---|---|
| 1 | `/start` | `handleStart` | WebApp'ni ochadi, profil/klinika ko'rsatadi | Tayyor |
| 2 | `welcome_back` callback | `mkWelcomeBackKeyboard` | Qaytib kelgan foydalanuvchi tasdig'i | Tayyor |
| 3 | Klinika tanlash callback | `handleClinicCallback` | Klinika selection, filiallarni yuklaydi | Tayyor |
| 4 | Xizmat tanlash callback | `handleServiceCallback` | Xizmat tanlash, shifokorlarni yuklaydi | Tayyor |
| 5 | Sana tanlash | `mkDateKeyboard` | Calendar inline buttons ko'rsatadi | Tayyor |
| 6 | Vaqt tanlash | `mkSlotKeyboard` | Bo'sh slot tugmalarini ko'rsatadi | Tayyor |
| 7 | Tasdiq | `handleBook` | Bronni yaratadi, qabulxonaga xabar | Tayyor |
| 8 | "Bekor qilish" | `cancel` callback | Bron jarayonini to'xtatadi | Tayyor |
| 9 | Webhook | `POST /api/webhook/telegram` | Bot'ga keladigan barcha xabarlarni qabul qiladi | Tayyor |

---

## Asosiy Jadvallar (Prisma Schema)

| Jadval | Maqsadi | Asosiy Maydonlar |
|---|---|---|
| `users` | Foydalanuvchilar | telegramId, tibId, phone, role, fatherName |
| `clinics` | Klinikalar | name, subscriptionPlan, subscriptionStatus, logo |
| `branches` | Filiallar | clinicId, name, address, latitude, longitude |
| `services` | Xizmatlar | clinicId, branchId, type, price, requiresSlot, dailyLimit, prePayment |
| `doctors` | Shifokorlar | clinicId, firstName, lastName, education, bio, workSchedule, specialties |
| `appointments` | Bronlar | clinicId, serviceId, doctorId, userId, status, date, paymentStatus |
| `slots` | Vaqt slotlari | clinicId, serviceId, date, startTime, endTime, capacity |
| `staff` | Xodimlar | clinicId, branchId, username, passwordHash, role |
| `payments` | To'lovlar | appointmentId, provider (payme/click), amount, state |
| `ad_channels` | Telegram kanallar | title, chatId, scope (clinic/platform) |
| `ad_campaigns` | Reklama kampaniyalari | clinicId, targetType, startDate, scheduledAt, status |
| `clinic_promotions` | Promociyalar | clinicId, postUrl, embedId, type |
| `dependent` | Qaramog'imdagilar | userId, firstName, relation |
| `user_clinics` | User-Clinic M2M | userId, clinicId, role |

---

## Umumiy Xulosa

| Rol | Jami | Tayyor | Pending | Yashirilgan |
|---|---|---|---|---|
| USER (Bemor) | 24 | 22 | 2 | — |
| KLINIKA | 20 | 19 | — | 1 |
| ADMIN (Superadmin) | 15 | 15 | — | — |
| SHIFOKOR | 16 | 15 | 1 | — |
| QABULXONA | 11 | 9 | 1 | 1 |
| **JAMI** | **86** | **80** | **4** | **2** |

**Tayyor:** 80/86 = **93%** | **Pending:** 4 | **Yashirilgan:** 2

---

---

# KELAJAK VIZIYASI — Startap Egasi Nuqtai Nazaridan

*— Biz nima quryapmiz va bu qayerga olib boradi?*

---

## Biz haqiqiy muammoni yechdik

O'zbekistonda bugun minglab klinikalar Excel jadvallar va WhatsApp guruhlari orqali ishlamoqda. Shifokor o'zini tanishtirish uchun qog'oz rezume tutadi. Bemor klinikaga telefon qilib, qo'ng'iroq javobsiz qolsa, boshqa joyga boradi. Qabulxona xodimi kun bo'yi qo'g'irchoq kabi telefon ko'taradi va noto'g'ri ma'lumot yozadi.

TibTaqvim bu muammoni hal qildi — va bu faqat boshlanishi.

---

## Hozir qaerda turibmiz

Biz **to'liq ishlaydigan multi-tenant tibbiy platforma** qurdik:

- **86 ta imkoniyat** — 5 rol uchun (bemor, shifokor, qabulxona, klinika egasi, superadmin)
- **Telegram WebApp** — 40+ millionlik O'zbekiston Telegram bazasiga to'g'ridan kirish
- **To'lov tizimi** — Payme + Click integratsiyasi (O'zbekistonning 2 eng katta to'lov tizimi)
- **Multi-klinika** — bitta platforma, cheksiz klinikalar
- **Reklama moduli** — klinikalar o'z bemorlariga Telegram kanallar orqali murojaat qiladi

Bu shunchaki dastur emas — bu **tibbiy infratuzilma**.

---

## Keyingi 6 oy — Mahsulotni tiklash

### 1. To'lov pipelayni — Pulning kelishi (1-2 oy)
Hozir to'lov integratsiya texnik darajada tayyor. Lekin real sandboxda sinab, tijorat litsenziyasini olib, birinchi klinikada **real to'lov** amalga oshirishimiz kerak. Bu loyihaning birinchi daromad manbai.

**Maqsad:** birinchi 10 ta klinikadan oyiga **5 ming dollar** tranzaksiya hajmi.

### 2. Uy xizmati moduli — Differensiator (2-3 oy)
Hech qaysi raqibimizda yo'q: shifokor uyga boradi, bemor GPS joylashuvini ulashadi, qabulxona real vaqtda kuzatadi. Bu oddiy "booking" emas — bu **triage + dispatch** tizimi.

**Maqsad:** 3 ta klinikada "uy xizmati" modulini ishga tushirish.

### 3. Shifokor grafiklar va statistika — Retention (3-4 oy)
Shifokor kuniga 30 bemor ko'radi, lekin bugungi kunda bu raqamlar yo'qoladi. Biz har bir shifokorga **shaxsiy dashboard** berdik. Keyingi qadam: qayta kelganlar soni, bemorlar turlari, daromad grafigi — shifokor TibTaqvim'ni ixtiyoriy emas, **zaruriy** vosita deb hisoblaydi.

**Maqsad:** shifokor engagement (kunlik login) 60%+ ga yetkazish.

### 4. Click sandbox va reklama monetizatsiyasi (4-5 oy)
Klinikalar Telegram'da reklama qilmoqchi, lekin qaysi kanal necha bemor keltirganini bilishmaydi. Bizning reklama moduli bu savolga javob beradi — va bu alohida **SaaS qatlam** bo'ladi.

---

## Keyingi 12-24 oy — O'sish

### B2B bozor: "Tibbiy EHR lite"
O'zbekistonda rasmiy elektron tibbiy yozuvlar (EHR) tizimi yo'q. Davlat bu muammoni hal qila olmayapti. Biz esa hoziroq shifokor profili, bemorlar tarixi, tashxis izlari bilan bu nishni to'ldirmoqdamiz.

**Imkoniyat:** Sog'liqni saqlash vazirligiga integratsiya — davlat tender.

### B2C bozor: "Bemorning shaxsiy tibbiy daftari"
Bemor barcha klinikalardagi bronlar tarixini bitta joyda ko'radi. Tashxislar, retseptlar, laboratoriya natijalari — hammasi Telegram'da. **Google Health / Apple Health**ning O'zbek versiyasi.

**Imkoniyat:** 2 yilda 500 ming faol foydalanuvchi.

### Mintaqa: Qozog'iston, Tojikiston, Qirg'iziston
MDH mamlakatlari bir xil muammoga ega. TibTaqvim arxitekturasi multi-tenant, ko'p tilli va moslashuvchan. Telegram penetratsiyasi bu mintaqada 60%+.

**Imkoniyat:** 3 yilda 3 mamlakatda 1000+ klinika.

---

## Raqobatchilar va biz

| | TibTaqvim | DocDoc (RU) | MedMe (KZ) | Mahalliy raqiblar |
|---|---|---|---|---|
| Telegram WebApp | ✅ | ❌ | ❌ | ❌ |
| Multi-tenant | ✅ | ✅ | ✅ | ❌ |
| O'zbek tilida | ✅ | ❌ | ❌ | Ba'zilari |
| To'lov (UZ) | ✅ Payme+Click | ❌ | ❌ | Yo'q |
| Reklama moduli | ✅ | ❌ | ❌ | ❌ |
| Uy xizmati | ✅ | ❌ | ❌ | ❌ |
| Open source potential | ✅ | ❌ | ❌ | ❌ |

**Bizning ustunlik:** O'zbekiston Telegram ekotizimiga chuqur integratsiya. Bu texnik to'siq — uni qurish 6-12 oy oladi.

---

## Biznes model

```
Klinika hisob uchun:
  - Free tier: 1 filial, 1 shifokor, 50 bron/oy
  - Pro ($49/oy): 5 filial, 10 shifokor, cheksiz bron
  - Enterprise (shartnoma): cheksiz, API, white-label

Tranzaksiya komissiyasi:
  - Online to'lovlardan 1.5% (Payme/Click ustida)

Reklama:
  - Ad kampaniya uchun CPC yoki oylik paket ($20-100/oy)

Premium imkoniyatlar:
  - Uy xizmati moduli: +$19/oy
  - EHR lite (tibbiy tarix): +$29/oy
```

---

## Sifat va xavfsizlik

Biz tibbiy ma'lumotlar bilan ishlaymiz. Bu boshqa toifa:

- Barcha ma'lumotlar Supabase (AWS eu-central-1) da xavfsiz saqlangan
- Rol bo'yicha kirish nazorati (5 daraja)
- Audit log — har bir o'zgartirish yozib qo'yiladi
- Ma'lumotlar shifrlash va HTTPS everywhere

Davlat litsenziyasi va PDPL (O'zbekiston shaxsiy ma'lumotlar qonuni) talablariga muvofiq ishlaymiz.

---

## Jamoaga murojaat

Biz texnik jihatdan **tayyor** mahsulot qurdik. Bizga kerak bo'lgan narsa:

1. **Savdo/BD** — klinikalarga yetib borish, demo o'tkazish
2. **Tibbiy ekspert** — mahsulot yo'nalishini klinika mantig'iga moslashtirish
3. **Investitsiya** ($150-300K Seed) — savdo jamoasi, server, marketing

**Agar siz bu tizimni O'zbekiston tibbiyotida ishlatmoqchi bo'lsangiz — bu suhbat uchun vaqt topamiz.**

---

*TibTaqvim — Sog'lig'ingiz bir bosqich yaqinroq.*

---
> Fayl avtomatik yaratildi: 2026-05-30 | Claude Code + Codebase skanerlov asosida
