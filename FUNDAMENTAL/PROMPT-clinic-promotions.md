# TIBTAQVIM — KLINIKA TELEGRAM WIDGET DROPDOWN (CLINIC PROMOTIONS)

> Bu to'liq ish prompti. 3 faza ketma-ket bajariladi. HAR FAZA oxirida
> build + lint testidan o'tkaz, MENGA hisobot ber, TASDIQ kutib turma —
> faza ichida to'xtab so'rash FAQAT noaniqlikda. Fazalararo to'xtamasdan
> davom et, lekin har faza oxirida hisobotni yoz. Yakunda deploy.

---

## 0. KONTEKST (qisqa, fon uchun)

TibTaqvim — Next.js 14 App Router + React 18 + TypeScript + Tailwind +
Prisma + Supabase (PostgreSQL) + Vercel + Telegram bot/WebApp. Tibbiy
klinika bandlash tizimi, butun UI o'zbek tilida. Repo:
`oqiljonplay-ctrl/tibtaqvim`. Supabase project_id: `lxqimithjjabhnldcugc`.

**Diagnoz allaqachon qilingan (ishonchli):**
- Yuqori "Joriy klinika" kartochkasi = `src/components/webapp/ClinicSwitcher.tsx`
  komponenti, `src/app/webapp/page.tsx:580-586` da render qilinadi.
- Hozir bosilganda `ClinicSwitcherSheet` (bottom-sheet modal) ochilib
  klinika ALMASHTIRADI.
- Klinika almashtirish funksiyasi pastdagi "Klinikalar" tugmasida ham bor
  (`/webapp/my-clinics`, `setClinic()` chaqiradi) — DUBLIKAT.
