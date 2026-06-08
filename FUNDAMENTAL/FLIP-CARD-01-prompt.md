# TASK: FLIP-CARD-01 — Shifokor ma'lumotlari kartochkasi (3D flip)

## Maqsad
Bemor webapp'da bron qilgach ko'rinadigan shifokor kartochkasini bosganda, kartochka 3D aylanib (flip) orqa tomonida shifokorning to'liq ma'lumotlari chiqsin (MyGov Road ilovasidagi pasport/guvohnoma aylanishi kabi). Ma'lumotlarni shifokor o'z kabinetidan VA admin paneldan kiritishi mumkin bo'lsin.

---

## 0. MAJBURIY QOIDALAR (eslatma)
- **Responsive**: barcha yangi/o'zgargan sahifalar `src/components/layout/` primitivlaridan (Container, Stack, ResponsiveGrid, ResponsiveTable) qurilishi SHART. Mobil (xs), planshet (md), noutbuk (lg), keng monitor (2xl) — barchasida chiroyli.
- **RLS**: yangi jadvallarning HAMMASIGA RLS yoqilsin (loyihada 25/25 jadval RLS bilan himoyalangan — yangi 3 jadval bilan 28/28 bo'lsin). Prisma service_role orqali ishlaydi, lekin RLS deny-by-default bo'lishi shart.
- **&apos; xatosi**: yangi JSX matnlarida `&apos;` ISHLATMA — to'g'ridan-to'g'ri `'` apostrof yoz (oldingi buzuq tugma muammosi takrorlanmasin).
- Migration + DB ni Prisma orqali O'ZING yarat va deploy qil.

---

## 1. DB O'ZGARISHLARI (Prisma schema + migration)

### 1a. `doctors` modeliga yangi ustunlar qo'sh:
```prisma
model Doctor {
  // ... mavjud maydonlar ...
  education       String?   // Ta'lim (matn)
  position        String?   // Lavozimi (matn)
  department      String?   // Bo'limi (matn)
  workSchedule    String?   // Ish vaqti — OLD tomonda ko'rinadi (masalan "Du-Ju 9:00-18:00")
  operationsCount Int       @default(0)  // Operatsiyalar soni
  bio             String?   // Qisqa tavsif (ixtiyoriy)
  // yangi relationlar:
  specialties     DoctorSpecialty[]
  directions      DoctorDirection[]
  experiences     DoctorExperience[]
  workplaces      DoctorWorkplace[]
}
```
DIQQAT: mavjud `specialty` (String) ustunini O'CHIRMA — u hali boshqa joylarda (bot, xizmat biriktirish) ishlatilyapti. Yangi `specialties[]` jadvali QO'SHIMCHA. Eski `specialty` asosiy/birlamchi mutaxassislik sifatida qoladi, yangi jadval kartochkada bir nechta mutaxassislik ko'rsatish uchun.

### 1b. 3 ta yangi jadval (hammasi doctorId CASCADE + sortOrder + RLS):

```prisma
model DoctorSpecialty {
  id        String  @id @default(cuid())
  doctorId  String
  name      String  // uzun nom bo'lishi mumkin
  sortOrder Int     @default(0)
  doctor    Doctor  @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  @@index([doctorId])
  @@map("doctor_specialties")
}

model DoctorDirection {
  id        String  @id @default(cuid())
  doctorId  String
  name      String  // qabul yo'nalishi
  sortOrder Int     @default(0)
  doctor    Doctor  @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  @@index([doctorId])
  @@map("doctor_directions")
}

model DoctorExperience {
  id        String  @id @default(cuid())
  doctorId  String
  place     String  // qayerda
  startYear Int     // boshlangan yil
  endYear   Int?    // tugagan yil (null = hozirgacha)
  sortOrder Int     @default(0)
  doctor    Doctor  @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  @@index([doctorId])
  @@map("doctor_experiences")
}

model DoctorWorkplace {
  id        String  @id @default(cuid())
  doctorId  String
  place     String  // ish joyi nomi (matn ro'yxat)
  sortOrder Int     @default(0)
  doctor    Doctor  @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  @@index([doctorId])
  @@map("doctor_workplaces")
}
```

### 1c. RLS — migration SQL ichida (yoki alohida):
Har 4 ta yangi jadval (doctor_specialties, doctor_directions, doctor_experiences, doctor_workplaces) uchun:
```sql
ALTER TABLE doctor_specialties ENABLE ROW LEVEL SECURITY;
-- deny-by-default: hech qanday public policy QO'SHMA (Prisma service_role bypass qiladi)
-- loyihadagi boshqa jadvallar bilan bir xil pattern (masalan doctors jadvali RLS qanday bo'lsa shunday)
```
Loyihadagi mavjud RLS migration patternini AYNAN takrorla (boshqa jadvallar qanday himoyalangan bo'lsa, shunday).

---

## 2. SHIFOKOR KABINETI (shifokor o'zi to'ldiradi)

Shifokor panelida (`src/app/doctor/...` yoki mavjud doctor layout) yangi sahifa yoki bo'lim: **"Mening ma'lumotlarim"** (yoki "Profil").

Shifokor quyidagilarni tahrirlay olsin:
- **Oddiy maydonlar**: Ta'lim, Lavozim, Bo'lim, Ish vaqti (matn), Operatsiyalar soni, Bio
- **Ko'p qiymatli (qo'shish/o'chirish UI bilan — dinamik ro'yxat)**:
  - Mutaxassisliklar (bir nechta input, "+ qo'shish" tugmasi)
  - Qabul yo'nalishlari (bir nechta input)
  - Tajriba (har biri: joy + boshlangan yil + tugagan yil; "hozirgacha" checkbox = endYear null)
  - Ish joylari (bir nechta matn input)

UI: ResponsiveGrid/Stack bilan. Har ko'p qiymatli blok — qatorlar ro'yxati + "+ qo'shish" / "x o'chirish" tugmalari. sortOrder avtomatik tartib bo'yicha.

API (yangi yoki mavjud doctor profil endpoint):
- `GET /api/doctor/profile` — o'z ma'lumotlarini oladi (auth.doctorId orqali)
- `PUT /api/doctor/profile` — yangilaydi (faqat o'z doctorId — auth'dan, body'dan EMAS)
- Ko'p qiymatli jadvallar: transaction ichida delete-all + recreate yoki upsert pattern.

---

## 3. ADMIN PANEL (admin ham to'ldira olsin)

Mavjud shifokor tahrirlash sahifasida (`src/app/admin/(panel)/shifokorlar/...`) shu 8 maydon bloki qo'shilsin. Admin istalgan shifokorning ma'lumotlarini kirita/tahrirlay olsin.

- clinic_admin: o'z klinikasidagi shifokorlar
- branch_admin: o'z filialidagi shifokorlar (branchId scope)
- super_admin: hammasi

API: `PUT /api/admin/doctors/[id]/profile` (yoki mavjud doctor update endpoint kengaytirilsin). branchId/clinicId scope tekshirilsin (xavfsizlik).

MUHIM: shifokor va admin BIR XIL ma'lumotni tahrirlaydi (bir manba — doctors + 4 jadval). Ya'ni shifokor kiritsa admin ko'radi, admin kiritsa shifokor ko'radi.

---

## 4. BEMOR WEBAPP — FLIP CARD (asosiy qism)

Hozirgi bron kartochkasi (rasmda: shifokor rasmi + ism + mutaxassislik + bron sanasi + Kutilmoqda/Qayta bron/Bekor tugmalari) — bu **OLD tomon**.

### Old tomon (mavjud + qo'shimcha):
- Hozirgi ko'rinish saqlanadi
- **Ish vaqti matni qo'shilsin** (doctor.workSchedule — masalan "Du-Ju 9:00-18:00")
- Kartochkada "ℹ️ ma'lumot" yoki aylantirish belgisi (foydalanuvchi bosib aylantirishni bilsin) — masalan burchakda kichik flip ikonkasi

### Orqa tomon (yangi — flip):
Kartochka bosilganda 3D aylanadi (Y o'qi bo'yicha) va orqa tomonida:
1. **Ta'lim** — education
2. **Mutaxassislik** — specialties[] (bir nechta, vergul yoki teglar bilan)
3. **Lavozimi** — position
4. **Qabul yo'nalishlari** — directions[] (ro'yxat yoki teglar)
5. **Tajriba** — experiences[] (har biri "Joy — 2018-2022" yoki "Joy — 2018-hozirgacha")
6. **Ish joylari** — workplaces[] (matn ro'yxat)
7. **Bo'limi** — department
8. **Operatsiyalar soni** — operationsCount

### Flip animatsiya (texnik):
- CSS `transform: rotateY(180deg)` + `transform-style: preserve-3d` + `backface-visibility: hidden`
- Old va orqa yuzalar absolute, bir-birining ustida
- Bosish (onClick) yoki kartochkadagi flip tugmasi bilan toggle (React state: `flipped`)
- Yumshoq `transition: transform 0.6s` (MyGov Road kabi tabiiy aylanish)
- Orqa tomon balandligi old tomonga moslashishi yoki scroll bo'lishi (ma'lumot ko'p bo'lsa)
- Mobil + desktop responsive (kartochka kengligi moslashuvchan)
- DIQQAT: tugmalar (Kutilmoqda/Bekor) old tomonda — flip qilganda ular bosilib ketmasin (orqa tomonda alohida "← orqaga" tugmasi)

### API:
- Bron ma'lumotini qaytaradigan mavjud endpoint'ga shifokor profil ma'lumotlarini qo'sh (include) YOKI alohida `GET /api/patient/doctor/[id]/profile` — bemor uchun PUBLIC ma'lumotlar (telefon, parol kabi maxfiy narsalar EMAS, faqat profil).
- Bo'sh maydonlar UI'da ko'rsatilmasin yoki "—" bilan (shifokor hali to'ldirmagan bo'lishi mumkin).

---

## 5. TEKSHIRUV (deploydan oldin)
- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0
- Migration DB'ga qo'llanildi (Supabase'da 3 yangi jadval + doctors yangi ustunlar)
- RLS: yangi jadvallar himoyalangan
- Flip animatsiya mobil + desktopda silliq
- Shifokor kabinet + admin panel ikkalasi ham ma'lumot kirita oladi
- `&apos;` ishlatilmagan

## 6. YAKUNDA HISOBOT
Quyidagilarni qaytar:
- Migration nomi + qaysi jadvallar yaratildi
- O'zgargan/yangi fayllar ro'yxati
- tsc / build / deploy natijalari (exit kodlari)
- Deploy commit hash
- Qaysi sahifalardan ma'lumot kiritiladi (URL/path)

---

## KEYINGI BOSQICHLAR (HOZIR EMAS — eslatma uchun)
1. Bron qabul qilish: shifokor o'z panelidagi bronlar ro'yxatida bronni "Qabul qildim" deb belgilaydi → kartochka holati yangilanadi.
2. Shifokor ID tizimi: EM000001 formatida har shifokorga unikal ID, telegram ID'ga bog'lash, kelajakda katta platforma integratsiyasi uchun.

Bularni HOZIR qilma — faqat FLIP-CARD-01 ni bajar.
