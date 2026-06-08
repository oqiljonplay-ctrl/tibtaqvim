# TASK: CLINIC-CURRENT-02 — Tanlangan klinika baribir saqlanmayapti (frontend tuzatish)

## VAZIYAT
CLINIC-CURRENT-01 da DB tomoni TO'G'RI bajarildi:
- `isCurrent` va `lastSelectedAt` ustunlari DB'da bor ✅
- Partial unique index ishlamoqda ✅
- Foydalanuvchi "Tanlash" bosganda DB'ga to'g'ri yoziladi ✅ (tekshirildi: telegramId=986660442 ning Test klinikasi isCurrent=true, lastSelectedAt=18:24:06)

LEKIN webapp baribir **eski klinikani** (BUYUK TABIB) ko'rsatyapti. Demak frontend `isCurrent` ni O'QIMAYAPTI yoki uni biror narsa override qilyapti.

## KRITIK XATO — TEST NOTO'G'RI USER BILAN QILINGAN
CLINIC-CURRENT-01 hisobotida test `tgid=1864788322` bilan qilingan. Lekin foydalanuvchining haqiqiy Telegram ID `986660442` (telefon +998997076233). 1864788322 — eski test akkaunt, BUYUK TABIB'da turibdi. Shuning uchun hisobot "ishlayapti" deb noto'g'ri xulosa berdi.

**HOZIR DBdagi haqiqiy holat (986660442 user):**
- Test klinika: `isCurrent=true`, `lastSelectedAt=2026-05-28 18:24:06`
- BUYUK TABIB: `isCurrent=false`

Foydalanuvchi botdan qayta kirgach baribir BUYUK TABIB ko'rinmoqda — DEMAK FRONTEND DB'NI ESHITMAYAPTI.

---

## SHUBHALI SABAB — Bot deeplink override qilmoqda

Avvalgi promptда yozilgan edi: "Bot deeplink prioritetli — agar URL'da ?clinic=... bo'lsa, uni isCurrent qilib belgila". Bu yondashuv NOTO'G'RI bo'lib chiqdi:
- BUYUK TABIB ning Telegram boti HAR DOIM `?clinic=clinic-demo` yuboradi (bu bot shu klinika uchun)
- Bemor Test klinikani tanlasa ham — keyingi kirishda yana bot URL'i kelib, isCurrent ni BUYUK TABIB'ga qaytaryapti
- Natija: bemor ANIQ tanlagan klinika YO'QOLADI

## YANGI MANTIQ — BEMOR O'ZINING TANLOVI ULSTUN

### initClinic() mantiqi (src/lib/clinic-context.tsx):

```
1. DB'dan currentClinicId ni ol (GET /api/me/clinics → isCurrent=true bo'lganini qaytaradi)

2. AGAR DB'da isCurrent=true topilsa (bemor avval tanlagan):
   → SHUNI ishlat (BOSH QOIDA: bemor tanlovi ustun)
   → Bot URL'idagi ?clinic=... PARAMETRINI E'TIBORGA OLMA
   → Faqat istisno: agar URL clinic = DB current clinic bo'lsa, hech narsa qilma

3. AGAR DB'da isCurrent=true YO'Q bo'lsa (yangi user, hech qachon tanlamagan):
   → Bot deeplink ?clinic=... bor bo'lsa — shuni ishlat va DB'ga yoz (persistToDb)
   → Bot URL yo'q bo'lsa — birinchi membership clinic ni default qil va DB'ga yoz
   → Hech qanday membership yo'q bo'lsa — "Klinika tanlang" sahifasiga yo'naltir

4. AGAR foydalanuvchi "Mening klinikalarim" → "Tanlash" bossa:
   → POST /api/webapp/clinics/[id]/select chaqir
   → Transaction: eski isCurrent=false, yangisi isCurrent=true, lastSelectedAt=now
   → Sahifani yangila (yoki context state'ni)
```

### MUHIM: hech qaysi joyda localStorage YOKI users.clinicId default ni isCurrent dan ustun qilma
- `users.clinicId` — bu bemor uchun "registratsiya klinikasi" (default), lekin AKTIV TANLOV emas
- localStorage agar ishlatilsa — DB bilan sinxron bo'lsin, lekin DB asosiy haqiqat manbai

---

## TEKSHIRISH KERAK BO'LGAN FAYLLAR

1. **`src/lib/clinic-context.tsx`** — `initClinic()` mantiqi:
   - Bot URL paramini qachon ishlatadi?
   - DB'dan o'qib isCurrent ni ustun qo'yadimi?
   - localStorage ishlatadimi? Agar ha — DB bilan ziddiyatda kim g'olib?

2. **`src/app/api/me/clinics/route.ts`** — currentClinicId qanday hisoblanadi?
   - `findFirst({ where: { userId, isCurrent: true } })` ishlatiladimi?
   - Yoki users.clinicId ni qaytaryapti?

3. **Webapp layout / bosh page** — context qachon init bo'ladi?
   - URL paramini qachon o'qiydi?

