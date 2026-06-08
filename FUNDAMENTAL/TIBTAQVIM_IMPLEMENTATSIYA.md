# TibTaqvim — Yakuniy Implementatsiya Prompti

> Diagnostika tugadi va tasdiqlandi. Endi kod yoz. **Hech narsa buzilmasligi SHART** — barcha mavjud oqimlar (bron, eslatma, to'lov, relay, broadcast, multi-clinic) avvalgidek ishlayverishi kerak. Faqat qo'shamiz, mavjudni sindirmaymiz.
>
> Ketma-ketlik: **A → B → C → D**. Har biridan keyin alohida commit + `npm run build` o't.

---

## VAZIFA A — `fatherName` + manzil maydonlari (migration)

### A.1 Prisma + DB
`prisma/schema.prisma` `User` modeliga 3 ta nullable maydon qo'sh:
```prisma
fatherName String?   // otasining ismi
region     String?   // viloyat
district   String?   // tuman
```
- Migration nomi: `add_fathername_region_district_to_users`
- Supabase'da DDL: `ALTER TABLE users ADD COLUMN "fatherName" text, ADD COLUMN region text, ADD COLUMN district text;`
- **Hammasi nullable** → mavjud 29 ta user buzilmaydi, NOT NULL constraint yo'q.
- RLS: faqat ustun qo'shilyapti, policy o'zgarmaydi → 28/28 RLS saqlanadi. Migrationdan keyin `relrowsecurity` tekshir.

### A.2 Viloyat/tuman statik manba
- `src/lib/constants/regions.ts` yarat: O'zbekiston 14 viloyat (+ Toshkent shahri) va har birining tumanlari `{ region: string, districts: string[] }[]` ko'rinishida.
- Tahrirlashda **faqat shu ro'yxatdan** tanlanadi (viloyat select → tuman select dinamik filtrlanadi). Erkin matn emas.

---

## VAZIFA B — Bemor Profil Flip Card (asosiy ish)

### B.1 API endpoint (yangi)
`PATCH /api/webapp/profile` yarat:
- Auth: webapp bemor `telegramId` orqali (mavjud `by-telegram` patternidan foydalan — bemor faqat **o'z** yozuvini yangilay olsin, boshqaning emas).
- Qabul qiladi: `{ firstName, lastName, fatherName, region, district }`
- Validatsiya: `firstName` bo'sh bo'lmasin (NOT NULL). Qolganlari ixtiyoriy.
- `users` yozuvini yangilaydi (markaziy manba).
- `GET /api/user/by-telegram` ni kengaytir: javobga `fatherName, region, district` qo'sh.

### B.2 FlipCard reuse
- `src/components/webapp/BookingFlipCard.tsx` ichidagi 3D flip mexanizmini ajratib `src/components/webapp/FlipCard.tsx` generic komponent qil: `front: ReactNode`, `back: ReactNode` props. `BookingFlipCard` ni shu generikдан foydalanadigan qilib refactor qil — **lekin booking kartalarining hozirgi xulqi 1:1 saqlansin** (bugungi/yaqinlashayotgan/tarix — hech narsa o'zgarmasin).

### B.3 Bemor header → flip card
`src/app/webapp/page.tsx:557-574` dagi header (ko'k "Salom..." qismi) ni FlipCard qil:

**OLD YUZ (front):**
- Salom + to'liq ism (endi `firstName + lastName + fatherName` — `by-telegram` `fullName` ishlatilsin, hozir faqat `firstName` ishlatilyapti, buni tuzat)
- 🆔 tibId
- 📞 telefon
- Qirrasiz to'rtburchak avatar joyi (pastga qara — B.4)
- Burchakda kichik "tahrir" / flip ikonkasi (qalam yoki ↻)

**ORQA YUZ (back) — tahrirlash formasi:**
- Inputlar: Ism (firstName, majburiy), Familiya (lastName), Otasining ismi (fatherName)
- Viloyat (select), Tuman (select — viloyatga qarab filtrlanadi)
- Bo'sh bo'lsa ham kiritish mumkin (placeholder bilan)
- "💾 Saqlash" tugmasi → `PATCH /api/webapp/profile` → muvaffaqiyatli bo'lsa optimistik yangilanish + flip orqaga qaytadi
- "Bekor qilish" → flip orqaga

### B.4 Avatar joyi (faqat placeholder)
- Old yuzda **qirrasiz (rounded yo'q, `rounded-none` / square) to'rtburchak avatar** joyi.
- Hozircha: maxsus tayyorlangan avatarlar tanlanadi (foto YUKLASH EMAS). Hozir faqat **bo'sh joy + default placeholder ikonka** qo'y.
- Kodda `// TODO: avatar tanlash — keyingi rejada` izoh qoldir. Tanlash UI hozir qilinmaydi, faqat joy tayyor tursin.

### B.5 Flip xulqi (MUHIM)
- **Kartaning HAMMA joyi bosilganda flip bo'lsin.**
- **FAQAT** tugmalar (Saqlash, Bekor qilish, flip ikonkasi) va **tahrir input/select maydonlari** flipni qo'zg'atmasin → ularga `onClick={e => e.stopPropagation()}` qo'y.
- Input ichiga bosganda karta aylanmasligi SHART.

### B.6 Markazlashtirish (denormalized tuzatish)
- Header `fullName` ni to'liq ko'rsatsin (firstName+lastName+fatherName).
- Admin/qabulxona/shifokor panellarida bemor ismi ko'rsatilganda `users.firstName/lastName/fatherName` dan o'qisin. `appointments.patientName` denormalized maydonni **o'qish uchun ishonma** — agar UI faqat shuni ishlatayotgan bo'lsa, `users` join qilib ko'rsat.
- Bemor profil yangilaganda `appointments.patientName` va kerak bo'lsa relay'dagi ismni ham sinxronlash uchun: yangilash paytida shu user'ning kelajakdagi (status pending/confirmed) bronlaridagi `patientName` ni yangilab qo'y (eski yopilgan bronlarga tegma).
- **Responsive MAJBURIY:** `layout/` primitivlaridan qur, xs/md/lg/2xl da chiroyli.

---

## VAZIFA C — Bot ism/manzil qayta so'ramasligi

- `callback.ts:199-213` (`use_saved`) oqimi `firstName + phone` bor bo'lsa skip qiladi — buni saqla.
- Kengaytir: `fetchUserByTelegramId` natijasida `firstName` (va xohlasa `region/district`) mavjud bo'lsa, bot **ism va manzil so'ramasin**. Bemor webapp orqali kiritgan bo'lsa, bot qayta so'ramasligi kerak.
- Bot confirmation va relay'da `users.firstName/lastName/fatherName` ni manba qil (state.patientName o'rniga DB'dan o'qib yubor) — ism webapp'da o'zgargan bo'lsa, eng yangi ism ketsin.
- `change_info` oqimini buzMA — agar bemor o'zi "ma'lumotni o'zgartirish" desa, so'rashda davom etadi.

---

## VAZIFA D — Tungi/Kunduzgi rejim (toggle tugma)

### D.1 Asos
- `next-themes` o'rnat. `ThemeProvider` ni `app/layout.tsx` ga: `attribute="class"`, `defaultTheme="system"`, `enableSystem`.
- `tailwind.config.ts` → `darkMode: 'class'`.
- `globals.css` ga CSS o'zgaruvchilar: light va `.dark` uchun `--background, --foreground, --card, --border, --muted` va h.k.

### D.2 Toggle tugma
- **Quyosh ☀️ / Oy 🌙 ikonkali** toggle tugmasi.
- Joylashuvi: webapp header (yuqori burchak) + admin/qabulxona/shifokor panellari header'iga.
- 3 holat: light / dark / system (yoki oddiy 2 holat almashish — quyosh↔oy). `lucide-react` Sun/Moon ikonka.

### D.3 Ranglarni ko'chirish
- Hardcode ranglar (~200 fayl) ko'p — **bosqichma-bosqich**: avval webapp, keyin admin/qabulxona/shifokor.
- `bg-white→bg-background`, `text-gray-900→text-foreground`, `bg-gray-50→bg-muted` va `dark:` variantlar.
- **Loyiha qoidasi:** kelajakda qo'shiladigan har bir sahifa avtomatik dark mode'ni qo'llab-quvvatlasin (CSS o'zgaruvchilar orqali).
- Flip card ham har ikkala rejimda chiroyli ko'rinsin.

---

## YAKUNIY TEKSHIRISH (acceptance)

- [ ] Bemor webapp'da kartani bosib (hamma joyi) aylantirib, ism/familiya/otasining ismi/viloyat/tuman tahrirlab saqlay oladi.
- [ ] Input va tugmalar bosilganda karta aylanmaydi.
- [ ] Old yuzda qirrasiz to'rtburchak avatar placeholder bor (TODO bilan).
- [ ] Saqlangan ma'lumot bot, webapp, admin/qabulxona/shifokorda bir xil ko'rinadi (markaziy `users`).
- [ ] Bot bu bemordan ism/manzil qayta so'ramaydi.
- [ ] Quyosh/oy tugmasi butun ilovani light↔dark almashtiradi, system ishlaydi.
- [ ] **Hech narsa buzilmagan:** bron, eslatma, to'lov, relay, broadcast, multi-clinic avvalgidek ishlaydi.
- [ ] RLS 28/28 saqlangan, `npm run build` toza, deploy READY.
- [ ] Barcha sahifalar responsive (xs/md/lg/2xl).

> two_hours cron va broadcast timeout (diagnostikadagi E, F) — bu promptga KIRMAYDI. Alohida so'ralganda qilinadi. Hozir e'tibor faqat A-B-C-D da.
