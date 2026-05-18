# 📋 TibTaqvim — Kelajak Rejalar va Yechimlar

> **Holat:** 17-may, 2026 yiliga ko'ra  
> **Maqsad:** Bu hujjat — kelajakda davom etish uchun barcha qarorlar, UI mokap va texnik arxitekturani saqlash  
> **Loyiha:** https://tibtaqvim.vercel.app  
> **Repo:** oqiljonplay-ctrl/tibtaqvim

---

## 📌 LOYIHA KONTEKSTI (Tegmaslik)

### Mavjud holat
- **Stack:** Next.js 14 (App Router) + Prisma 6 + Supabase PG17 + Vercel + Telegram WebApp/Bot
- **Supabase project_id:** `lxqimithjjabhnldcugc`
- **Vercel project_id:** `prj_U0d0bOMH4rj6Ao2JVeeQtGvgjKgJ`
- **Production:** https://tibtaqvim.vercel.app

### Tugagan ishlar
- ✅ 5 rol tizimi (super_admin, clinic_admin, doctor, receptionist, patient)
- ✅ Service-Doctor M2M + queueMode (live/online/slot-disabled)
- ✅ Specialty dropdown
- ✅ Doctor date picker
- ✅ Admin 6 ta KPI grafik (Recharts)
- ✅ Cookie + JWT 24h
- ✅ RLS + Audit log
- ✅ Telegram webhook secret

### Mavjud akkauntlar
- super_admin: `+998999999999`
- clinic_admin: `+998900000000` / `admin123`
- doctor: `+998901111111` / `doctor123`
- receptionist: `+998902222222` / `reception123`

---

# 🗂 KELAJAK REJALAR — 3 ta katta yo'nalish

1. **TO'LOV TIZIMI** — Click/Payme integratsiya + Kassa apparat (alohida)
2. **MULTI-CLINIC TIZIMI** — Klinika tanlash + Filiallar
3. **UY XIZMATI NATIJALARI** — Laborant flow + tahlil natijalari

---

# 💳 1. TO'LOV TIZIMI

## 🎯 Strategik qarorlar (foydalanuvchi tasdiqlagan)

### 1.1. Variant — Variant 1 (Redirect) ⭐ TANLANGAN

```
Bemor "To'lash" bosadi
   ↓
Backend Payme/Click API'ga so'rov yuboradi
   ↓
Payme/Click — to'lov sahifasi URL'ini qaytaradi
   ↓
Bemor brauzerda Payme/Click sahifasiga o'tkaziladi (redirect)
   ↓
Bemor to'laydi (karta + SMS)
   ↓
Payme/Click webhook bizga yuboradi
   ↓
Bemor avtomatik bizning sayt/botga qaytadi
```

