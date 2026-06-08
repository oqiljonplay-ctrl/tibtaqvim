# TIBTAQVIM — BROADCAST UX SODDALASHTIRISH (YAKUNIY ISH)

> To'liq ish prompti. 4 faza ketma-ket. Har faza oxirida build+lint test va
> qisqa hisobot. Fazalararo to'xtamasdan davom et (noaniqlikda TO'XTA, SO'RA).
> Yakunda deploy. Maqsad: admin/superadmin ishini RADIKAL soddalashtirish.

---

## 0. NIMA UCHUN BU ISH (muammoning ildizi)

Broadcast tizimi texnik jihatdan ISHLAYDI (cron, send-now, clinic_admin
sahifasi, myChatMember — hammasi bor). LEKIN ishlatib bo'lmaydi, chunki
foydalanuvchidan ICHKI texnik tushunchalarni biladi deb kutilyapti:

Hozirgi holat (DB tasdiqladi):
- 1 kanal: scope=`platform`, clinicId=`null`
- 1 kampaniya: targetType=`own`, status=active
- ad_campaign_channels: **0 link**, ad_posts: **0 post**
- Hech narsa yuborilmagan.

Hozir foydalanuvchidan talab qilinayotgan QO'LDA qadamlar (NOQULAY):
1. Kanalni "Tahrir" → scope=platform'ni scope=clinic'ga o'zgartir + klinika ID tanla
2. Kampaniyani "Tahrir" → kanallarni qayta tanla
3. "Hozir yuborish"

MUAMMO: oddiy admin `scope`, `targetType`, `platform vs clinic`, `clinicId`
nималигини BILMAYDI va bilishi SHART EMAS. U faqat shuni xohlaydi:
**"Mana shu xabarni, mana shu guruhga yubor."** Tamom.

BU ISHNING MAQSADI: shu texnik tushunchalarni foydalanuvchidan YASHIRISH va
oqimni "xabar yoz → guruh tanla → yubor" ga aylantirish.

---

## QARORLAR (men, loyiha egasi, tasdiqladim)

1. **`scope`/`targetType`/`clinicId` foydalanuvchiga KO'RSATILMAYDI.** Bular
   backend'da avtomatik to'g'ri qo'yiladi. UI'da bu so'zlar umuman chiqmasin.
2. **Kanal qo'shilganda scope AVTOMATIK to'g'ri bo'ladi:**
   - super_admin qo'shsa → platform (umumiy)
   - clinic_admin qo'shsa → clinic + o'z clinicId (avtomatik)
   - myChatMember (botni guruhga admin qilish) orqali kelsa → qo'shgan odam
     roli bo'yicha avtomatik (allaqachon qisman bor — tekshir/tugat).
3. **Kampaniya yaratishda kanal tanlash SHU FORMADA bo'ladi** (alohida
   "tahrirlash" qadami EMAS). Forma: xabar + rasm + kanal(lar) tanlash +
   sana → saqlash. Saqlanганда ad_campaign_channels DARHOL to'ldiriladi.
4. **targetType avtomatik:** kampaniya yaratgan odam super_admin bo'lsa
   platform kanallar ham, clinic_admin bo'lsa o'z klinikasi kanallari
   ko'rsatiladi. "own/platform" tanlovi UI'dan OLIB TASHLANADI.
5. **Mavjud nomuvofiq ma'lumotni avtomatik tuzatish:** migratsiya yoki
   send-now ichida — agar kampaniyada 0 kanal bo'lsa va mos keladigan
   (yuboriladigan) kanallar mavjud bo'lsa, ularni avtomatik bog'lash YOKI
   foydalanuvchiga bitta tugma bilan "shu guruhga yubor" taklif qilish.
6. **Hozirgi qilingan ishlar (send-now, broadcast sahifa, clinic_admin API)
   O'CHIRILMAYDI** — ular ustiga UX qatlam quriladi. Faqat soddalashtirish.

---

## FAZA 1 — KAMPANIYA YARATISH FORMASINI SODDALASHTIRISH

### 1.1 Kanal tanlash formaga kiritiladi
`src/app/admin/super/ads/page.tsx` (va clinic_admin broadcast sahifasi) —
"Kampaniya yaratish" formasiga **kanal tanlash (checkbox/multiselect)** qo'sh:
- Foydalanuvchi rolига qarab YUBORISH MUMKIN bo'lgan kanallar ro'yxati
  ko'rsatiladi (super_admin → barcha faol kanallar; clinic_admin → o'z
  klinikasi kanallari + platform kanallar agar ruxsat bo'lsa).
- Har kanal yonida: nomi, turi (📢 kanal / 👥 guruh), a'zolar soni (bor bo'lsa),
  bot admin holati (✅ tayyor / ⚠️ bot admin emas).
- Kamida 1 kanal tanlanmasa — "Saqlash" tugmasi bloklanadi + tushunarli
  xabar: "Kamida bitta kanal yoki guruh tanlang."

### 1.2 targetType/scope UI'dan olib tashlanadi
- Formada "own/platform", "scope", "clinicId" tanlash maydonlari BO'LSA —
  OLIB TASHLA. Foydalanuvchi bularni ko'rmaydi.
