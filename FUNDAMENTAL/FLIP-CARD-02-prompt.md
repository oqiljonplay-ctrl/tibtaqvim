# TASK: FLIP-CARD-02 — Webapp flip kartochkani yakunlash va tuzatish

## KONTEKST (FLIP-CARD-01 holati)
Backend TO'LIQ TAYYOR va DB'da tasdiqlangan:
- ✅ 4 jadval (doctor_specialties, doctor_directions, doctor_experiences, doctor_workplaces) — RLS enabled
- ✅ doctors ustunlari: education, position, department, workSchedule, operationsCount, bio
- ✅ `/doctor/profile` sahifasi ishlayapti (chiroyli, responsive)
- ✅ API'lar: /api/doctor/profile, /api/admin/doctors/[id]/profile, /api/patient/doctor/[id]/profile
- ✅ Deploy: a2b1588

## MUAMMO (rasmlardan tasdiqlangan)
Webapp bron kartochkasida (`src/app/webapp/page.tsx`) FLIP REJIMI ISHLAMAYAPTI:
1. **Flip yo'q**: kartochka bosilganda aylanmaydi, orqa tomon ko'rinmaydi, flip ikonkasi yo'q
2. **UI buzuq**: ba'zi kartochkalarda "Bekor qilish" tugmasi pastdan kesilib qolgan (overflow/height muammosi)
3. **Nomuvofiqlik**: ba'zi kartochkalarda tugmalar bor, ba'zilarida yo'q — har xil bron holatlari (today / yaqinlashayotgan / navbat raqami) uchun struktura bir xil emas
4. **Bo'sh profil**: hamma shifokorda profil hali null — flip orqa tomon bo'sh bo'lsa ham CHIROYLI ko'rinishi kerak ("Ma'lumot kiritilmagan" holати)

## SABAB TAHLILI
FLIP-CARD-01'da FlipCard komponenti webapp/page.tsx ga qo'shilgan, lekin:
- 3D flip CSS to'liq ishlamayapti (preserve-3d / backface-visibility / perspective container yetishmayapti), YOKI
- Flip faqat bitta bron turida qo'llanilgan, qolganlarida eski struktura qolgan
- Kartochka balandligi (height) old va orqa o'rtasida moslashmagan → overflow → tugma kesilyapti

---

## 0. MAJBURIY QOIDALAR
- **Responsive**: src/components/layout/ primitivlari (Container, Stack, ResponsiveGrid). Mobil birinchi (webapp asosan mobil!).
- **Bitta ish hammasiga**: FlipCard BITTA reusable komponent bo'lsin. Webapp'dagi HAMMA bron turi (bugungi qabul, yaqinlashayotgan, navbat raqami bilan, navbatsiz) AYNAN shu komponentdan foydalansin. Kopya-paste struktura BO'LMASIN.
- **&apos; ISHLATMA** — to'g'ridan-to'g'ri `'`.
- RLS allaqachon yoqilgan — DB'ga tegma, faqat frontend + kerak bo'lsa API.

---

## 1. REUSABLE FlipCard KOMPONENTI

Agar mavjud bo'lsa qayta yoz, bo'lmasa yarat: `src/components/webapp/BookingFlipCard.tsx`

### Props:
```typescript
interface BookingFlipCardProps {
  appointment: {
    id: string;
    service: { name: string; type: string };
    date: string;
    status: string; // "booked" | "waiting" | "completed" | ...
    queueNumber?: number | null;  // navbat raqami (bor yoki yo'q)
    isQueueMode?: boolean;        // kunlik ro'yxat / kassadan jonli navbat
    doctor: {
      id: string;
      firstName: string;
      lastName: string;
      specialty: string;
      photoUrl?: string | null;
      workSchedule?: string | null;  // OLD tomonda ko'rinadi
    } | null;
    profile?: DoctorProfile | null;  // ORQA tomon ma'lumotlari (lazy yoki preload)
  };
  onRebook: (serviceId: string) => void;
  onCancel: (appointmentId: string) => void;
}
```