**Sabab:**
- ✅ Eng oson texnik integratsiya
- ✅ Eng xavfsiz (karta ma'lumotlari sizning saytga umuman tegmaydi)
- ✅ PCI DSS standart
- ✅ Standart UX (har kim Click/Payme'ni biladi)
- ✅ Mobile'da ham yaxshi ishlaydi

### 1.2. Tanlangan to'lov tizimi — PAYME (birinchi) + CLICK (ikkinchi)

**Sabab Payme'ni birinchi tanlash:**
- Yaxshi dokumentatsiya
- `paytechuz` paket bor (tayyor TypeScript/Node integratsiya)
- O'zbekistondagi yetakchi mashhurlik
- API barqarorlik

### 1.3. Kassa apparat — ALOHIDA jarayon

⚠️ **MUHIM:** Online to'lov va fiskal chek **ALOHIDA**:

```
Online to'lov: Click/Payme (bemor yetkazadi, uyidan)
Fiskal chek: Kassa apparat (klinika beradi, klinika ichida)
```

**Soliq qonuni talabi:**
- Online to'lov + fiskal chek **ikkalasi ham kerak**
- A-Pay P10 / UzKassa N5 — bu **klinika ichidagi qurilma**
- Klinika kassasi mavjud (sizning klinikada o'rnatilgan)

**Tibtaqvim'ning roli:**
- ✅ Online to'lov boshqaramiz (Click/Payme)
- ✅ Admin paneliga "to'langan" deb belgilash
- ❌ Kassa apparat bilan integratsiya QILMAYMIZ (alohida masala)

**Bemor klinikaga kelganda:**
1. Reception bemorni "Keldi" qiladi (admin paneldan)
2. Kassir kassa apparatda chek chiqaradi (klinika ichida)
3. Bemor qog'oz/elektron chek oladi
4. Soliq tizimi avtomatik ko'radi (online NKM)

---

## 🎨 UI MOKAP — To'lov flow

### 1.4. Bot flow (Telegram)

#### Step 1 — Bron yaratish (mavjud)
```
Bemor: /start → Xizmat → Shifokor → Sana → Tasdiqlash
```

#### Step 2 — To'lov so'rovi (YANGI)
```
Bot:
✅ Bron yaratildi!

📋 Kardiolog qabuli
👨‍⚕️ Yusupova Dilnoza  
📅 20-may, 2026
🎫 Navbat: #5
🆔 ID: tib000045

💳 Oldindan to'lov: 120 000 so'm

Quyidagi tugmalardan birini tanlang:

[💳 Payme orqali to'lash]
[💳 Click orqali to'lash]  
[🏥 Klinikada to'layman]
[❌ Bronni bekor qilish]

⏰ Bron 24 soat saqlanadi
```

#### Step 3 — Payme sahifasiga o'tish
```
[Telegram inline tugma] → Brauzer/Payme ilovasi ochiladi
                       → https://checkout.paycom.uz/...
                       → Karta tanlash
                       → SMS tasdiq
                       → To'lov
```

#### Step 4 — Botga qaytish (avtomatik webhook)
```
Bot:
✅ To'lov muvaffaqiyatli!

💰 To'langan: 120 000 so'm
💳 To'lov turi: Payme
🆔 Tranzaksiya: PM-2026-05-17-...

─────────────────────────

📋 Bron tafsilotlari:
👨‍⚕️ Yusupova Dilnoza
📅 20-may, 2026
🎫 Navbat raqami: #5
🆔 tib000045

⚠️ Klinikaga kelganda:
1. Adminga ID ni ko'rsating
2. Kassadan FISKAL CHEKNI olishni unutmang
3. Bu chek soliq uchun majburiy

📞 Klinika: +998 71 123-45-67
```

### 1.5. Webapp flow (Telegram WebApp)

#### To'lov sahifasi (yangi)
```
┌──────────────────────────────────────┐
│  ← Orqaga                            │
├──────────────────────────────────────┤
│                                       │
│  💳 To'lov tasdiqlash                │
│                                       │
│  ┌─────────────────────────────┐     │
│  │  Bron tafsilotlari          │     │
│  │  ─────────────────────      │     │
│  │  📋 Kardiolog qabuli        │     │
│  │  👨‍⚕️ Yusupova Dilnoza         │     │
│  │  📅 20-may, 2026            │     │
│  │  🎫 Navbat raqami: #5       │     │
│  │  🆔 Bron ID: tib000045      │     │
│  └─────────────────────────────┘     │
│                                       │
│  ┌─────────────────────────────┐     │
│  │  To'lov                     │     │
│  │  ─────────────────────      │     │
│  │  Xizmat narxi: 120 000 so'm │     │
│  │  Komissiya:    0 so'm       │     │
│  │  ─────────────────────      │     │
│  │  Jami:         120 000 so'm │     │
│  └─────────────────────────────┘     │
│                                       │
│  To'lov usuli:                       │
│                                       │
│  ┌─────────────────────────────┐     │
│  │ ◉ 💳 Payme                  │     │
│  │   Uzcard, Humo, Visa        │     │
│  └─────────────────────────────┘     │
│                                       │
│  ┌─────────────────────────────┐     │
│  │ ○ 💳 Click                  │     │
│  │   Uzcard, Humo              │     │
│  └─────────────────────────────┘     │
│                                       │
│  ┌─────────────────────────────┐     │
│  │ ○ 📞 Klinikada to'layman    │     │
│  │   Bron 24 soat saqlanadi    │     │
│  └─────────────────────────────┘     │
│                                       │
│  ┌─────────────────────────────┐     │
│  │     To'lash 120 000 so'm    │     │
│  └─────────────────────────────┘     │
│                                       │
│  🔒 Karta ma'lumotlari saqlanmaydi   │
│                                       │
└──────────────────────────────────────┘
```

#### To'lov muvaffaqiyatli sahifa
```
┌──────────────────────────────────────┐
│                                       │
│         ╔═══════╗                    │
│         ║  ✅   ║                    │
│         ╚═══════╝                    │
│                                       │
│   To'lov muvaffaqiyatli amalga       │
│         oshirildi!                    │
│                                       │
│  💰 120 000 so'm                     │
│  Payme orqali to'landi               │
│                                       │
│  ┌─────────────────────────────┐     │
│  │  Bron tasdiqlandi           │     │
│  │  📋 Kardiolog qabuli        │     │
│  │  👨‍⚕️ Yusupova Dilnoza         │     │
│  │  📅 20-may, 2026            │     │
│  │  🎫 Navbat raqami: #5       │     │
│  │  🆔 tib000045               │     │
│  └─────────────────────────────┘     │
│                                       │
│  📧 Botda xabarnoma yuborildi        │
│                                       │
│  ⚠️ Eslatma:                          │
│  Klinikaga kelganda, kassadan        │
│  fiskal chek olishni unutmang         │
│                                       │
│  [📋 Profilim] [🏠 Bosh sahifa]        │
│                                       │
└──────────────────────────────────────┘
```

#### To'lov xato/bekor sahifa
```
┌──────────────────────────────────────┐
│                                       │
│         ╔═══════╗                    │
│         ║  ⚠️   ║                    │
│         ╚═══════╝                    │
│                                       │
│      To'lov amalga oshmadi           │
│                                       │
│  Sabablari:                          │
│  • Kartada yetarli mablag' yo'q      │
│  • SMS tasdiq vaqti tugadi           │
│  • Bemor bekor qildi                 │
│                                       │
│  🆔 Bron ID: tib000045               │
│  ⏰ Bron 24 soat saqlanadi           │
│                                       │
│  Nima qilamiz?                       │
│                                       │
│  [🔄 Qayta urinish]                   │
│  [💳 Boshqa karta]                    │
│  [📞 Klinikada to'lash]               │
│  [❌ Bronni bekor qilish]             │
│                                       │
└──────────────────────────────────────┘
```

### 1.6. Profilim sahifa — yangi badge

**To'langan bron:**
```
┌──────────────────────────────────────┐
│  📋 Kardiolog qabuli                 │
│  👨‍⚕️ Yusupova Dilnoza                  │
│  📅 20-may, 2026                     │
│  🎫 #5                               │
│  ─────────────────────────           │
│  💳 To'lov: ✅ To'langan             │
│      120 000 so'm (Payme)            │
│                                       │
│  [📄 Chek ko'rish]  [❌ Bekor qilish] │
└──────────────────────────────────────┘
```

**To'lov kutilmoqda:**
```
┌──────────────────────────────────────┐
│  📋 Kardiolog qabuli                 │
│  👨‍⚕️ Yusupova Dilnoza                  │
│  📅 20-may, 2026                     │
│  🎫 #5                               │
│  ─────────────────────────           │
│  💳 To'lov: ⏳ Kutilmoqda            │
│      120 000 so'm                    │
│                                       │
│  ⚠️ 24 soat ichida to'lang yoki      │
│     bron bekor bo'ladi                │
│                                       │
│  [💳 Hozir to'lash]  [❌ Bekor qilish]│
└──────────────────────────────────────┘
```

### 1.7. Admin paneli — yangi filter
```
┌──────────────────────────────────────┐
│  📋 Bugungi bronlar                  │
│                                       │
│  Filter:                             │
│  [ ] Hammasi                         │
│  [✓] To'langan                       │
│  [ ] To'lov kutilmoqda               │
│  [ ] Klinikada to'laydi              │
│                                       │
│  Sana: [17-may-2026 ▼]               │
└──────────────────────────────────────┘
```

---

## 🗄 DB o'zgarishlari (kelajakda)

### appointments jadvaliga yangi ustunlar
```sql
ALTER TABLE appointments ADD COLUMN "paymentProvider" TEXT;
-- 'payme' | 'click' | 'cash' | null

ALTER TABLE appointments ADD COLUMN "paymentTransactionId" TEXT;
-- Payme/Click tranzaksiya ID

ALTER TABLE appointments ADD COLUMN "paidAt" TIMESTAMP;
-- Qachon to'landi

ALTER TABLE appointments ADD COLUMN "paymentAmount" NUMERIC;
-- Aniq to'langan summa

ALTER TABLE appointments ADD COLUMN "paymentExpiresAt" TIMESTAMP;
-- 24 soat
```

⚠️ Eslatma: `appointments.paymentStatus` (TEXT) allaqachon mavjud (default `'not_required'`). Qiymatlar: `not_required | pending | paid | failed | cancelled | refunded`.

### Yangi jadval — payment_transactions
```sql
CREATE TABLE payment_transactions (
  id TEXT PRIMARY KEY,
  "appointmentId" TEXT REFERENCES appointments(id),
  provider TEXT NOT NULL,  -- 'payme' | 'click'
  "providerTransactionId" TEXT NOT NULL UNIQUE,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL,  -- 'pending' | 'paid' | 'cancelled' | 'failed'
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "paidAt" TIMESTAMP,
  "rawWebhookPayload" JSONB,  -- audit uchun
  "cancelReason" TEXT
);

-- RLS yoqilishi shart (clinic_admin va super_admin uchun)
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
```

---

## 🔧 Backend endpoint'lar (kelajakda)

### Yangi endpoint'lar
```
POST /api/payments/payme/create
  - Bron ID + summa qabul qiladi
  - Payme API'ga so'rov yuboradi
  - To'lov URL'ini qaytaradi
  - paymentStatus = 'pending' qiladi

POST /api/payments/payme/webhook
  - Payme webhook qabul qiladi
  - Tranzaksiyani tasdiqlaydi
  - paymentStatus = 'paid' qiladi
  - Botga xabar yuboradi

POST /api/payments/click/create
  - Click uchun bir xil flow

POST /api/payments/click/webhook
  - Click webhook qabul qiladi

GET /api/payments/status/[appointmentId]
  - To'lov holatini tekshirish (polling uchun)

POST /api/payments/cancel/[appointmentId]
  - Bemor to'lovni bekor qiladi
  - paymentStatus = 'cancelled'
```

### Mavjud endpoint'lar o'zgartirilishi
```
POST /api/book — yangi paymentMethod qabul qiladi
  body: { ..., paymentMethod: 'payme' | 'click' | 'cash' }
  
POST /api/webapp/appointments — paymentStatus qaytaradi
```

---

## 📦 Texnik paketlar

```bash
npm install payme-pkg  # PayTechUz dan
# yoki
npm install @paytechuz/payme @paytechuz/click
```

---

## 📋 Yuridik talablar

1. **Klinika yuridik shaxs** bo'lishi shart (MCHJ yoki MTM yoki ETT)
2. **Payme/Click bilan shartnoma** — kichik shartnoma (1-2 hafta)
3. **Bank hisob, INN, STIR** — to'lovlar shu hisobga kelishi
4. **Komissiya:** Payme 1-3%, Click 1-2% (klinika to'laydi)

---

## ⏰ To'lov sxemasi — bosqichlar

### Bosqich 1.1 — Tayyorgarlik (klinika administrator)
- Yuridik hujjatlar
- Payme'ga shartnoma yuborish
- API key olish

### Bosqich 1.2 — Backend (~3 soat)
- DB migration (yangi ustunlar)
- 4 ta endpoint (create/webhook × 2)
- Audit log integratsiya

### Bosqich 1.3 — Frontend (~3 soat)
- Webapp to'lov sahifa
- Webapp tasdiq sahifa
- Webapp xato sahifa
- Profilim badge

### Bosqich 1.4 — Bot (~2 soat)
- To'lov so'rovi xabari
- Inline tugmalar
- Tasdiq xabari
- Xato xabari

### Bosqich 1.5 — Admin (~1 soat)
- Filter "to'langan/kutilmoqda"
- Bron kartochkada to'lov ma'lumoti

### Bosqich 1.6 — Test (~1 soat)
- Test mode Payme
- Real mode Payme
- Webhook tekshirish

**Jami:** ~10 soat ish

---

# 🏥 2. MULTI-CLINIC TIZIMI

## 🎯 Strategik qarorlar

### 2.1. Maqsad
Bemor bot/web'da **bir nechta klinika** ro'yxatini ko'rishi va tanlashi mumkin. Har klinika o'z:
- Shifokorlari
- Xizmatlari
- Filiallari bor

### 2.2. Hozirgi holat (TEGMASLIK)
- DB'da `clinics` jadval mavjud (1 ta klinika — TibTaqvim)
- `branches` jadval mavjud (1 ta filial — Asosiy filial)
- Bot/Web'da klinika tanlash YO'Q (avtomatik default)

### 2.3. Maqsadli flow

#### Bot
```
1. /start
2. "Klinikani tanlang:"
   [🏥 TibTaqvim klinikasi - Toshkent]
   [🏥 MediCare - Toshkent]
   [🏥 Sayfimed - Samarqand]
   [📍 Yaqinimdagini ko'rish]
3. Klinika tanlandi → filial tanlash
4. Filial tanlandi → xizmatlar ro'yxati
5. (mavjud flow davom)
```

#### Webapp
```
Bosh sahifa:
┌──────────────────────────────────────┐
│  TibTaqvim                            │
│  Klinikani tanlang                    │
├──────────────────────────────────────┤
│                                       │
│  [🔍 Klinika qidirish...]             │
│                                       │
│  📍 Toshkent shahar (12)              │
│                                       │
│  ┌────────────────────────────┐      │
│  │ 🏥 TibTaqvim klinikasi     │      │
│  │ ⭐ 4.8 (234 baho)          │      │
│  │ 📍 Mirobod, Toshkent       │      │
│  │ 🕐 08:00-20:00             │      │
│  │ 👨‍⚕️ 12 shifokor             │      │
│  │ [Tanlash →]                │      │
│  └────────────────────────────┘      │
│                                       │
│  ┌────────────────────────────┐      │
│  │ 🏥 MediCare                │      │
│  │ ⭐ 4.5 (89 baho)           │      │
│  │ 📍 Yunusobod, Toshkent     │      │
│  │ 🕐 24/7                    │      │
│  │ 👨‍⚕️ 8 shifokor              │      │
│  │ [Tanlash →]                │      │
│  └────────────────────────────┘      │
│                                       │
└──────────────────────────────────────┘
```

### 2.4. Klinika tanlangach — filial sahifa
```
┌──────────────────────────────────────┐
│  ← TibTaqvim klinikasi               │
├──────────────────────────────────────┤
│  Filialni tanlang:                   │
│                                       │
│  ┌────────────────────────────┐      │
│  │ 🏥 Asosiy filial           │      │
│  │ 📍 Mirobod, Amir Temur 12   │      │
│  │ 🕐 08:00-20:00             │      │
│  │ 🚇 Mirobod metrosi yonida   │      │
│  │ 👨‍⚕️ 10 shifokor             │      │
│  │ [Tanlash →]                │      │
│  └────────────────────────────┘      │
│                                       │
│  ┌────────────────────────────┐      │
│  │ 🏥 Chilonzor filiali       │      │
│  │ 📍 Chilonzor, Bunyodkor 8  │      │
│  │ 🕐 09:00-19:00             │      │
│  │ 🚇 Chilonzor metrosi        │      │
│  │ 👨‍⚕️ 5 shifokor              │      │
│  │ [Tanlash →]                │      │
│  └────────────────────────────┘      │
│                                       │
└──────────────────────────────────────┘
```

## 🗄 DB o'zgarishlari

### 2.5. Mavjud jadvallar
```sql
clinics (mavjud)
  - id
  - name
  - phone
  - address
  - logoUrl
  - isActive

branches (mavjud)
  - id
  - clinicId
  - name
  - address
  - phone
  - isActive
```

### 2.6. Kerakli yangi ustunlar (kelajakda)
```sql
ALTER TABLE clinics ADD COLUMN "description" TEXT;
ALTER TABLE clinics ADD COLUMN "rating" NUMERIC DEFAULT 0;
ALTER TABLE clinics ADD COLUMN "ratingCount" INT DEFAULT 0;
ALTER TABLE clinics ADD COLUMN "city" TEXT;
ALTER TABLE clinics ADD COLUMN "workingHours" TEXT; -- "08:00-20:00"

ALTER TABLE branches ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE branches ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE branches ADD COLUMN "workingHours" TEXT;
ALTER TABLE branches ADD COLUMN "nearbyMetro" TEXT;
```

### 2.7. Services-Branches bog'lanish
⚠️ **MUHIM:** Hozir `services.clinicId` bor, lekin `services.branchId` YO'Q. Demak:

**Variant A — Service clinic darajasida** (mavjud, sodda)
- Bir xizmat — bir klinika ichida hamma filialda
- Faqat shifokor filial bo'yicha farqlanadi

**Variant B — Service branch darajasida** (yangi, mukammal)
- Bir xizmat — har filialda alohida (narx, mavjudlik)
- Filiallar boshqacha bo'lishi mumkin

**TANLOV:** Foydalanuvchi ko'rsatma berdi — **Variant B**, lekin keyinroq qilamiz (filial bo'yicha xizmat ajratish).

### 2.8. Yangi jadval — clinic_ratings (kelajak)
```sql
CREATE TABLE clinic_ratings (
  id TEXT PRIMARY KEY,
  "clinicId" TEXT REFERENCES clinics(id),
  "userId" TEXT REFERENCES users(id),
  "appointmentId" TEXT REFERENCES appointments(id),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("appointmentId")  -- 1 bron = 1 baho
);
```

---

## 🔧 Backend endpoint'lar (kelajak)

### Yangi endpoint'lar
```
GET /api/clinics
  - Barcha aktiv klinikalar ro'yxati
  - Filter: city, hasService, rating
  - Sort: rating, distance, name

GET /api/clinics/[clinicId]
  - Bir klinika to'liq ma'lumot
  - Filiallar ham
  
GET /api/clinics/[clinicId]/branches
  - Klinikaning barcha filiallari

GET /api/clinics/[clinicId]/services
  - Klinika xizmatlari (filial bo'yicha)

POST /api/ratings
  - Bemor bahosini saqlash
```

### Mavjud endpoint'lar o'zgartirilishi
```
GET /api/services?clinicId=X
  - clinicId filter qo'shiladi
  - Default: hammasi (super_admin uchun)

GET /api/doctors?clinicId=X&branchId=Y
  - clinicId + branchId filter

POST /api/book
  - clinicId va branchId majburiy bo'ladi
```

---

## 🤖 Bot/Webapp flow o'zgarishi

### 2.9. Bot session state
```
Hozir:
  state: { step: 'select_service', serviceId, doctorId, date }

Yangi:
  state: { 
    step: 'select_clinic',  // YANGI
    clinicId,
    branchId,               // YANGI
    serviceId, 
    doctorId, 
    date 
  }
```

### 2.10. Yangi qadamlar tartibi
```
1. select_clinic    (YANGI)
2. select_branch    (YANGI, agar > 1 filial)
3. select_service   (mavjud)
4. select_doctor    (mavjud)
5. select_date      (mavjud)
6. payment          (YANGI - to'lov bilan)
7. confirmation     (mavjud)
```

---

## 📋 Multi-clinic bosqichlari

### Bosqich 2.1 — DB poydevor (~1 soat)
- Yangi ustunlar (rating, city, hours)
- Test ma'lumotlar (2-3 ta sinov klinika)

### Bosqich 2.2 — Backend API (~2 soat)
- 5 ta yangi endpoint
- Mavjud endpoint'larga filter
- RLS sozlash (super_admin barcha klinika, clinic_admin faqat o'zi)

### Bosqich 2.3 — Webapp UI (~3 soat)
- Klinika tanlash sahifa
- Filial tanlash sahifa
- Klinika kartochka komponent
- Filter va qidiruv
- localStorage'da tanlovlar saqlash

### Bosqich 2.4 — Bot flow (~2 soat)
- Yangi qadamlar
- Inline tugmalar
- Klinika ro'yxati keyboard

### Bosqich 2.5 — Admin paneli (~1 soat)
- Klinika CRUD (super_admin uchun)
- Filiallar CRUD (clinic_admin uchun)
- Statistika klinika bo'yicha

### Bosqich 2.6 — Test (~1 soat)

**Jami:** ~10 soat ish

---

# 🧪 3. UY XIZMATI NATIJALARI

## 🎯 Strategik qarorlar

### 3.1. Maqsadli flow

```
1. Bemor "Uyda bemor ko'rish" bron qiladi (mavjud)
2. To'lov amalga oshiriladi (1-rejada)
3. Laborant bemorning uyiga boradi (mavjud — LiveLocation)
4. Laborant qon namunasini oladi (real life)
5. Laborant klinikaga qaytadi
6. Klinikada qon tahlil qilinadi
7. Natija tayyor bo'ladi (PDF/rasm)
8. Admin/laborant natijani Tibtaqvim'ga yuklaydi  ← YANGI
9. Bemor webapp'da natijani ko'radi  ← YANGI
10. Bemor natijani chop etadi yoki yuklab oladi  ← YANGI
11. Bemorga botga xabarnoma keladi  ← YANGI
```

### 3.2. Hozirgi mavjud holat (TEGMASLIK)
- ✅ Uyda bemor ko'rish xizmati mavjud (Uyda bemor ko'rish — 200,000 so'm)
- ✅ LiveLocation tizimi ishlaydi (shifokor real vaqtda qayerda)
- ✅ Manzil saqlanadi (address ustuni)

### 3.3. Yangi qo'shilishi kerak
- Natija fayl yuklash (PDF, JPG, PNG)
- Natija saqlash (Supabase Storage)
- Natija ko'rish (webapp)
- Natija yuklab olish/chop etish
- Telegram xabarnoma

---

## 🎨 UI MOKAP

### 3.4. Reception/Admin paneli — natija yuklash
```
┌──────────────────────────────────────┐
│  📋 Uyda bemor ko'rish bronlari      │
├──────────────────────────────────────┤
│                                       │
│  ┌────────────────────────────┐      │
│  │ tib000045                  │      │
│  │ Aliyev Vali                │      │
│  │ Qon tahlili (umumiy)       │      │
│  │ 📅 18-may, 2026            │      │
│  │ 📍 Mirobod, Amir Temur 12  │      │
│  │ ✅ Tahlil olingan           │      │
│  │ ─────────────────────      │      │
│  │ Natija holati: ⏳ Kutilmoqda│      │
│  │                            │      │
│  │ [📤 Natija yuklash]         │      │
│  └────────────────────────────┘      │
│                                       │
│  Yuklash modalida:                   │
│  ┌────────────────────────────┐      │
│  │  📤 Natija yuklash         │      │
│  │                            │      │
│  │  [📁 Fayl tanlash]          │      │
│  │  Fayllar: PDF, JPG, PNG     │      │
│  │  Maksimal hajm: 10 MB       │      │
│  │                            │      │
│  │  Izoh (ixtiyoriy):          │      │
│  │  ┌──────────────────────┐  │      │
│  │  │                      │  │      │
│  │  └──────────────────────┘  │      │
│  │                            │      │
│  │  [✓] Bemorga xabar yuborish│      │
│  │                            │      │
│  │  [Bekor]    [Yuklash]      │      │
│  └────────────────────────────┘      │
│                                       │
└──────────────────────────────────────┘
```

### 3.5. Webapp Profilim — natija ko'rish
```
┌──────────────────────────────────────┐
│  📋 Uyda bemor ko'rish                │
│  📅 18-may, 2026                     │
│  ─────────────────────────           │
│  📊 Natijalar:                       │
│                                       │
│  ┌────────────────────────────┐      │
│  │ 📄 qon-tahlili-2026-05-18.pdf │   │
│  │ 1.2 MB | 18-may, 16:45     │      │
│  │                            │      │
│  │ Izoh: Natijalar normal.     │      │
│  │ Shifokorga ko'rsatish kerak │      │
│  │                            │      │
│  │ [👁 Ko'rish]                │      │
│  │ [📥 Yuklab olish]           │      │
│  │ [🖨 Chop etish]             │      │
│  │ [📤 Ulashish]               │      │
│  └────────────────────────────┘      │
│                                       │
└──────────────────────────────────────┘
```

### 3.6. Webapp — natija ko'rish modal
```
┌──────────────────────────────────────┐
│  ← Orqaga    📄 qon-tahlili.pdf      │
├──────────────────────────────────────┤
│                                       │
│  ┌────────────────────────────┐      │
│  │                            │      │
│  │   [PDF preview]            │      │
│  │   (PDF.js orqali)          │      │
│  │                            │      │
│  │   1 / 3                    │      │
│  │                            │      │
│  └────────────────────────────┘      │
│                                       │
│  [⬅ Oldingi] [Keyingi ➡]              │
│                                       │
│  [📥 Yuklab olish]  [🖨 Chop etish]   │
│                                       │
└──────────────────────────────────────┘
```

### 3.7. Bot xabarnoma — natija tayyor
```
🧪 Tahlil natijasi tayyor!

📋 Bron: tib000045
📅 Olingan sana: 18-may, 2026
📊 Tahlil: Qon tahlili (umumiy)

📄 Natija fayli yuklandi:
qon-tahlili-2026-05-18.pdf (1.2 MB)

💬 Izoh:
Natijalar normal. Shifokorga ko'rsatish kerak.

[📥 Yuklab olish]
[👁 Webappda ko'rish]
[📞 Shifokor bilan bog'lanish]
```

---

## 🗄 DB o'zgarishlari

### 3.8. Yangi jadval — appointment_results
```sql
CREATE TABLE appointment_results (
  id TEXT PRIMARY KEY,
  "appointmentId" TEXT NOT NULL REFERENCES appointments(id),
  "uploadedBy" TEXT REFERENCES users(id),  -- laborant/admin
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,  -- Supabase Storage path
  "fileSize" INT,            -- bytes
  "mimeType" TEXT,           -- application/pdf, image/jpeg, etc.
  "comment" TEXT,            -- laborant izohi
  "notifiedAt" TIMESTAMP,    -- bemorga xabar yuborilgan vaqt
  "viewedAt" TIMESTAMP,      -- bemor ko'rgan vaqt
  "downloadedAt" TIMESTAMP,  -- bemor yuklab olgan vaqt
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "deletedAt" TIMESTAMP      -- soft delete
);

-- RLS:
-- - super_admin/clinic_admin/receptionist: hammasini ko'rishi
-- - doctor: o'z bemorlarining natijalarini
-- - patient: faqat o'z natijalarini
ALTER TABLE appointment_results ENABLE ROW LEVEL SECURITY;
```

### 3.9. Supabase Storage
```
Bucket: appointment-results
  - Private bucket
  - 50 MB fayllar uchun
  - PDF, JPG, PNG, DOC, DOCX
  - Signed URL bilan kirish (1 soat TTL)
  - RLS: faqat tegishli foydalanuvchi
```

---

## 🔧 Backend endpoint'lar

### 3.10. Yangi endpoint'lar
```
POST /api/results/upload
  - Multipart form data
  - appointmentId, file, comment
  - Faqat receptionist/admin/doctor
  - Supabase Storage'ga yuklaydi
  - DB'ga yozadi
  - Bemorga bot xabarnoma yuboradi

GET /api/results/[appointmentId]
  - Bron natijalari ro'yxati
  - Faqat tegishli foydalanuvchi

GET /api/results/file/[resultId]
  - Signed URL qaytaradi (1 soat TTL)
  - View/download tracking

DELETE /api/results/[resultId]
  - Soft delete (faqat admin)

POST /api/results/[resultId]/notify
  - Bemorga qayta xabarnoma yuborish
```

---

## 🎨 Texnik xususiyatlar

### 3.11. Fayl yuklash
- **Frontend:** Drag-drop yoki tugma orqali
- **Validation:**
  - Format: PDF, JPG, PNG, DOC, DOCX
  - Hajm: max 10 MB (admin moslashtirishi mumkin)
  - Antivirus skan (Supabase autoscan)
- **Progress bar** yuklash paytida
- **Cancel** tugmasi

### 3.12. PDF preview
- `react-pdf` paketi
- Pages navigation
- Zoom in/out
- Mobile responsive
- Print tugmasi (browser print API)

### 3.13. Image preview
- Lightbox style
- Pinch-to-zoom (mobile)
- Rotate
- Download tugmasi

### 3.14. Telegram xabarnoma
- Bron egasi (userId orqali topiladi)
- Inline tugmalar: "Yuklab olish", "Webapp'da ko'rish"
- Fayl 50 MB dan kichik bo'lsa, **fayl o'zi botda yuboriladi**
- Aks holda, faqat havola

---

## 📋 Uy xizmati natijalari — bosqichlar

### Bosqich 3.1 — Storage + DB (~1 soat)
- Supabase Storage bucket
- appointment_results jadval
- RLS sozlash

### Bosqich 3.2 — Upload API (~2 soat)
- Multipart form
- Validation
- Storage integratsiya
- Audit log

### Bosqich 3.3 — Admin UI (~2 soat)
- Bron kartochkasida "Natija yuklash" tugma
- Upload modal
- Progress bar
- Preview

### Bosqich 3.4 — Webapp UI (~2 soat)
- Profilim natijalar ro'yxati
- PDF preview
- Image preview
- Download/Print

### Bosqich 3.5 — Bot xabarnoma (~1 soat)
- Natija tayyor xabari
- Fayl yuborish (kichik bo'lsa)
- Inline tugmalar

### Bosqich 3.6 — Test (~1 soat)

**Jami:** ~9 soat ish

---

# 🗺 UMUMIY ROADMAP

| # | Vazifa | Vaqt | Prioritet |
|---|---|---|---|
| 1 | To'lov tizimi (Click/Payme) | 10 soat | ⭐⭐⭐ |
| 2 | Multi-clinic tanlash | 10 soat | ⭐⭐ |
| 3 | Uy xizmati natijalari | 9 soat | ⭐⭐ |
| 4 | Doctor /stats grafiklar (3 ta) | 4 soat | ⭐ |
| 5 | Bosqich 2 — Slot tizimi | 5 soat | ⭐ |

**Jami: ~38 soat = 5-6 ish kuni**

---

# ⚠️ MUHIM ESLATMALAR

## Tegmasligi kerak narsalar
- ✅ 6 ta admin KPI grafik (yangi)
- ✅ Doctor date picker
- ✅ Specialty dropdown
- ✅ Service-Doctor M2M
- ✅ queueMode (live/online/slot-disabled)
- ✅ requiresSlot UI (yashirilgan)
- ✅ Cookie+JWT 24h auth
- ✅ RLS 16/16
- ✅ Audit log
- ✅ Telegram webhook secret
- ✅ Eski xizmatlar (Terapevt, Kardiolog, EKG, Qon tahlili, Uy xizmat, MRT, Mskt, Ortoped, Nevropatolog)

## Qadamlar tartibi (tavsiya)
1. **Avval to'lov** — bemor uchun eng muhim, ko'p talab
2. **Keyin multi-clinic** — ekspansiya uchun
3. **Keyin natijalar** — uy xizmati qiymatini oshirish
4. **Keyin doctor grafiklar** — kichik qo'shimcha
5. **Keyin slot tizimi** — diagnostika uchun

## Vaqt strategiyasi
- Har vazifa **alohida prompt** sifatida tayyorlanadi (MD format)
- Har prompt **diagnostikadan** boshlaydi
- Har bosqichdan keyin tasdiq olinadi
- Build error nol bo'lishi shart
- Production deploy READY bo'lishi shart

---

# 📞 ALOQA UCHUN KEYINGI MARTA

Yangi suhbat boshlanganda, shu MD faylni yuborib:
```
Tibtaqvim loyihasini davom ettiramiz.
Ushbu MD fayl — kelajak rejalar.
[mazmuni]

Hozir [TO'LOV / MULTI-CLINIC / NATIJALAR] dan boshlamoqchiman.
```

Yoki shunchaki ayting:
```
"Tibtaqvim — to'lov tizimi (Click/Payme) ulashni boshlaymiz"
```

Men memory orqali kontekstni eslayman, MD prompt yozaman.

---

**Saqlangan sana:** 17-may, 2026, 12:00  
**Status:** Tasdiqlangan, kelajakda amalga oshirilishi kutilmoqda
