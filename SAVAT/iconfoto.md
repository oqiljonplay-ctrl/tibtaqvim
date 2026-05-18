# 🎯 VAZIFA: 2 ta UI bug'ini tuzatish

## LOYIHA KONTEKSTI

Stack: Next.js 14 (App Router) + Prisma + Supabase + Vercel + Telegram bot
Repo: oqiljonplay-ctrl/tibtaqvim
Production: https://tibtaqvim.vercel.app
Hozirgi holat: Service-Doctor M2M tizimi ishlamoqda. Webapp'da yangi xizmat kartochkasi shifokor ma'lumoti bilan ko'rinadi. Bot yangi flow bilan ishlaydi.

## ISHLAB CHIQARISHDA TOPILGAN 2 TA BUG

### 🔴 BUG #1 — Patient name input bloklangan (kritik)

Holat: Webapp "Qabulga yozilish" oqimida ism kiritish bosqichida bir harf yozgach klaviatura yana harf qabul qilmaydi. Tasdiq sahifasiga o'tilganda "patientName kamida 2 harf bo'lishi kerak" xatosi chiqadi.

Skrinshot dalili:
- Input field'da telegram user'ning ismidan default qiymat (masalan, "T") turadi
- Foydalanuvchi yozishga harakat qilganda — state yangilanmaydi yoki darhol overwrite bo'ladi
- Tasdiq sahifasida ism faqat "T" ko'rinadi va validation fail bo'ladi

Tashxis:
Quyidagilardan biri sabab bo'lishi mumkin (kodni o'qib aniq aniqla):
1. <input value={...}> controlled bo'lib, onChange handler state'ni yangilamasdan
2. useEffect har render'da value'ni Telegram user'ning ismiga qaytaradi
3. defaultValue o'rniga value ishlatilgan lekin onChange yo'q
4. State'ni global Zustand/Context'dan oladi va lokal yozish bloklangan

Tuzatish strategiyasi:
1. src/app/webapp/ papkasini qidir — ism kiritish input qaerda
2. Ehtimoliy fayl: src/app/webapp/book/page.tsx, src/app/webapp/book/[step]/page.tsx, yoki shunga o'xshash
3. Quyidagi pattern'ni qidir: placeholder="Ism" yoki Telefon raqamingizni kiriting (Skrinshot #3 da ko'rinadi)
4. Aniqla — bu 3-qadam (telefon kiritish) emas, 4-qadam yoki keyingi (ism kiritish) ekanini
5. Skrinshot #3 da ko'rinadi: "Telefon raqamingizni kiriting" sahifasi — bu ham xuddi shu bug

Yechim:
// XATO PATTERN:
<input 
  value={user?.firstName || ''}  // ← Telegram'dan keladi
  onChange={(e) => setName(e.target.value)}
  // Lekin useEffect baribir user.firstName ga qaytaradi
/>

// TO'G'RI PATTERN:
const [patientName, setPatientName] = useState(user?.firstName || '');

useEffect(() => {
  // Faqat birinchi render'da Telegram'dan default qo'y
  if (!patientName && user?.firstName) {
    setPatientName(user.firstName);
  }
}, []); // ← MUHIM: dependency BO'SH bo'lishi kerak ([user] EMAS)

<input 
  value={patientName}
  onChange={(e) => setPatientName(e.target.value)}
  placeholder="Ism Familiya"
  minLength={2}
/>
Yoki Zustand/Context ishlatilgan bo'lsa:
const { patientName, setPatientName } = useBookingStore();

useEffect(() => {
  if (!patientName && telegramUser?.firstName) {
    setPatientName(telegramUser.firstName);
  }
}, []); // dependency BO'SH

<input 
  value={patientName}
  onChange={(e) => setPatientName(e.target.value)}