- Backend (POST /api/admin/ad-campaigns) targetType ni avtomatik aniqlaydi:
  yaratuvchi super_admin → platform, clinic_admin → own + o'z clinicId.

### 1.3 Saqlashda kanal bog'lash DARHOL
- Kampaniya POST endpoint kanal ID massivini qabul qiladi va
  `ad_campaign_channels` ga shu zahoti yozadi (transaction).
- Tekshir: hozir bu endpoint kanal ID qabul qiladimi? Qilmasa — qo'sh.
- Natijada YANGI kampaniya HECH QACHON "0 kanal" holatida qolmaydi.

### 1.4 FAZA 1 TEST
- `npm run build` exit 0, `tsc --noEmit` exit 0.
- Yangi kampaniya yaratilганда ad_campaign_channels darhol to'ladi
  (mantiqiy tekshiruv yoki test yozuv).
- HISOBOT: forma o'zgarishi, olib tashlangan maydonlar, endpoint o'zgarishi.

---

## FAZA 2 — KANAL QO'SHISHNI SODDALASHTIRISH (eng muhim qulaylik)

### 2.1 "Kanal qo'shish" oqimi — 2 yo'l, ikkalasi ham oson

**Yo'l 1 — Avtomatik (TAVSIYA, asosiy):** Botni guruh/kanalga admin qilish.
- UI'da aniq yo'riqnoma: "1) Botni (@bot_username) guruhingizga qo'shing
  2) Admin qiling 3) Bu yerda avtomatik paydo bo'ladi."
- myChatMember handler (allaqachon bor) botni admin qilingan guruhni
  avtomatik `ad_channels` ga yozadi, scope/clinicId qo'shgan odam roli
  bo'yicha AVTOMATIK. Buni TEKSHIR va to'liq ishlashiga ishonch hosil qil.
- chatId, title, username, memberCount, type — getChat orqali avtomatik.

**Yo'l 2 — Qo'lda (zaxira):** username/link orqali qo'shish.
- Foydalanuvchi `@username` yoki `t.me/...` kiritadi.
- Backend getChat bilan chatId/title/type ni avtomatik oladi.
- scope/clinicId AVTOMATIK (roli bo'yicha) — foydalanuvchi tanlamaydi.

### 2.2 Bot admin holati ko'rsatkichi
- Har kanal kartasida REAL VAQT holat: bot o'sha kanalda admin'mi?
  getChatMember(chatId, botId) → status='administrator' tekshir.
- ✅ "Tayyor — yuborish mumkin" yoki ⚠️ "Bot admin emas — guruhda botni
  admin qiling" (tushunarli yo'riqnoma bilan).
- Bu yuborishdan OLDIN muammoni ko'rsatadi (keyin "chiqmadi" bo'lmaydi).

### 2.3 Eski nomuvofiq kanalni avtomatik moslash
- Mavjud scope=platform, clinicId=null kanal (rasмdagi "Buyuk tabib guruhi")
  — bu super_admin qo'shgan, demak platform to'g'ri. LEKIN kampaniya own
  edi. Faza 1 dан keyin super_admin kampaniyasi platform kanallarni
  ko'radi → muammo hal. Qo'shimcha migratsiya SHART EMAS, lekin tekshir:
  super_admin kampaniya formasi platform kanallarni ko'rsatadimi.

### 2.4 FAZA 2 TEST
- `npm run build` exit 0, `tsc --noEmit` exit 0.
- Bot admin holati to'g'ri ko'rsatiladi (mantiqiy tekshiruv).
- HISOBOT: kanal qo'shish 2 yo'li, bot admin ko'rsatkich, myChatMember holati.

---

## FAZA 3 — "YUBORISH" OQIMINI BIR TUGMAGA KELTIRISH

### 3.1 Yagona aniq "Yuborish" tajribasi
- Har kampaniya kartasida YAGONA katta tugma: "📤 Hozir yuborish".
- Bosilganda: tasdiqlash modali — "Bu xabar N ta kanalga yuboriladi:
  [kanallar ro'yxati]. Davom etasizmi?" → Ha/Yo'q.
- Yuborilgach RESULT modal: har kanal uchun ✅ yuborildi / ❌ xato (sabab
  bilan, masalan "bot admin emas"). ad_posts dan o'qiladi.
- send-now endpoint allaqachon bor — uni shu UX ga ula. Bot admin
  tekshiruvi, throttle (3s) saqlanadi.

### 3.2 Avtomatik (rejalashtirilgan) yuborish HOLATI ko'rinishi
- Kampaniya kartasi ko'rsatsin: "Keyingi avtomatik yuborish: [sana/vaqt]"
  yoki "Faqat qo'lda" — foydalanuvchi cron qachon ishlashini bilsin.
- Agar daily cron bo'lsa — buni aniq yoz, "yozdim chiqmadi" chalkashligi
  bo'lmasin. "Darhol yuborish uchun '📤 Hozir yuborish' tugmasini bosing."

### 3.3 Statistika qisqa
- Kampaniya kartasida: nechta kanalga, nechta marta yuborilgan, oxirgi
  yuborish vaqti, oxirgi natija (muvaffaqiyat/xato soni). ad_posts dan.

### 3.4 FAZA 3 TEST
- `npm run build` exit 0.
- "Hozir yuborish" tugma → tasdiqlash → result oqimi ishlaydi.
- HISOBOT: yuborish oqimi, holat ko'rsatkichlari.

---

## FAZA 4 — CLINIC_ADMIN UCHUN BIR XIL QULAYLIK

### 4.1 clinic_admin ham xuddi super_admin kabi oson
- clinic_admin broadcast sahifasi (`/admin/(panel)/broadcast`) — hozir
  "Kampaniyalar" read-only emish. Buni TO'LIQ qil:
  - O'z klinikasi kanallarini qo'sha oladi (Faza 2 oqimi).
  - O'z kampaniyasini yarata oladi (Faza 1 formasi).
  - "Hozir yuborish" qila oladi (Faza 3).
- HAMMA narsa o'z klinikasi doirasida (clinicId avtomatik, ko'rinmaydi).