4. **Bot deeplink generator** (agar bor bo'lsa) — har xabarga `?clinic=` qo'shiladimi?

---

## TUZATISH KETMA-KETLIGI

### Step 1: DIAGNOSTIK — currentClinicId API tekshiruvi
GET /api/me/clinics?tgid=986660442 (haqiqiy user) ni chaqir va javobni ko'r:
- Agar `currentClinicId: "cmpay6dn8..."` (Test klinika) qaytarsa → API to'g'ri, muammo frontend'da
- Agar `currentClinicId: "clinic-demo"` (BUYUK TABIB) qaytarsa → API noto'g'ri, isCurrent o'qilmayapti

### Step 2: Frontend `initClinic` qaytarish tartibini tuzatish

Yangi tartib (KUCHLI prioritet):
```typescript
async function initClinic() {
  // 1. DB'dan o'qi
  const { currentClinicId, clinics } = await fetch('/api/me/clinics').then(r => r.json());
  const urlClinic = new URLSearchParams(window.location.search).get('clinic');

  // 2. BEMOR TANLOVI USTUN
  if (currentClinicId) {
    // Bemor avval tanlagan — uni ishlat
    setActiveClinicId(currentClinicId);

    // URL'da boshqa klinika bor — LEKIN bu odatda bot default deeplink
    // Faqat agar URL clinic membership'da bor VA u currentClinicId DAN BOSHQA
    // bo'lsa, bu intentional almashtirish demak — lekin bunga ham ehtiyot bo'l
    // (chunki har bot xabarida ?clinic= bo'ladi)
    //
    // QOIDA: URL paramni FAQAT bemor "klinika tanlash" intent qilganda ishlat
    // (masalan /webapp/clinics/[id] sahifasida — u yerda foydalanuvchi ongli)
    // BOSH webapp /webapp da URL paramni E'TIBORGA OLMA
    return;
  }

  // 3. DB'da hech narsa yo'q (yangi user)
  if (urlClinic && clinics.find(c => c.id === urlClinic)) {
    // Bot deeplink bor va u membership'da — uni aktiv qil
    await persistToDb(urlClinic);
    setActiveClinicId(urlClinic);
    return;
  }

  // 4. Birinchi membership default
  if (clinics.length > 0) {
    await persistToDb(clinics[0].id);
    setActiveClinicId(clinics[0].id);
    return;
  }

  // 5. Hech narsa yo'q — klinika tanlash sahifasiga
  router.push('/webapp/clinics');
}
```

### Step 3: localStorage tozalash (agar ishlatilgan bo'lsa)
Agar oldin localStorage'da activeClinicId saqlangan bo'lsa, eski qiymat DB ni override qilishi mumkin. Boshlanish nuqtasida:
- Agar localStorage'dagi qiymat ≠ DB currentClinicId → DB'ni ustun qo'y, localStorage'ni yangila
- Yoki localStorage'ni umuman olib tashla (DB asosiy manba)

### Step 4: API tekshiruvi
`GET /api/me/clinics?tgid=986660442` aniq Test klinika ni `currentClinicId` qilib qaytarsin. Test:
```bash
curl 'https://tibtaqvim.vercel.app/api/me/clinics?tgid=986660442'
```
Javob: `{ "currentClinicId": "cmpay6dn80002l504rr8qez3t", ... }` (Test klinika ID)

Agar boshqa qaytarsa — API kodini tekshir, `findFirst({where: {userId, isCurrent: true}})` borligini tasdiqla.

---

## TEKSHIRUV (deploydan oldin)

REAL USER bilan test (986660442 — telefon +998997076233):
1. `/api/me/clinics?tgid=986660442` → `currentClinicId` Test klinika ID ni qaytarmoqda ✅
2. Webapp ochiladi (bot orqali, deeplink bilan) → **Test klinika** ko'rinadi ✅
3. Botdan chiq, qayta kir → **HALI HAM Test klinika** ✅
4. Brauzer kesh tozalansa ham — DB'dan o'qiladi ✅
5. "Mening klinikalarim" → BUYUK TABIB tanla → endi BUYUK TABIB ko'rinadi
6. Yana botdan kir → **HALI HAM BUYUK TABIB** (bemor tanlovi ustun)

## YAKUNDA HISOBOT
1. Diagnostik natijasi: GET /api/me/clinics?tgid=986660442 nima qaytardi?
2. Frontend qaysi faylda nima o'zgartirildi (clinic-context.tsx, layout, page.tsx)?
3. Bot deeplink mantiqi qanday o'zgardi (endi qachon ustun, qachon emas)?
4. localStorage holati (ishlatildi yoki olib tashlandi)?
5. 6 ta test stsenariy natijasi (yuqorida) — **HAR BIRINI HAQIQIY 986660442 USER bilan test qil**, 1864788322 NI ISHLATMA
6. tsc/build/deploy + commit hash

## ⚠️ KRITIK ESLATMA
Avvalgi hisobotda noto'g'ri user (1864788322) bilan test qilingan. BU SAFAR — har test stsenariyni HAQIQIY foydalanuvchi (986660442, telefon +998997076233, ism "SAYFIYEV OQILJON OBID o'g'li") bilan qil. Ehtimol bu sizning shaxsiy Telegram'ingiz emas — VS Code Claude'ning test akkaunti — shuning uchun foydalanuvchi shaxsiy qurilmasida test qilishini kut yoki API darajasida tekshir.

API testlash: curl yoki Postman bilan `GET /api/me/clinics?tgid=986660442` chaqirib, javobni hisobotda ko'rsat.

## NEGA BU MUHIM
Foydalanuvchi 3 marotaba bir narsani aytdi: "tanlangan klinika saqlanmayapti". Hisobotda "ishlayapti" yozildi, lekin amaliyotda ishlamadi. Bu yo'l qabul qilinmaydi — REAL FOYDALANUVCHI MA'LUMOTI bilan test qilish va tasdiqlash SHART.