/>
⚠️ KRITIK: Telefon kiritish sahifasida ham xuddi shu bug bor (Skrinshot #3 da ko'rsatilgan — input'da faqat "T" turadi). Telefon input ham xuddi shunday tuzatilishi kerak. Ehtimol ikkalasi ham bitta umumiy komponent yoki o'xshash logikaga ega.

---

### 🟡 BUG #2 — Webapp shifokor avatar juda kichik

Holat: Webapp service kartochkasida shifokor avatar yonidagi service icon (emoji)'dan kichik ko'rinadi. Vizual disbalans.

Skrinshot dalili (Skrinshot #1, #5):
- Service emoji (chap tomondagi katta icon, masalan, shifokor figurasi): ~40-48px
- Shifokor avatar (kasb — ism qatori yonidagi yumaloq foto): ~20-24px
- Foydalanuvchi: "Shifokor rasmidan ko'ra yonidagi ikonka juda katta. Rasm katta bo'lishi kerak."

Tashxis:
src/components/DoctorCard.tsx da size="sm" ishlatilgan. Bu webapp service kartochkasi uchun juda kichik.

Yechim — 2 variant (siz tanlang yoki kombinatsiya):

Variant A — DoctorCard size="md" ishlatish (oson)

src/app/webapp/page.tsx (yoki webapp'ning service list sahifasi) ichida:

// ESKI:
<DoctorCard doctor={doctor} size="sm" />

// YANGI:
<DoctorCard doctor={doctor} size="md" />
`md` = w-12 h-12 = 48px (service icon bilan teng).
Variant B — Yangi "webapp" size qo'shish (yaxshiroq)

src/components/DoctorCard.tsx da sizeClasses ni kengaytirish:

const sizeClasses = {
  sm: { img: 'w-8 h-8', text: 'text-sm' },
  md: { img: 'w-12 h-12', text: 'text-base' },
  lg: { img: 'w-16 h-16', text: 'text-lg' },
  // YANGI:
  webapp: { img: 'w-10 h-10', text: 'text-sm' },  // 40px — service icon bilan deyarli teng
};
Va webapp'da size="webapp" ishlat.

Tavsiya: Variant A — eng oddiy va to'g'ri.

⚠️ MUHIM eslatma: Bu o'zgartirish faqat webapp uchun bo'lsin. Bot tasdiqlash xabaridagi va admin panelidagi DoctorCard hozirgidek qolsin (sm yoki lg). Faqat service list kartochkalari uchun md qiling.

---

## ⚠️ MUHIM QOIDALAR

1. Avval kontekstni tushun:
   - src/app/webapp/ papkasini ko'r
   - Webapp'ning booking flow'i qaysi fayllarda ekanini aniqla
   - src/components/DoctorCard.tsx ni qayta o'qi

2. Bitta bug — bitta fayl o'zgartirish:
   - BUG #1 uchun: input bo'lgan fayl(lar)ni tuzat
   - BUG #2 uchun: faqat webapp service list sahifasini tuzat

3. Hech narsa o'chirma:
   - Mavjud styling, validation, classNames — saqlanadi
   - Faqat aniq xato pattern'ni almashtirish

4. Test: Lokal'da npm run dev bilan sinab ko'rish ham mumkin (ixtiyoriy)

5. Commit:
   - BUG #1 uchun: fix(webapp): patient name and phone input — controlled state, no overwrite
   - BUG #2 uchun: fix(webapp): doctor card size md in service list for visual balance

   Yoki bitta commit: fix(webapp): input state overwrite + doctor card size

6. TypeScript strict: Hech qaerda any yo'q, tip belgilash to'liq.

7. Eskini buzma: Avtomatik default qiymat (Telegram user'dan) saqlanishi kerak — faqat foydalanuvchi yozganda overwrite bo'lmaslik.

---

## 📋 ISHLATISH TARTIBI

### Qadam 1 — Tashxis
1. find src/app/webapp -name "*.tsx" ishga tushir — fayllar ro'yxati
2. Har bir fayldagi <input> elementlarini qidir
3. value va onChange pattern'larini tahlil qil
4. Bug qaysi faylda ekanini aniqla

### Qadam 2 — Tuzatish #1
1. Topilgan fayl(lar)dagi input state mantig'ini yuqorida ko'rsatilgan to'g'ri pattern bilan almashtir
2. Telefon input ham xuddi shunday bo'lsa, uni ham tuzat

### Qadam 3 — Tuzatish #2
1. Webapp service list sahifasini top (src/app/webapp/page.tsx yoki src/app/webapp/book/page.tsx boshlanishi)
2. <DoctorCard ... size="sm" /> ni size="md" ga almashtir
3. Faqat webapp service list kartochkalarida — boshqa joyda emas

### Qadam 4 — Verifikatsiya
1. npm run build — TypeScript xatolari yo'qmi
2. Lokal test (ixtiyoriy)
3. git diff — faqat kerakli o'zgarishlar borligini tasdiqla

### Qadam 5 — Commit + Push
git add .
git commit -m "fix(webapp): input state overwrite bug + doctor card size"
git push
### Qadam 6 — Foydalanuvchidan tasdiqlash so'ra
"Tuzatishlar tayyor. Production deploy bo'lgach Telegram'da webapp'ni qayta sinab ko'ring:
1. /start
2. Yangi bron qilish
3. Xizmat tanlang (shifokor avatar kattaroq bo'lishi kerak)
4. Telefon va ism kiriting (bloklash bo'lmasligi kerak)
5. Tasdiqlash sahifasiga oxirigacha o'ting"

---

## 🚀 BOSHLA

Hozir src/app/webapp/ papkasini ko'r va keling boshlasak.