### Struktura (3D flip):
```tsx
// CONTAINER — perspective beradi
<div className="relative" style={{ perspective: "1200px" }}>
  {/* FLIPPER — aylanadigan qism */}
  <div
    className="relative transition-transform duration-700"
    style={{
      transformStyle: "preserve-3d",
      transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
    }}
  >
    {/* OLD TOMON */}
    <div style={{ backfaceVisibility: "hidden" }}>
      {/* shifokor rasmi, ism, mutaxassislik, sana, ish vaqti */}
      {/* status tag + tugmalar (Kutilmoqda/Qayta bron/Bekor) */}
      {/* navbat raqami (agar bor bo'lsa) */}
      {/* flip ikonka — pastki o'ng burchakda */}
    </div>

    {/* ORQA TOMON — absolute, 180deg oldindan burilgan */}
    <div
      className="absolute inset-0"
      style={{
        backfaceVisibility: "hidden",
        transform: "rotateY(180deg)",
      }}
    >
      {/* 8 maydon profil */}
      {/* "← orqaga" tugmasi tepada */}
    </div>
  </div>
</div>
```

### KRITIK: balandlik muammosi (tugma kesilishi)
preserve-3d'da old va orqa absolute bo'lsa, container balandligini BELGILASH kerak. Yechim variantlari (eng mosini tanla):
- **Variant A (tavsiya)**: old tomon `relative` (oqim ichida, balandlikni belgilaydi), orqa `absolute inset-0`. Flip bo'lganda container old tomon balandligida qoladi. Agar orqa uzunroq bo'lsa → orqa ichida `overflow-y-auto max-h-...`.
- **Variant B**: ikkala tomon balandligini JS bilan o'lchab, max(old, orqa) ni container'ga ber (useRef + useEffect).

Old tomon tugmalari TO'LIQ ko'rinishi shart — overflow:hidden tugmani kesmasin. Test: eng uzun kartochka (navbat raqami + 3 tugma) ham to'liq sig'sin.

### KRITIK: flip trigger va tugma xavfsizligi
- Butun kartochka bosilganda flip QILMASIN (chunki tugmalar bosilib ketadi).
- Flip FAQAT alohida ikonka/tugma orqali: pastki o'ng burchakda kichik "🔄 ma'lumot" yoki "ℹ️" tugmasi.
- O'sha flip tugmasida: `onClick={(e) => { e.stopPropagation(); setFlipped(f => !f); }}`
- Old tomon tugmalarida ham `e.stopPropagation()` (xavfsizlik uchun).
- Orqa tomonda "← orqaga" tugmasi flip'ni qaytaradi.

---

## 2. ORQA TOMON — 8 MAYDON (bo'sh holatni chiroyli ko'rsat)

