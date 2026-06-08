# TASK: SERVICE-PICKER-01 — Xizmat tanlash ekranini YAGONA rasmli versiyaga birlashtirish

## MUAMMO (rasmlardan + DB'dan tasdiqlangan)
Webapp "Qabulga yozilish → Xizmatni tanlang" ekrani IKKI XIL versiyada render bo'lyapti:

- **Versiya A (eski, RASMSIZ)** — faqat xizmat nomi + narx + joy soni. Shifokor ko'rinmaydi.
- **Versiya B (yangi, RASMLI, TO'G'RI)** — har xizmat ostida unga biriktirilgan shifokor(lar): yumaloq avatar (photoUrl yoki fallback) + "Xizmat — Shifokor F.I." ko'rinishi.

Versiya B FAQAT bitta yo'lda chiqadi: kartochkadagi "Qayta bron" → keyin "← ortga qaytish". Boshqa HAMMA yo'lda (asosiy "+ Yangi bron", klinika tanlash, to'g'ridan-to'g'ri kirish) eski rasmsiz Versiya A chiqadi.

## SABAB
Klassik "kod ikki nusxa" muammosi: xizmat tanlash ro'yxati ikki xil joyda/komponentda yozilgan. Biri (rasmli) yangilangan, ikkinchisi (rasmsiz) eski holatda qolgan. DB to'liq tayyor — service_doctors M2M orqali xizmatlarga shifokor biriktirilgan, deyarli hammasida photoUrl bor (ba'zida yo'q → fallback avatar kerak).

## TALAB (foydalanuvchi aniq aytdi)
Xizmat tanlash QAYERDA ko'rsatilsa ham — yangi bron, qayta bron, ortga qaytish, har qanday navigatsiya yo'li — AYNAN rasmli (Versiya B) ko'rinishi SHART. Eski rasmsiz versiya BUTUNLAY o'chirilsin. Bitta komponent, hamma joyda. Kelajakdagi yangi klinika/xizmat/shifokor ham avtomatik rasmli chiqsin.

---

## YECHIM — ANIQ KO'RSATMALAR

### 1. Ikkala versiyani top
`src/app/webapp/` ichida xizmat tanlash ro'yxati render bo'ladigan JOYLARNI top. Ehtimol:
- Asosiy bron oqimi (masalan `webapp/clinics/[id]/page.tsx` yoki `webapp/book/...` yoki page.tsx ichidagi qadam)
- Qayta bron oqimi (rebook flow) — bu yerda RASMLI versiya bor

Grep bilan qidir: "Xizmatni tanlang", service.map, narx/price render qiladigan bloklar. Ikkala render joyini aniqla.

### 2. Rasmli versiyani (Versiya B) reusable komponentga ajrat
Agar hali alohida komponent bo'lmasa yarat: `src/components/webapp/ServicePicker.tsx` (yoki ServiceList + ServiceCard).

