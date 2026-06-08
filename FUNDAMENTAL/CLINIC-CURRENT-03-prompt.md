# TASK: CLINIC-CURRENT-03 — Yakuniy tuzatish (3 aniq xato)

## CONTEXT — CLINIC-DIAGNOSE-01 natijasi
Tashxis to'liq qilindi va 3 ta aniq xato topildi. Bu prompt o'sha 3 xatoni hal qiladi. Ortiqcha refactoring yo'q, faqat aniq nishonga uradigan tuzatishlar.

DB tomonida hammasi to'g'ri:
- User 986660442 ning DB holati: Test klinika isCurrent=true (lastSelectedAt 01:14:19), BUYUK TABIB isCurrent=false (01:14:07)
- API to'g'ri ishlaydi
- "Tanlash" tugmasi to'g'ri yozadi

Lekin webapp DB ni o'qiy olmayapti — chunki tgId webapp ichida yo'qoladi. Bu asosiy sabab.

---

## XATO 1 (ASOSIY) — tgId webapp ichida yo'qoladi

**Hozirgi holat (`src/lib/clinic-context.tsx` line 38-45):**
```typescript
function getTgId(): string | null {
  return (
    sessionStorage.getItem('tgid') ||
    new URLSearchParams(window.location.search).get('tgid') ||
    null
  )
}
```

**Muammo:** `sessionStorage.setItem('tgid', ...)` kod HECH QAYERDA YO'Q. Ya'ni sessionStorage hech qachon to'lmaydi. tgId faqat URL'da bor — lekin webapp ichida sahifa o'zgarsa (router push, URL clean) tgId yo'qoladi, getTgId() null qaytaradi, DB o'qilmaydi.

**Tuzatish:**
initClinic boshida (yoki ClinicProvider boshlanish nuqtasida), AGAR URL'da `?tgid=` bo'lsa — uni darhol sessionStorage'ga yoz:

```typescript
function captureTgId(): void {
  if (typeof window === 'undefined') return;
  const urlTgId = new URLSearchParams(window.location.search).get('tgid');
  if (urlTgId) {
    sessionStorage.setItem('tgid', urlTgId);
  }
  // Telegram WebApp API'dan ham olishga harakat qil (fallback):
  const tgWebApp = (window as any).Telegram?.WebApp;
  if (tgWebApp?.initDataUnsafe?.user?.id && !sessionStorage.getItem('tgid')) {
    sessionStorage.setItem('tgid', String(tgWebApp.initDataUnsafe.user.id));
  }
}
```

Bu funksiyani ClinicProvider'ning useEffect'i boshida (initClinic chaqirilishidan oldin) chaqir. Shu bilan tgId BIRINCHI URL'da kelganda sessionStorage'ga yoziladi va keyingi har qanday sahifa o'tishida saqlanib qoladi.

---

## XATO 2 — URL sync `tgid` ni o'chirmasin

**Hozirgi holat (`src/lib/clinic-context.tsx` line 193-203):**
URL sync effect `clinicId` parametrini o'chirib `clinic` ga almashtiradi. Lekin bu jarayonda `tgid` parametri ham yo'qolishi mumkin (yoki butun URL search yangilanyapti).

**Tuzatish:**
URL sync effect'da FAQAT `clinic`/`clinicId` parametrlarini o'zgartir. `tgid`, `mode` va boshqa parametrlarni TEGMA:

```typescript
useEffect(() => {
  if (!clinic) return;
  const url = new URL(window.location.href);
  // Faqat clinic-related paramni yangila:
  url.searchParams.delete('clinicId');  // eski nom
  url.searchParams.set('clinic', clinic.id);
  // tgid, mode va boshqalarga TEGMA — ular o'z holida qoladi
  window.history.replaceState({}, '', url.toString());
}, [clinic?.id]);
```

YOKI yanada xavfsizroq variant: URL sync'ni butunlay olib tashlash. URL'da `clinic` parametr bo'lishi shart emas, chunki haqiqat DB'da. URL parametr faqat ANIQ ma'lumotlash uchun kerak (debug, sharelash) — lekin asosiy manba DB. Agar URL sync olib tashlansa, hech qanday parametr xatosi bo'lmaydi.

**Tavsiya: URL sync'ni butunlay OLIB TASHLA.** DB asosiy manba. URL faqat boshlang'ich kirish nuqtasi.

---

## XATO 3 — DB poisoning xavfini yo'q qilish

**Hozirgi holat (`src/lib/clinic-context.tsx` line 114-126):**
Agar `/api/me/clinics` chaqirig'i `currentClinicId=null` qaytarsa (yoki exception bo'lsa), URL'dagi `clinicId=clinic-demo` ni olib `persistToDb()` chaqiriladi → DB'ga BUYUK TABIB yoziladi.

Bu xavfli, chunki:
- Birinchi marta bot deeplink bilan kirgan user — OK (yangi user, default klinika kerak)
- LEKIN agar API timeout/exception bersa, mavjud user uchun ham URL'dagi clinicId DB'ga yozilib, bemor TANLOVI o'chiriladi

**Tuzatish:**
persistToDb FAQAT ikki holatda chaqirilsin:
1. Foydalanuvchi "Mening klinikalarim" → "Tanlash" tugmasini bossa (intentional)
2. YANGI user (hech qachon membership'i yo'q) — birinchi marta default belgilash