- Bron qilish "Yangi bron" tugmasida (`/webapp/clinics/[id]`).
- Webapp API auth = `?tgid=` yoki `?telegramId=` query param (JWT YO'Q).
- Webapp'da hech qanday t.me embed YO'Q — sifirdan quriladi.
- Dizayn primitivlari: `src/components/layout/` da Container, Stack,
  ResponsiveGrid, ResponsiveTable bor.
- Dashboard stil: `bg-white rounded-2xl shadow-sm border border-gray-100 p-5`,
  asosiy rang blue-600, fon gray-50, radius rounded-xl/2xl.
- 3 klinika: BUYUK TABIB (`clinic-demo`), MOLEKULA
  (`cmpcuaelv0002l5040mahj75v`), Test klinika (`cmpay6dn80002l504rr8qez3t`).

**MAQSAD:** Yuqori "Joriy klinika" kartochkasini bosilganda PASTGA dropdown
ochilib, shu klinikaning Telegram post widgetlari (t.me embed) ko'rinadi.
Qayta bosilganda dropdown yumshoq yig'iladi. Klinika nomi tugmada qoladi
(faqat ko'rsatish — almashtirish EMAS). Postlarni admin/superadmin qo'lda
qo'shadi. Har post turi (aksiya/yangilik/e'lon/umumiy) va manbasi
(kanal/guruh) belgilanadi. User dropdown'da filtr bilan ko'radi.

---

## QARORLAR (men, loyiha egasi, tasdiqladim — TAXMIN QILMA, SHULAR)

1. **Post qo'shish:** Admin va superadmin QO'LDA. Har post uchun t.me link
   kiritiladi, tur va manba belgilanadi. (Avtomatik tortib olish YO'Q.)
2. **Telegram username saqlash:** `clinics` jadvaliga yangi maydonlar
   qo'shiladi (pastda DDL).
3. **Eski ClinicSwitcherSheet:** O'CHIRILMAYDI. Faqat ClinicSwitcher'dan
   UZILADI (modal chaqiruvi olib tashlanadi). Fayl joyida qoladi, import
   ham qolishi mumkin (build buzilmasin), lekin ishlatilmaydi. Kelajak uchun.
4. **Obuna tugmasi:** Har widget kartochkasi ostida — manba kanal bo'lsa
   "Kanalga obuna bo'lish", guruh bo'lsa "Guruhga qo'shilish" tugmasi.
   Admin har post uchun bu tugmani O'CHIRA oladi (`showSubscribeButton` bool).

---

## FAZA 1 — DATABASE (Prisma + Supabase)

### 1.1 Prisma schema — Clinic modeliga yangi maydonlar

`prisma/schema.prisma` da `Clinic` modeliga qo'sh (mavjud maydonlarga TEGMA):

```prisma
  telegramChannelUsername String?  // masalan "buyuktabib" (@ siz)
  telegramGroupUsername   String?  // public guruh username (@ siz)
```

### 1.2 Prisma schema — yangi ClinicPromotion modeli

`prisma/schema.prisma` ga yangi model qo'sh:

```prisma
enum PromotionType {
  aksiya
  yangilik
  elon
  umumiy
}

enum PromotionSource {
  kanal
  guruh
}

model ClinicPromotion {
  id                  String          @id @default(cuid())
  clinicId            String
  clinic              Clinic          @relation(fields: [clinicId], references: [id])
  postUrl             String          // to'liq t.me link: https://t.me/kanal/123
  embedId             String          // "kanal/123" — telegram-widget.js uchun
  type                PromotionType   @default(umumiy)
  source              PromotionSource @default(kanal)
  title               String?         // admin qo'shadigan ixtiyoriy sarlavha
  subscribeUsername   String?         // obuna tugmasi uchun (@ siz). null = clinic dan oladi
  showSubscribeButton Boolean         @default(true)
  isActive            Boolean         @default(true)
  sortOrder           Int             @default(0)
  publishedAt         DateTime        @default(now()) // saralash uchun (admin sanani o'zgartira oladi)
  createdById         String
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  @@index([clinicId, isActive])
  @@map("clinic_promotions")
}
```

Clinic modelining `relations` qismiga `promotions ClinicPromotion[]` qo'sh
(agar Prisma talab qilsa).

### 1.3 Migratsiya

- `npx prisma migrate dev --name add_clinic_promotions` (yoki loyihada
  ishlatiladigan migratsiya buyrug'i — `package.json` ni tekshir, qaysi
  pattern bo'lsa shuni ishlat).
- Migratsiyadan keyin RLS yoqilishi MAJBURIY (loyiha qoidasi: hamma jadval
  RLS bilan, Prisma service_role orqali ishlaydi). Migratsiyaga yoki alohida
  SQL bilan:
  ```sql
  ALTER TABLE clinic_promotions ENABLE ROW LEVEL SECURITY;
  -- anon/authenticated uchun policy YO'Q (deny all), Prisma service_role bypass qiladi
  ```
  Mavjud `payments` jadvali RLS pattern'iga qara (`Phase 0.6` izohi bor) —
  AYNAN shu pattern'ni takrorla.
- `npx prisma generate`.

### 1.4 FAZA 1 TEST
- `npx prisma validate` → exit 0.
- `npm run build` → exit 0.
- Supabase'da `clinic_promotions` jadvali yaratilgani va RLS yoqilgani
  tasdiqlansin (`SELECT relrowsecurity FROM pg_class WHERE relname='clinic_promotions';`).
- HISOBOT: migratsiya nomi, RLS holati, Clinic yangi maydonlar qo'shilgani.

---

## FAZA 2 — ADMIN UI (post qo'shish/tahrirlash)

### 2.1 API endpointlar (admin tomoni)

Mavjud admin API pattern'iga amal qil (`src/app/api/admin/...` yoki loyihada
qanday bo'lsa — avval mavjud admin API papkasini tekshir, auth qanday
ishlashini ko'r, AYNAN shu pattern). Yangi endpointlar:

- `GET    /api/admin/promotions?clinicId=` → ro'yxat (admin o'z klinikasi,
  superadmin hammasi yoki tanlangan klinika)
- `POST   /api/admin/promotions` → yangi post qo'shish
- `PATCH  /api/admin/promotions/[id]` → tahrirlash
- `DELETE /api/admin/promotions/[id]` → o'chirish (yoki isActive=false soft)

**Auth qoidasi (MAJBURIY):**
- `clinic_admin` / `branch_admin` → faqat O'Z klinikasi (clinicId tekshir).
- `super_admin` → istalgan klinika.
- Mavjud admin auth helper'ini ishlat (loyihada `requireRole` yoki shunga
  o'xshash bo'lsa — tekshir, ishlat). TAXMIN QILMA, mavjud pattern'ni ko'r.

**postUrl → embedId parse:**
`https://t.me/buyuktabib/123` → embedId = `buyuktabib/123`. Validatsiya:
faqat `t.me/...` linklarini qabul qil, regex bilan tekshir. Noto'g'ri
formatda 400 qaytar.

### 2.2 Admin UI sahifa

Mavjud admin ads sahifasi (`src/app/admin/super/ads/page.tsx`) STILIGA va
struktura pattern'iga qarab, klinika admin paneliga "Reklama / E'lonlar"
yoki "Telegram postlar" bo'limi qo'sh. Joylashuv:
- Klinika admin uchun: o'z paneli ichida (qaysi route bo'lsa — tekshir,
  masalan `src/app/admin/clinic/...` yoki shunga o'xshash).
- Superadmin uchun: klinika tanlab, o'sha klinikaga post qo'shadigan UI.

**Forma maydonlari:**
- t.me link (postUrl) — majburiy, validatsiya bilan
- Tur (type): aksiya / yangilik / e'lon / umumiy — select
- Manba (source): kanal / guruh — select
- Sarlavha (title) — ixtiyoriy
- Obuna tugmasi ko'rsatilsinmi (showSubscribeButton) — checkbox
- Obuna username (subscribeUsername) — ixtiyoriy (bo'sh bo'lsa clinic dan)
- Sana (publishedAt) — default bugun, o'zgartirsa bo'ladi
- Faol (isActive) — checkbox
- Tartib (sortOrder) — raqam

**Ro'yxat:** qo'shilgan postlar jadvali (tahrirlash/o'chirish tugmalari bilan).
Mumkin bo'lsa har post yonida kichik preview (embed) — lekin admin panelda
embed og'ir bo'lsa, faqat link + tur + sana ko'rsatish kifoya.

**Responsive (MAJBURIY qoida):** `src/components/layout/` primitivlaridan
(Container, Stack, ResponsiveGrid, ResponsiveTable) qur. 360px mobil,
desktop — ikkalasida toza.

### 2.3 FAZA 2 TEST
- `npm run build` exit 0, `tsc --noEmit` exit 0.
- Admin sifatida 1 ta test post qo'shilsin (qo'lda yoki API orqali),
  DB'da paydo bo'lgani tasdiqlansin.
- Auth tekshiruv: clinic_admin boshqa klinikaga post qo'sha olmasligini
  mantiqan tasdiqla (kod darajasida clinicId tekshiruvi bor).
- HISOBOT: qo'shilgan endpointlar, admin UI joylashuvi, auth qanday
  ta'minlangani, test post.

---

## FAZA 3 — WEBAPP DROPDOWN WIDGET (asosiy, eng muhim)

### 3.1 Webapp API endpoint

`src/app/api/webapp/clinics/[id]/promotions/route.ts` (yangi):
- `GET ?tgid=...` (yoki `?telegramId=`) — mavjud webapp API auth pattern'iga
  AYNAN amal qil (`src/app/api/webapp/appointments/route.ts` ni namuna ol).
- Qaytaradi: shu klinikaning `isActive=true` postlari, `publishedAt desc`
  + `sortOrder` bo'yicha tartiblangan.
- Har post: id, embedId, postUrl, type, source, title, showSubscribeButton,
  subscribeUsername (yoki clinic.telegramChannelUsername/GroupUsername dan
  to'ldirilgan), publishedAt.
- Klinika telegram username'larini ham qaytar (obuna tugmasi uchun fallback).

### 3.2 Telegram embed komponenti

`src/components/webapp/TelegramPostEmbed.tsx` (yangi):
- Props: `embedId` (masalan "buyuktabib/123").
- Telegram widget skriptini bir marta yuklaydi va postni render qiladi.
- Implementatsiya: `telegram-widget.js` ni dinamik yuklash. Misol mantiq:
  ```tsx
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-post', embedId)
    script.setAttribute('data-width', '100%')
    containerRef.current?.appendChild(script)
    return () => { /* cleanup: container ichini tozala */ }
  }, [embedId])
  ```
- Yuklanguncha skeleton/shimmer ko'rsat (liquid shimmer, gray-100→gray-50).
- Iframe atrofiga toza ramka: `rounded-2xl overflow-hidden border border-gray-100`.

### 3.3 ClinicSwitcher'ni qayta yo'naltirish

`src/components/webapp/ClinicSwitcher.tsx` ni o'zgartir:
- Hozir `onClick={() => setOpen(true)}` → ClinicSwitcherSheet (modal) ochadi.
- YANGI: `onClick` endi PASTGA dropdown ochadi/yopadi (toggle).
  `const [open, setOpen] = useState(false)` qoladi, lekin `ClinicSwitcherSheet`
  o'rniga yangi `<ClinicPromotionsDropdown>` ko'rsatiladi.
- ▼ o'qcha `open` bo'lganda 180° aylanadi (`transition-transform rotate-180`).
- Klinika logo + nomi tugmada QOLADI (almashtirish emas, faqat ko'rsatish +
  dropdown toggle).
- `ClinicSwitcherSheet` import/chaqiruvi olib tashlanadi (yoki comment).
  Fayl o'chirilmaydi (qaror 3).

### 3.4 Dropdown komponenti

`src/components/webapp/ClinicPromotionsDropdown.tsx` (yangi):
- Props: `clinicId`, `tgid` (yoki context'dan oladi).
- Ochilganda `GET /api/webapp/clinics/[id]/promotions?tgid=` chaqiradi.
- Yumshoq slide-down animatsiya (max-height + opacity transition, yoki
  framer-motion agar loyihada bor bo'lsa — tekshir; yo'q bo'lsa CSS transition).
- Yuqorida filtr chiplari: "Hammasi / Aksiya / Yangilik / E'lon" — bosilganda
  ro'yxat filtrlanadi (client-side, type bo'yicha).
- Har post = kartochka:
  - `<TelegramPostEmbed embedId={...} />`
  - Tur badge (aksiya=qizil/pushti, yangilik=ko'k, e'lon=sariq, umumiy=kulrang)
  - Agar `showSubscribeButton` true:
    - source=kanal → "📢 Kanalga obuna bo'lish" tugmasi →
      `https://t.me/{subscribeUsername}` ochadi
    - source=guruh → "👥 Guruhga qo'shilish" tugmasi →
      `https://t.me/{subscribeUsername}` ochadi
    - false bo'lsa tugma CHIQMAYDI
- Bo'sh holat: post yo'q bo'lsa — chiroyli bo'sh holat ("Hozircha e'lon yo'q").
- Yuklanish: skeleton kartochkalar.

### 3.5 DIZAYN — zamonaviy, liquid, gradiyent (MUHIM)

Loyiha egasi aniq so'radi: chiroyli, zamonaviy, sahifaga MOS, "xunuk orolcha"
BO'LMASIN. Yo'riqnoma:
- Dropdown foni: yengil gradiyent (`bg-gradient-to-b from-white to-blue-50/30`)
  yoki liquid-glass (`backdrop-blur-sm bg-white/80`).
- Kartochkalar: `rounded-2xl border border-gray-100/80 shadow-sm`, hover/active
  da yengil `scale-[0.99]` va shadow chuqurlashishi.
- Filtr chiplari: pill shaklida, tanlangani gradiyent
  (`bg-gradient-to-r from-blue-500 to-blue-600 text-white`), tanlanmagani
  `bg-gray-100 text-gray-600`.
- Tur badge'lar: yumshoq rang + nozik gradiyent.
- Obuna tugmasi: gradiyent fon, rounded-full, kichik telegram ikonkasi.
- Animatsiya: dropdown slide-down 250-300ms ease-out, ▼ aylanishi.
- Liquid bezak: kartochka burchaklarida yoki dropdown tepasida nozik
  gradiyent blur "blob" (juda yengil, chalg'itmaydigan).
- HAMMASI dashboard rang palitrasi (blue-600, gray) ichida — begona ko'rinmasin.
- Responsive (MAJBURIY): 360px mobil — embed to'liq enga (data-width="100%"),
  kartochkalar bir ustun; desktop — kengroq, lekin webapp asosan mobil.

### 3.6 FAZA 3 TEST
- `npm run build` exit 0, `tsc --noEmit` exit 0.
- Yuqori tugma bosilganda dropdown pastga ochiladi, qayta bosilganda yig'iladi.
- Test post (Faza 2 da qo'shilgan) embed bo'lib ko'rinadi.
- Filtr chiplari ishlaydi.
- Obuna tugmasi: showSubscribeButton true da chiqadi, false da chiqmaydi;
  kanal/guruhga qarab matn to'g'ri.
- Klinika almashtirish endi YUQORI tugmada YO'Q (faqat dropdown). "Klinikalar"
  pastki tugmasida almashtirish ishlashda davom etadi (TEGILMAGAN).
- HISOBOT: o'zgargan/yangi fayllar, dropdown ishlashi, dizayn skrinshot
  tavsifi yoki rang/animatsiya tafsiloti.

---

## QAT'IY CHEGARALAR — BUZMASLIK SHART

1. Login/auth, JWT (xodim tomoni), middleware — TEGMA.
2. Bron yaratish, slot, navbat, narx, queueMode logikasi — TEGMA.
3. `setClinic`, ClinicContext ICHKI logikasi — TEGMA (faqat o'qiysan,
   ClinicSwitcher'da setClinic chaqiruvini olib tashlash mumkin, lekin
   context'ning o'zini o'zgartirma).
4. Pastki "Klinikalar" tugmasi (/webapp/my-clinics) va undagi klinika
   almashtirish — TEGMA, ishlashda davom etadi.
5. "Yangi bron" tugmasi va bron oqimi — TEGMA.
6. Mavjud reklama tizimi (ad_channels/ad_campaigns/ad_posts, ad-broadcast
   cron, bot broadcast) — TEGMA. Bu BOSHQA narsa (bot broadcast), bizning
   clinic_promotions undan MUSTAQIL.
7. ClinicSwitcherSheet.tsx fayli — O'CHIRMA (qaror 3, kelajak uchun qoldi).
8. Boshqa webapp sahifalar (history, my-clinics, profil, booking) — TEGMA.
9. schema.prisma — faqat Clinic'ga 2 maydon + ClinicPromotion model +
   2 enum qo'sh. Boshqa modellarga TEGMA.
10. RLS — yangi jadval RLS bilan, mavjud payments pattern'iga mos.
11. Noaniqlik (auth helper nomi, admin route joyi, migratsiya buyrug'i) —
    avval MAVJUD kodni o'qib aniqla. Topa olmasang TO'XTA, SO'RA. TAXMIN QILMA.
12. `any` ishlatma. Mavjud TypeScript tiplari pattern'iga amal qil.
13. Deploy mo'rtligi hal bo'lgan (ESLint ignoreDuringBuilds) — lekin baribir
    lokal `npm run build` exit 0 bo'lishini ta'minla.

---

## YAKUNIY DEPLOY (3 faza tugagach)

- Hamma test o'tgach: `git add -A`
- `git commit -m "feat(promotions): klinika Telegram widget dropdown — clinic_promotions + admin UI + webapp embed"`
- `git push` → Vercel avtomatik deploy.
- Deploy READY bo'lgach tasdiqla.

## YAKUNDA TO'LIQ HISOBOT
1. Faza 1: migratsiya nomi + SHA, RLS holati, Clinic yangi maydonlar.
2. Faza 2: admin endpointlar, UI joylashuvi, auth, test post.
3. Faza 3: webapp endpoint, embed komponent, dropdown, dizayn (gradiyent/
   liquid tafsilot), ClinicSwitcher o'zgarishi.
4. `git diff --stat` — chegaralar (1-13) buzilmagani tasdiqlansin.
5. Commit SHA + Vercel deploy holati (READY).
6. Mantiqiy tasdiq: yuqori tugma=dropdown, almashtirish=Klinikalar tugmasi,
   bron=Yangi bron tugmasi — uchchovi to'g'ri ajralgan.

KOD SIFATLI, TOZA, CHALKASHMASIN. Har faza oxirida hisobot. Yakunda deploy.
