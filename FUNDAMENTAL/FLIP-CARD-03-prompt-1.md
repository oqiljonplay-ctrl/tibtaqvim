# TASK: FLIP-CARD-03 — Flip'ni BARCHA bron bo'limlariga qo'llash + butun karta bosiladigan qilish

## KONTEKST
FLIP-CARD-02'da `src/components/webapp/BookingFlipCard.tsx` yaratildi va ishlayapti.
Deploy: 983907a. Backend + bo'sh holat placeholder OK.

## ANIQLANGAN 2 MUAMMO (rasmlardan tasdiqlangan)

### MUAMMO 1: Flip faqat AYRIM kartochkalarda ishlaydi
`src/app/webapp/page.tsx` da bir nechta bo'lim bor:
- 📍 BUGUNGI QABUL — ✅ flip ishlaydi (BookingFlipCard ishlatadi)
- ⏰ YAQINLASHAYOTGAN BRONLAR (navbat raqami #1 bilan) — ❌ FLIP YO'Q, ℹ️ tugma ko'rinmaydi
- 📋 TARIX — tekshirilmagan, ehtimol flip yo'q

SABAB: "YAQINLASHAYOTGAN BRONLAR" va boshqa bo'limlar HALI HAM eski inline JSX struktura bilan render bo'lyapti, `BookingFlipCard` komponentidan foydalanmayapti. FLIP-CARD-02 faqat bitta bo'limni komponentga o'tkazgan, qolganini emas.

**TALAB (foydalanuvchi aniq aytgan):** webapp'dagi HAMMA bron bo'limidagi HAMMA kartochka — bugungi, yaqinlashayotgan (navbat raqamli), tarix, va boshqa har qanday bo'lim — AYNAN BITTA `BookingFlipCard` komponentidan foydalanishi SHART. Hech qaysi bo'limda inline/kopya-paste kartochka QOLMASIN. Bu shuni anglatadi: kelajakda yangi klinika, yangi shifokor, yangi bron turi qo'shilsa ham AVTOMATIK flip ishlaydi.

### MUAMMO 2: Flip faqat ℹ️ tugmada — butun karta bosilishi kerak
Foydalanuvchi talabi: kartochkaning XOHLAGAN JOYINI (shifokor rasmi, ism, sana, bo'sh joy — hammasi) bosganda flip aylansin. FAQAT amal tugmalari (Kutilmoqda, Qayta bron, Bekor qilish) bundan MUSTASNO — ular bosilganda flip BO'LMASIN, o'z amalini bajarsin.

---

## YECHIM — ANIQ KO'RSATMALAR

### 1. page.tsx ni TO'LIQ audit qil
`src/app/webapp/page.tsx` ni och va HAMMA joyda bron kartochkasi render bo'ladigan joylarni top:
- Har bir `.map(...)` yoki bron ko'rsatadigan blok
- "YAQINLASHAYOTGAN", "TARIX", "BUGUNGI" va boshqa har qanday bo'lim
Har birini `<BookingFlipCard appointment={...} onRebook={...} onCancel={...} />` ga almashtir.

Agar bo'limlar bron obyektining strukturasi har xil bo'lsa (masalan yaqinlashayotgan'da queueNumber bor, tarix'da status="completed"), BookingFlipCard props'ini moslashuvchan qil — barcha holatlarni qabul qilsin (queueNumber optional, status har xil bo'lishi mumkin).

Eski inline kartochka JSX'lari (DoctorPhoto, status tugmalari, navbat raqami bloki) — agar BookingFlipCard tashqarisida qolgan bo'lsa — O'CHIR va komponent ichiga ko'chir.

### 2. BookingFlipCard — butun karta bosiladigan qilish

`src/components/webapp/BookingFlipCard.tsx` da:

```tsx
// OLD TOMON wrapper — butun yuza bosiladi
<div
  onClick={() => setFlipped(true)}
  className="cursor-pointer ..."
>
  {/* rasm, ism, sana, navbat raqami, ish vaqti — hammasi bosilsa flip */}

  {/* AMAL TUGMALARI — flip'ni TO'XTATADI */}
  <button
    onClick={(e) => { e.stopPropagation(); onCancel(appointment.id); }}
  >Bekor qilish</button>
  <button
    onClick={(e) => { e.stopPropagation(); onRebook(appointment.service.id); }}
  >Qayta bron</button>
  <button
    onClick={(e) => { e.stopPropagation(); /* kutilmoqda amali */ }}
  >Kutilmoqda</button>

  {/* ℹ️ tugma — ENDI SHART EMAS, lekin qoldirsa ham bo'ladi (ixtiyoriy, ko'rsatkich sifatida) */}
</div>
```

KRITIK qoidalar:
- Old tomon ENG TASHQI div'iga `onClick={() => setFlipped(true)}` — butun yuza (rasm ustida ham) flip qiladi.
- HAR BIR amal tugmasida `onClick={(e) => { e.stopPropagation(); ...asl amal... }}` — bu flip'ni to'xtatadi.
- Agar tugmalar `<a>` yoki ichki bosiladigan element bo'lsa, ularga ham stopPropagation.
- ℹ️ tugmani saqlash mumkin (foydalanuvchiga "bu karta aylanadi" ishorasi sifatida), lekin endi majburiy emas. Old tomonda kichik vizual ishora qoldir (masalan burchakda "🔄 aylantirish" matni yoki ikonка) — chunki butun karta bosilishi ko'rinmas funksiya, foydalanuvchi bilishi kerak.
- Orqa tomon: butun yuza bosilganda QAYTSIN (`onClick={() => setFlipped(false)}`) + "← orqaga" tugmasi ham qolsin. Orqa tomonda amal tugmasi yo'q, shuning uchun butun yuza qaytarish xavfsiz.

### 3. Hover/active feedback
Butun karta bosiladigan bo'lgani uchun foydalanuvchiga bildirish:
- Old tomonga `active:scale-[0.99] transition-transform` yoki yengil hover soyasi — bosilishi mumkinligini ko'rsatadi.
- cursor-pointer.

---

## 0. MAJBURIY QOIDALAR
- Responsive (mobil birinchi — webapp Telegram ichida).
- `&apos;` ISHLATMA — to'g'ridan-to'g'ri `'`.
- BITTA komponent, HAMMA bo'limda — kopya-paste mutlaqo bo'lmasin.
- DB'ga tegma (faqat frontend).

## TEKSHIRUV
- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0
- page.tsx da HECH QANDAY inline bron kartochkasi qolmagan (grep bilan tekshir: DoctorPhoto, navbat raqami JSX, status tugmalari — hammasi BookingFlipCard ichida)
- HAMMA bo'lim (bugungi, yaqinlashayotgan, tarix) flip qiladi
- Butun karta bosilganda flip (rasm ustida ham)
- Amal tugmalari (Bekor/Qayta bron/Kutilmoqda) bosilganda flip BO'LMAYDI, o'z amalini bajaradi
- Orqa tomon bosilganda yoki "← orqaga" bilan qaytadi

## YAKUNDA HISOBOT
- page.tsx da nechta bo'lim bor edi, nechtasi BookingFlipCard'ga o'tkazildi
- Qaysi inline JSX'lar o'chirildi
- Butun-karta-bosish qanday amalga oshirildi (stopPropagation tugmalar ro'yxati)
- tsc/build + deploy commit hash
- GREP natijasi: page.tsx da inline kartochka qolmaganini tasdiqla

## ESLATMA — NEGA BU MUHIM
Foydalanuvchi haqli e'tiroz bildirdi: "2 ta flip card uchun shuncha harakat qilibmizmi". Sabab — FLIP-CARD-02 komponentni yaratdi, lekin HAMMA bo'limga qo'llamadi. Bu safar TO'LIQ qo'lla — webapp'dagi har bir bron, har bir klinika, har bir shifokor, kelajakdagilar ham AVTOMATIK flip qilsin. Bu "poydevor" — bir marta to'g'ri qilinsa, qayta ishlamaymiz.

## KEYINGI (HOZIR EMAS)
1. Bron qabul qilish (shifokor paneli)
2. Shifokor ID (EM000001)


# TASK: FLIP-CARD-03 — Flip'ni BARCHA bron bo'limlariga qo'llash + butun karta bosiladigan qilish

## KONTEKST
FLIP-CARD-02'da `src/components/webapp/BookingFlipCard.tsx` yaratildi va ishlayapti.
Deploy: 983907a. Backend + bo'sh holat placeholder OK.

## ANIQLANGAN 2 MUAMMO (rasmlardan tasdiqlangan)

### MUAMMO 1: Flip faqat AYRIM kartochkalarda ishlaydi
`src/app/webapp/page.tsx` da bir nechta bo'lim bor:
- 📍 BUGUNGI QABUL — ✅ flip ishlaydi (BookingFlipCard ishlatadi)
- ⏰ YAQINLASHAYOTGAN BRONLAR (navbat raqami #1 bilan) — ❌ FLIP YO'Q, ℹ️ tugma ko'rinmaydi
- 📋 TARIX — tekshirilmagan, ehtimol flip yo'q

SABAB: "YAQINLASHAYOTGAN BRONLAR" va boshqa bo'limlar HALI HAM eski inline JSX struktura bilan render bo'lyapti, `BookingFlipCard` komponentidan foydalanmayapti. FLIP-CARD-02 faqat bitta bo'limni komponentga o'tkazgan, qolganini emas.

**TALAB (foydalanuvchi aniq aytgan):** webapp'dagi HAMMA bron bo'limidagi HAMMA kartochka — bugungi, yaqinlashayotgan (navbat raqamli), tarix, va boshqa har qanday bo'lim — AYNAN BITTA `BookingFlipCard` komponentidan foydalanishi SHART. Hech qaysi bo'limda inline/kopya-paste kartochka QOLMASIN. Bu shuni anglatadi: kelajakda yangi klinika, yangi shifokor, yangi bron turi qo'shilsa ham AVTOMATIK flip ishlaydi.

### MUAMMO 2: Flip faqat ℹ️ tugmada — butun karta bosilishi kerak
Foydalanuvchi talabi: kartochkaning XOHLAGAN JOYINI (shifokor rasmi, ism, sana, bo'sh joy — hammasi) bosganda flip aylansin. FAQAT amal tugmalari (Kutilmoqda, Qayta bron, Bekor qilish) bundan MUSTASNO.

### ⚠️ ENG MUHIM TALAB (foydalanuvchi qayta ta'kidladi):
Amal tugmasi (Kutilmoqda / Qayta bron / Bekor qilish) bosilganda:
- Flip MUTLAQO BO'LMASIN (karta aylanmasin)
- Tugmaning O'Z FUNKSIYASI ishlasin (bron bekor qilish, qayta bron oynasi, kutilmoqda holati)
- Bu ikkisi BIR VAQTDA to'g'ri ishlashi SHART — tugma bosilsa: flip yo'q + amal bor.

Bu eng oson buziladigan joy. Texnik talab: HAR BIR amal tugmasining onClick'ida BIRINCHI qator `e.stopPropagation()` bo'lsin, KEYIN asl amal chaqirilsin. stopPropagation flip trigger'ga (parent onClick) eventni yetkazmaydi, lekin tugmaning o'z amali baribir bajariladi. Agar tugma ichida yana ichki element (ikonка/span) bo'lsa, click o'sha ichki elementdan kelishi mumkin — shuning uchun stopPropagation tugmaning ENG TASHQI bosiladigan elementida bo'lsin. Test: har 3 tugmani alohida bosib, (a) karta aylanmasligini va (b) amal ishlashini tasdiqla.
({cardni oldi va orqa tomonida mavjud tugma va keyinchalik yangi tugma qo`shilganda ham flipcard bulmasdan tugmalar bosilishi va ishlashi funksiyasini bakara olishi kerak. bu juda muhim!!!})
---

## YECHIM — ANIQ KO'RSATMALAR

### 1. page.tsx ni TO'LIQ audit qil
`src/app/webapp/page.tsx` ni och va HAMMA joyda bron kartochkasi render bo'ladigan joylarni top:
- Har bir `.map(...)` yoki bron ko'rsatadigan blok
- "YAQINLASHAYOTGAN", "TARIX", "BUGUNGI" va boshqa har qanday bo'lim
Har birini `<BookingFlipCard appointment={...} onRebook={...} onCancel={...} />` ga almashtir.

Agar bo'limlar bron obyektining strukturasi har xil bo'lsa (masalan yaqinlashayotgan'da queueNumber bor, tarix'da status="completed"), BookingFlipCard props'ini moslashuvchan qil — barcha holatlarni qabul qilsin (queueNumber optional, status har xil bo'lishi mumkin).

Eski inline kartochka JSX'lari (DoctorPhoto, status tugmalari, navbat raqami bloki) — agar BookingFlipCard tashqarisida qolgan bo'lsa — O'CHIR va komponent ichiga ko'chir.

### 2. BookingFlipCard — butun karta bosiladigan qilish

`src/components/webapp/BookingFlipCard.tsx` da:

```tsx
// OLD TOMON wrapper — butun yuza bosiladi
<div
  onClick={() => setFlipped(true)}
  className="cursor-pointer ..."
>
  {/* rasm, ism, sana, navbat raqami, ish vaqti — hammasi bosilsa flip */}

  {/* AMAL TUGMALARI — flip'ni TO'XTATADI */}
  <button
    onClick={(e) => { e.stopPropagation(); onCancel(appointment.id); }}
  >Bekor qilish</button>
  <button
    onClick={(e) => { e.stopPropagation(); onRebook(appointment.service.id); }}
  >Qayta bron</button>
  <button
    onClick={(e) => { e.stopPropagation(); /* kutilmoqda amali */ }}
  >Kutilmoqda</button>

  {/* ℹ️ tugma — ENDI SHART EMAS, lekin qoldirsa ham bo'ladi (ixtiyoriy, ko'rsatkich sifatida) */}
</div>
```

KRITIK qoidalar:
- Old tomon ENG TASHQI div'iga `onClick={() => setFlipped(true)}` — butun yuza (rasm ustida ham) flip qiladi.
- HAR BIR amal tugmasida `onClick={(e) => { e.stopPropagation(); ...asl amal... }}` — bu flip'ni to'xtatadi.
- Agar tugmalar `<a>` yoki ichki bosiladigan element bo'lsa, ularga ham stopPropagation.
- ℹ️ tugmani saqlash mumkin (foydalanuvchiga "bu karta aylanadi" ishorasi sifatida), lekin endi majburiy emas. Old tomonda kichik vizual ishora qoldir (masalan burchakda "🔄 aylantirish" matni yoki ikonка) — chunki butun karta bosilishi ko'rinmas funksiya, foydalanuvchi bilishi kerak.
- Orqa tomon: butun yuza bosilganda QAYTSIN (`onClick={() => setFlipped(false)}`) + "← orqaga" tugmasi ham qolsin. Orqa tomonda amal tugmasi yo'q, shuning uchun butun yuza qaytarish xavfsiz.

### 3. Hover/active feedback
Butun karta bosiladigan bo'lgani uchun foydalanuvchiga bildirish:
- Old tomonga `active:scale-[0.99] transition-transform` yoki yengil hover soyasi — bosilishi mumkinligini ko'rsatadi.
- cursor-pointer.

---

## 0. MAJBURIY QOIDALAR
- Responsive (mobil birinchi — webapp Telegram ichida).
- `&apos;` ISHLATMA — to'g'ridan-to'g'ri `'`.
- BITTA komponent, HAMMA bo'limda — kopya-paste mutlaqo bo'lmasin.
- DB'ga tegma (faqat frontend).

## TEKSHIRUV
- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0
- page.tsx da HECH QANDAY inline bron kartochkasi qolmagan (grep bilan tekshir: DoctorPhoto, navbat raqami JSX, status tugmalari — hammasi BookingFlipCard ichida)
- HAMMA bo'lim (bugungi, yaqinlashayotgan, tarix) flip qiladi
- Butun karta bosilganda flip (rasm ustida ham)
- ⚠️ Amal tugmalari (Bekor/Qayta bron/Kutilmoqda) bosilganda: flip BO'LMAYDI VA tugma o'z funksiyasini bajaradi (ikkalasi bir vaqtda to'g'ri) — har 3 tugmani alohida test qil
- Orqa tomon bosilganda yoki "← orqaga" bilan qaytadi

## YAKUNDA HISOBOT
- page.tsx da nechta bo'lim bor edi, nechtasi BookingFlipCard'ga o'tkazildi
- Qaysi inline JSX'lar o'chirildi
- Butun-karta-bosish qanday amalga oshirildi (stopPropagation tugmalar ro'yxati)
- tsc/build + deploy commit hash
- GREP natijasi: page.tsx da inline kartochka qolmaganini tasdiqla

## ESLATMA — NEGA BU MUHIM
Foydalanuvchi haqli e'tiroz bildirdi: "2 ta flip card uchun shuncha harakat qilibmizmi". Sabab — FLIP-CARD-02 komponentni yaratdi, lekin HAMMA bo'limga qo'llamadi. Bu safar TO'LIQ qo'lla — webapp'dagi har bir bron, har bir klinika, har bir shifokor, kelajakdagilar ham AVTOMATIK flip qilsin. Bu "poydevor" — bir marta to'g'ri qilinsa, qayta ishlamaymiz.

## KEYINGI (HOZIR EMAS)
1. Bron qabul qilish (shifokor paneli)
2. Shifokor ID (EM000001)