URL'dagi clinicId'ni AVTOMATIK DB'ga yozma. Faqat ko'rsatish uchun ishlat (ekranda shu klinika ko'rsin), lekin DB'ga tegma:

```typescript
// currentClinicId null bo'lsa:
const urlClinicId = searchParams.get('clinic') || searchParams.get('clinicId');

if (urlClinicId && clinics.find((c) => c.id === urlClinicId)) {
  // FAQAT KO'RSAT, DB'ga YOZMA
  setActiveClinicId(urlClinicId);
  // persistToDb(loaded.id) — bu qatorni OLIB TASHLA
  return;
}

// Membership bor lekin currentId yo'q — birinchi membershipni KO'RSAT (DB'ga yozma)
if (clinics.length > 0) {
  setActiveClinicId(clinics[0].id);
  return;
}
```

Eslatma: agar bemor MAVJUD user bo'lsa va `isCurrent=true` yozuvi DB'da bo'lsa — birinchi shart (1-step in current code) qaytaradi va bu kodga yetib bormaydi. Demak bu fallback faqat YANGI user uchun.

YANGI user uchun esa, agar URL'da clinic bor bo'lsa, birinchi `select` chaqirig'i orqali DB'ga yozish kerak emas — chunki ular hali "Mening klinikalarim" → "Tanlash" ni bosishi mumkin. Default klinika faqat KO'RSATILSIN.

---

## TEKSHIRUV (HAQIQIY foydalanuvchi 986660442 bilan)

Deploydan SO'NG, men (Supabase orqali) DB ni real vaqtda kuzatib turaman. VS Code Claude foydalanuvchidan quyidagini iltimos qil va MEN tasdiqlay olaman:

**Senariy A (asosiy):**
1. Foydalanuvchi botdan webapp'ni ochadi → "Mening klinikalarim" → "Test klinika" tanlaydi
2. Bosh sahifa Test klinika'ni ko'rsatadi (✅)
3. Foydalanuvchi botdan butunlay chiqadi (X bilan)
4. Botdan qayta kiradi → **Test klinika** ko'rinishi SHART (BUYUK TABIB EMAS)

**Senariy B (oraliq):**
5. Foydalanuvchi webapp ichida sahifalar bo'ylab harakatlanadi (Tarix → bosh sahifa → Mening klinikalarim → bosh sahifa)
6. Har bir o'tishda Test klinika qoladi (URL o'zgarsa ham)

**Senariy C (DB poisoning testi):**
7. DB'da Test klinika isCurrent=true bo'ladi va URLda ?clinicId=clinic-demo kelsa — Test klinika baribir ko'rinishi va DB'ga BUYUK TABIB yozMASLIGI shart

Har senariy uchun men DB'dan `SELECT "clinicId", "isCurrent", "lastSelectedAt" FROM user_clinics WHERE "userId" = 'cmp6uoya50001l5045hw949m7'` chaqirib, holatni tekshiraman.

---

## TAVSIYA — BIR-IKKI QO'SHIMCHA TUZATISH

### A. Bot URL ham toza bo'lsin (ixtiyoriy)
`bot/helpers/render.ts:13-21` da `params.set("clinicId", DEFAULT_CLINIC_ID)` — buni olib tashlash mumkin. Sabab: webapp tgId orqali DB'dan o'qiydi, clinicId URL'da kerak emas. Lekin bu o'zgarish ixtiyoriy — agar XATO 3 to'g'ri tuzatilsa, URL'dagi clinicId zararli bo'lmaydi.

### B. localStorage tozalash (ixtiyoriy)
Agar localStorage'da eski qiymat saqlanib qolgan bo'lsa, u ham aralash javob beradi. ClinicProvider boshida agar tgId bor bo'lsa, localStorage qiymatini DB'ga moslab tozalash mumkin.

---

## YAKUNDA HISOBOT

VS Code Claude quyidagilarni hisobotda bering:
1. Qaysi 3 ta xato tuzatildi (har biri kod parchasi bilan: avval va keyin)
2. URL sync olib tashlandimi yoki qisman tuzatildimi?
3. sessionStorage tgId saqlash qayerda qo'shildi?
4. persistToDb chaqirig'i endi faqat qaerda chaqiriladi (kodda joy)?
5. tsc/build/deploy + commit hash
6. Tekshiruv: deploydan KEYIN foydalanuvchidan Senariy A ni sinashni so'rang va menга qaytaring (men DB'dan tasdiqlay olaman)

---

## NIMA UCHUN BU BORADIGAN YO'L

Avvalgi 2 promptда men "URL paramni ishlat" deb yozdim, lekin **`tgid` parametri yo'qolishi muammosini bilmaganman**. CLINIC-DIAGNOSE-01 javobi aniq ko'rsatdi: tgId sessionStorage'ga hech qachon yozilmaydi va URL'da yo'qolsa — DB o'qilmaydi.

Bu safar nishonga aniq uramiz:
- tgId sessionStorage'ga BIRINCHI URLда kelganda yoziladi → keyingi hamma harakat saqlanadi
- URL sync `tgid` ni teginmaydi (yoki butunlay olib tashlanadi)
- DB poisoning yo'q — URL'dagi qiymat avtomatik DB'ga yozilmaydi