Komponent har xizmat uchun ko'rsatadi:
- Xizmat ikonка (tur bo'yicha: 🔬 Diagnostika, 👨‍⚕️ Shifokor navbati emoji yoki mavjud ikonка)
- Xizmat nomi + turi (kichik kulrang)
- Narx + joy soni (o'ng tomonda)
- **Ostida: biriktirilgan shifokor(lar)** — har biri:
  - Yumaloq avatar: `doctor.photoUrl` BOR bo'lsa rasm; YO'Q bo'lsa fallback (ism bosh harfi yoki 👨‍⚕️ ikonка doira ichida — rasm 2'dagi "I" li ko'k doira kabi)
  - "Xizmat nomi — Shifokor Ism Familiya" matni
  - Bir nechta shifokor bo'lsa hammasi ro'yxat bo'lib chiqadi (Mskt'da 2 ta, Nevropatolog'da 2 ta — DB'da bor)

### 3. HAMMA render joyini ServicePicker'ga almashtir
Topilgan ikkala (yoki undan ko'p) joyni `<ServicePicker services={...} onSelect={...} />` ga almashtir. Eski rasmsiz inline JSX'ni BUTUNLAY O'CHIR.

Diqqat: onSelect callback har joyda to'g'ri ishlashi kerak (yangi bron'da xizmat tanlash → keyingi qadam; qayta bron'da → rebook). Komponent faqat KO'RINISH, harakat (onSelect) prop orqali.

### 4. API tekshir — shifokor ma'lumoti keladimi
Xizmat ro'yxatini qaytaradigan API (ehtimol `/api/webapp/services` yoki `/api/services?clinicId=&branchId=`) har xizmat bilan birga biriktirilgan shifokorlarni (id, firstName, lastName, photoUrl) qaytarishi kerak.
- Agar RASMLI versiya allaqachon shu API'dan to'g'ri olsa — demak API to'g'ri, faqat eski versiya uni ishlatmayapti. U holda eski versiyani komponentga almashtirish yetadi.
- Agar eski versiya BOSHQA (kambag'al) API'dan olsa — hamma joy bitta to'liq API'dan olsin (service_doctors include doctor: {id, firstName, lastName, photoUrl, specialty}).
- Maxfiy ma'lumot (telefon, parol) BERILMASIN — faqat public: ism, familiya, photoUrl, specialty.

### 5. Fallback avatar (photoUrl yo'q shifokorlar uchun)
DB'da ba'zi shifokorda photoUrl null (LOR — O'ktamov Ibrat, Uyda ko'rish — 1 shifokor). Ular uchun chiroyli fallback:
- Doira ichida ism bosh harfi (masalan "I" — rasm 2'da ko'rinadi) YOKI 👨‍⚕️ ikonка
- Rangli yumshoq fon (rasm 2'dagi ochiq ko'k kabi)
- HECH QACHON buzuq rasm yoki bo'sh joy ko'rsatmasin

---

## 0. MAJBURIY QOIDALAR
- Responsive (mobil birinchi — Telegram WebApp).
- `&apos;` ISHLATMA — to'g'ridan-to'g'ri `'`.
- BITTA komponent, HAMMA xizmat tanlash joyida. Kopya-paste mutlaqo bo'lmasin.
- DB'ga tegma (ma'lumot tayyor) — faqat frontend + kerak bo'lsa API include kengaytirish.

## TEKSHIRUV (deploydan oldin)
- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0
- GREP: webapp'da xizmat tanlash render qiladigan inline JSX qolmagan — faqat ServicePicker komponenti
- HAMMA yo'lda rasmli versiya: "+ Yangi bron", qayta bron, ortga qaytish — hammasi shifokor avatarli
- photoUrl yo'q shifokorlar fallback avatar ko'rsatadi (buzuq emas)
- Bir nechta shifokorli xizmat (Mskt, Nevropatolog) hamma shifokorni ko'rsatadi
- Mobil responsive

## YAKUNDA HISOBOT
- Xizmat tanlash nechta joyda render bo'lar edi, nechtasi ServicePicker'ga birlashtirildi
- O'chirilgan eski inline JSX'lar
- API o'zgardi mi (shifokor include qo'shildimi)
- Fallback avatar qanday ko'rinadi
- tsc/build + deploy commit hash
- GREP natijasi: yagona komponent ishlatilishini tasdiqla

## ESLATMA — NEGA MUHIM
Bu flip card bilan bir xil naqsh: bir funksiya ikki joyda, biri yangilangan biri eski. Bu safar TO'LIQ birlashtir — xizmat tanlash webapp'ning eng muhim ekrani (bemor shu yerdan bron qiladi). Bitta poydevor komponent — hamma klinika, hamma yo'l, kelajakdagilar ham rasmli.

## KEYINGI (HOZIR EMAS)
1. Sahifa sekinligi optimizatsiya (preload tahlili)
2. Bron qabul qilish (shifokor paneli)
3. Shifokor ID tizimi (EM000001)