### 4.2 Ruxsat chegarasi (xavfsizlik)
- clinic_admin faqat O'Z klinikasi kanal/kampaniyalarini ko'radi va
  boshqaradi. Boshqa klinika yoki platform kanalga yubora OLMAYDI
  (agar super_admin ruxsat bermagan bo'lsa). Backend'da clinicId tekshiruvi
  MAJBURIY (mavjud pattern'ga amal qil).

### 4.3 FAZA 4 TEST
- `npm run build` exit 0.
- clinic_admin to'liq oqimni bajara oladi (yaratish→kanal→yuborish).
- Auth: clinic_admin boshqa klinika kanaliga kira olmaydi.
- HISOBOT: clinic_admin imkoniyatlari, ruxsat tekshiruvi.

---

## DIZAYN TALABI (barcha fazalar)
- Mavjud admin panel stiliga MOS (sidebar, kartochkalar, ranglar).
- Yengil gradiyent/liquid bezaklar (clinic_promotions dropdown uslubiga
  hamohang) — lekin admin panel jiddiyligini saqla, ortiqcha emas.
- Bot admin holati: yashil ✅ / amber ⚠️ — aniq, tushunarli.
- Responsive (MAJBURIY): src/components/layout/ primitivlari, 360px→desktop.
- Til: o'zbek. Texnik atamalar (scope, targetType) FOYDALANUVCHIGA
  ko'rsatilmaydi — faqat "kanal", "guruh", "umumiy", "klinika kanali".

---

## QAT'IY CHEGARALAR — BUZMASLIK SHART
1. clinic_promotions (Telegram widget dropdown) — TEGMA, u alohida tizim,
   tugadi.
2. Login/auth/JWT/middleware — TEGMA.
3. Bron/slot/navbat/narx/queueMode — TEGMA.
4. Webapp bemor tomoni (dashboard, my-clinics, booking) — TEGMA.
5. Mavjud send-now endpoint, myChatMember handler, cron — O'CHIRMA, faqat
   ustiga UX qur / to'ldir / soddalashtir.
6. ad_channels/ad_campaigns/ad_posts/ad_campaign_channels SXEMASI — agar
   o'zgartirish KERAK bo'lsa (masalan yangi maydon), avval menga ayt,
   TO'XTA. Sxemaga o'zaboshimchalik bilan tegma.
7. Telegram bot token (env) — o'zgartirma, mavjudini ishlat.
8. Noaniqlik (endpoint nomi, auth helper, cron jadvali) — avval MAVJUD
   kodni o'qib aniqla. Topa olmasang TO'XTA, SO'RA. TAXMIN QILMA.
9. `any` ishlatma. RLS yangi jadval bo'lsa payments pattern'iga mos.
10. Lokal `npm run build` exit 0 har fazada MAJBURIY.

---

## YAKUNIY DEPLOY (4 faza tugagach)
- `git add -A`
- `git commit -m "feat(broadcast): UX soddalashtirish — kanal tanlash formada, scope/targetType avtomatik, bot admin holati, clinic_admin to'liq oqim"`
- `git push` → Vercel avtomatik deploy → READY tasdiqlansin.

## YAKUNIY HISOBOT
1. Har faza: o'zgargan fayllar, qisqa natija.
2. UX OLDIN→KEYIN: avval foydalanuvchi nechta qadam/texnik tushuncha
   bilishi kerak edi, endi nechta. (Maqsad: "xabar yoz→kanal tanla→yubor".)
3. scope/targetType endi ko'rinmasligini tasdiqla.
4. clinic_admin va super_admin ikkalasi ham to'liq oqimni bajara olishini
   tasdiqla.
5. git diff --stat — chegaralar (1-10) buzilmagani.
6. Commit SHA + Vercel READY.
7. Amaliy test: 1 ta kampaniya yaratib (kanal tanlab), "Hozir yuborish"
   bilan haqiqiy guruhga yuborib ko'r — natija (✅/❌ sabab) hisobotda.

KOD SIFATLI, TOZA. Maqsad — admin/superadmin uchun RADIKAL qulaylik.
Har faza oxirida hisobot. Yakunda deploy.