Tartib:
1. **Ta'lim** — education
2. **Mutaxassislik** — profile.specialties[] (teglar/chip ko'rinishida; bo'sh bo'lsa doctor.specialty fallback)
3. **Lavozimi** — position
4. **Qabul yo'nalishlari** — profile.directions[] (teglar)
5. **Tajriba** — profile.experiences[] (har biri "Joy — 2018-2022" yoki "Joy — 2018-hozirgacha" agar endYear null)
6. **Ish joylari** — profile.workplaces[] (ro'yxat)
7. **Bo'limi** — department
8. **Operatsiyalar soni** — operationsCount (agar 0 bo'lsa ko'rsatma yoki "—")

**BO'SH HOLAT (muhim — hozir hamma profil null!):**
- Agar maydon bo'sh → o'sha qatorni ko'rsatma YOKI "—" / "Ma'lumot kiritilmagan" (kulrang, kichik).
- Agar BUTUN profil bo'sh → orqa tomonda chiroyli placeholder: "📋 Shifokor hali ma'lumot kiritmagan" (markazda, ikonка bilan). Flip baribir ishlasin (bo'sh bo'lsa ham aylansin).
- Orqa tomon scroll bo'lishi mumkin (max-height + overflow-y-auto) agar ma'lumot ko'p bo'lsa.

---

## 3. WEBAPP'DAGI HAMMA BRON TURIGA QO'LLASH

`src/app/webapp/page.tsx` da hozir bir nechta bo'lim bor (rasmlardan):
- 📍 BUGUNGI QABUL (todayAppts)
- ⏰ YAQINLASHAYOTGAN BRONLAR (navbat raqami bilan)
- (boshqa bo'limlar — tarix va h.k.)

HAMMA bo'limdagi HAMMA kartochka `<BookingFlipCard>` komponentidan foydalansin. Hozir ba'zilarida eski inline JSX bor (kopya-paste) — ularni komponentga almashtir. Bitta manba, bitta ko'rinish, hamma joyda bir xil.

Navbat raqami (#1) bor kartochkalarda ham flip ishlasin — navbat raqami old tomonda, profil orqa tomonda.

---

## 4. PROFIL MA'LUMOTINI YUKLASH (API)

Webapp bron ro'yxati API'si (`/api/webapp/appointments`) hozir shifokor profil maydonlarini qaytaradimi tekshir:
- Agar YO'Q bo'lsa: appointment.doctor ga `workSchedule` (old tomon uchun) qo'sh, va orqa tomon uchun to'liq profil (specialties, directions, experiences, workplaces) ni include qil. YOKI:
- Lazy load: kartochka flip qilinganda `/api/patient/doctor/[id]/profile` chaqirilsin (faqat birinchi flip'da, keyin cache). Bu ko'p bron bo'lsa boshlang'ich yuklashни tezlashtiradi.

Tavsiya: agar bir ekranda 2-5 bron bo'lsa, preload (include) yaxshi. Lazy faqat juda ko'p bron bo'lsa. O'zing qaror qil, lekin maxfiy ma'lumot (telefon, parolHash) BERILMASIN — faqat public profil.

---

## 5. UI SIFAT (frontend-design skill)
- Flip animatsiya silliq (duration-700, ease).
- Orqa tomon dizayni old tomonga uyg'un (rang, radius, soya bir xil tizimда).
- Mobil birinchi: webapp asosan Telegram WebApp ichida ochiladi (tor ekran).
- Teglar (specialties, directions) chip ko'rinishida — rounded, kichik, rangli fon.
- Tajriba/ish joylari — toza ro'yxat, ikonка bilan.
- Bo'sh holat ham professional ko'rinsin.

---

## 6. TEKSHIRUV (deploydan oldin)
- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0
- Flip HAMMA bron turida ishlaydi (bugungi, yaqinlashayotgan, navbatli)
- Old tomon tugmalari TO'LIQ ko'rinadi (kesilmaydi)
- Flip faqat ikonka orqali (tugmalar bosilganda flip bo'lmaydi)
- Bo'sh profil chiroyli placeholder ko'rsatadi
- Mobil + desktop responsive
- `&apos;` yo'q

## 7. YAKUNDA HISOBOT
- O'zgargan fayllar ro'yxati
- BookingFlipCard komponenti qayerda, qaysi bo'limlarda ishlatildi
- Profil yuklash strategiyasi (preload yoki lazy)
- tsc/build natijalari + deploy commit hash
- Bo'sh holat qanday ko'rinadi (skrinshot yoki tavsif)

## TEST UCHUN
Deploydan keyin men (Claude/Supabase) bitta test shifokorга to'liq profil ma'lumoti kiritaman, keyin sen webapp'da flip orqa tomonini tekshirasan. Yoki sen `/doctor/profile` orqali test ma'lumot kirit.

---

## KEYINGI BOSQICHLAR (HOZIR EMAS)
1. Bron qabul qilish (shifokor panelida)
2. Shifokor ID tizimi (EM000001)
Bularni HOZIR qilma.
