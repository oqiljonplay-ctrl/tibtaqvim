# 📢 Reklama Kampaniyalari — Arxitektura + Reja
## Kanal/guruhlarga aylanma klinika reklamasi (monetizatsiya)

> Dizayn hujjati. O'qib tasdiqlang, keyin VS Code Claude uchun kodli prompt yoziladi.

---

## 1. MAQSAD VA MODEL

**Biznes model**: Klinikalar oylik paket (subscription) doirasida reklama xizmatidan foydalanadi. Ikki xil joy:
1. **O'z kanali** — klinika o'z Telegram kanaliga reklama qiladi (o'z obunachilariga)
2. **Umumiy kanal** — platforma kanal(lar)ida klinikalar **navbat bilan** ko'rinadi (qo'shimcha auditoriya)

**Tasdiqlangan tanlovlar (2026-05-22)**:
- Model: **C — ikkalasi ham** (o'z kanali + umumiy kanalda navbat)
- Kanal boshqaruvi: **aralash** — klinika o'z kanalini ulaydi, platforma umumiy kanalni boshqaradi
- Reklama joyi: **kanal/guruhlar** (bot ichki chatga emas — navbat tizimi himoyalangan)
- Mazmun: **faqat tibbiy/foydali**, matnni **super_admin** (siz) yozadi
- To'lov: **oylik paket ichida** (alohida billing yo'q — `subscriptionPlan` ga bog'liq)
- Opt-in: **kerak emas** (kanal obunachilari o'zlari rozi)

**Paket darajalari** (mavjud `SubscriptionPlan` enum'iga mos):
| Paket | O'z kanaliga reklama | Umumiy kanalda navbat |
|---|---|---|
| **starter** | ✅ | ❌ |
| **standard** | ✅ | ✅ (oyiga 3 kun) |
| **premium** | ✅ | ✅ (oyiga 7 kun) |

> Bu faqat tavsiya — paket qoidalarini keyin sozlash mumkin. Asosiysi: kod ikkala kanal turini ham qo'llab-quvvatlaydi.

---

## 2. ASOSIY TUSHUNCHALAR

```
KLINIKA reklama buyuradi
   │
   ▼
KAMPANIYA yaratiladi (super_admin)
   - qaysi klinika
   - matn + rasm
   - boshlanish/tugash sanasi (3-7 kun)
   - qaysi kanal/guruhlarga
   │
   ▼
JADVAL (navbat) — har klinika o'z navbatida
   │
   ▼
BOT avtomatik post qiladi (cron)
   - belgilangan kanal/guruhlarga
   - kuniga 1 marta (yoki sozlangan chastota)
   │
   ▼
STATISTIKA — nechta post, qaysi kanal, qachon
```

---

## 3. YANGI DB MODELLARI

### 3.1 — `ad_channels` (bot admin bo'lgan kanal/guruhlar)

```prisma
model AdChannel {
  id           String   @id @default(cuid())
  title        String                    // "Toshkent Salomatlik kanali"
  chatId       String   @unique          // Telegram chat_id (-100xxxx kanal, -xxxx guruh)
  type         String                    // "channel" | "group"
  username     String?                   // @kanalusername (ixtiyoriy)
  memberCount  Int?                       // taxminiy obunachilar (statistika)

  // EGALIK — eng muhim maydon (C model uchun)
  scope        AdChannelScope @default(clinic)  // "clinic" (o'z kanali) | "platform" (umumiy)
  clinicId     String?                    // scope=clinic bo'lsa: qaysi klinikaники; platform bo'lsa null
  addedById    String                     // kim uladi (clinic_admin yoki super_admin)

  isActive     Boolean  @default(true)
  addedAt      DateTime @default(now())

  clinic       Clinic?  @relation(fields: [clinicId], references: [id])
  posts        AdPost[]
  campaigns    AdCampaignChannel[]

  @@index([scope])
  @@index([clinicId])
  @@map("ad_channels")
}

enum AdChannelScope {
  clinic       // klinikaning o'z kanali (faqat o'z reklamasi)
  platform     // platforma umumiy kanali (klinikalar navbat bilan)
}
```

**Egalik mantiq'i**:
- `scope = clinic` + `clinicId = X` → X klinikaning **o'z kanali**. Faqat X ning reklamasi chiqadi. clinic_admin o'zi ulaydi.
- `scope = platform` + `clinicId = null` → **umumiy kanal**. Klinikalar navbat bilan. super_admin ulaydi va boshqaradi.

### 3.2 — `ad_campaigns` (reklama kampaniyalari)

```prisma
model AdCampaign {
  id            String   @id @default(cuid())
  clinicId      String                    // qaysi klinika reklama qilinmoqda
  title         String                    // ichki nom: "BUYUK TABIB - May aksiya"
  adText        String                    // reklama matni (super_admin yozadi)
  imageUrl      String?                   // rasm (Supabase Storage)
  buttonText    String?                   // tugma matni: "Navbat olish"
  buttonUrl     String?                   // tugma havolasi (bot deep-link yoki web)

  // KAMPANIYA TURI (C model)
  targetType    AdTargetType @default(own)  // "own" (o'z kanali) | "platform" (umumiy navbat)

  startDate     DateTime                  // boshlanish
  endDate       DateTime                  // tugash
  frequency     String   @default("daily") // "daily" | "twice_daily"

  status        AdCampaignStatus @default(scheduled)
  priority      Int      @default(0)       // platform navbatда tartib

  createdById   String                     // kim yaratdi (super_admin)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  clinic        Clinic   @relation(fields: [clinicId], references: [id])
  posts         AdPost[]
  channels      AdCampaignChannel[]        // qaysi kanallarga

  @@index([clinicId])
  @@index([status, startDate])
  @@index([targetType, status])
  @@map("ad_campaigns")
}

enum AdCampaignStatus {
  draft        // qoralama
  scheduled    // rejalashtirilgan
  active       // hozir aylanmoqda
  completed    // tugagan
  cancelled    // bekor qilingan
}

enum AdTargetType {
  own          // klinikaning o'z kanaliga (navbatsiz, doimiy davr ichida)
  platform     // umumiy kanalga (navbat bilan, paketga qarab kun soni)
}
```

**Ikki kampaniya turi**:
- `targetType = own` → klinikaning **o'z kanaliga** (scope=clinic kanallarga). Navbat yo'q — davr ichida har kuni chiqaveradi.
- `targetType = platform` → **umumiy kanalga** (scope=platform). Navbat bilan — paket kun soniga qarab (standard 3 kun, premium 7 kun).

### 3.3 — `ad_campaign_channels` (kampaniya ↔ kanal M2M)

```prisma
model AdCampaignChannel {
  id          String   @id @default(cuid())
  campaignId  String
  channelId   String

  campaign    AdCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  channel     AdChannel  @relation(fields: [channelId], references: [id], onDelete: Cascade)

  @@unique([campaignId, channelId])
  @@map("ad_campaign_channels")
}
```

### 3.4 — `ad_posts` (yuborilgan postlar — statistika va takrorlamaslik)

```prisma
model AdPost {
  id           String   @id @default(cuid())
  campaignId   String
  channelId    String
  messageId    String?                    // Telegram message_id (o'chirish/edit uchun)
  status       String                     // "sent" | "failed"
  errorText    String?
  sentAt       DateTime @default(now())

  campaign     AdCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  channel      AdChannel  @relation(fields: [channelId], references: [id])

  @@index([campaignId])
  @@index([sentAt])
  @@map("ad_posts")
}
```

> `AdChannel` modeliga `posts AdPost[]` va `campaigns AdCampaignChannel[]` reverse relation; `Clinic` modeliga `adCampaigns AdCampaign[]` qo'shiladi.

---

## 4. KANAL/GURUHNI BOTGA ULASH OQIMI (aralash)

### 4.1 — Bot admin bo'lishi
1. Bot kanal/guruhga **admin** qilib qo'shiladi
2. Adminlik huquqi: **Post yuborish** (kanal), **Xabar yuborish** (guruh)

### 4.2 — Kim qaysi kanalni ulaydi
- **Klinika o'z kanali** (`scope=clinic`): clinic_admin o'z kanalini ulaydi
  - clinic_admin botni o'z kanaliga admin qiladi
  - Bot `my_chat_member` orqali sezadi → lekin **qaysi klinikaники** ekanini bilish kerak
  - Yechim: clinic_admin panelда "Kanalni ulash" → bot deep-link/kod beradi → kanalga admin qilingач bog'lanadi (clinicId = o'sha admin klinikasi)
- **Platforma umumiy kanali** (`scope=platform`): super_admin ulaydi
  - super_admin botni umumiy kanalga admin qiladi
  - super_admin panelда `scope=platform` belgilaydi

### 4.3 — Avtomatik aniqlash
Bot kanalga admin qilinganда `my_chat_member` update keladi. Bot:
1. Kanalni vaqtinchalik "kutilmoqda" holatда saqlaydi
2. Kim ulaganini aniqlash: agar clinic_admin deep-link orqali ulagan bo'lsa → `scope=clinic, clinicId=X`; super_admin ulasa → `scope=platform`

> Soddalik uchun MVP: **qo'lda** ham bo'ladi — panelда chatId + scope + clinicId kiritiladi. Avtomatik aniqlash Sprint B'da.

---

## 5. AYLANMA JADVAL (navbat)

**Logika**:
- Har kampaniyada `startDate` va `endDate` bor
- Cron har kuni ishlaydi (`/api/cron/ad-broadcast`)
- `status = active` va `startDate <= bugun <= endDate` bo'lgan kampaniyalarni topadi
- Har biri uchun belgilangan kanallarga post qiladi
- `ad_posts`ga yozadi (bugun yuborilgan bo'lsa qayta yubormaydi)

**Navbat (oylik aylanma)**:
- super_admin har klinikaga sana belgilaydi (masalan BUYUK TABIB 1-7 may, SHIFO 8-14 may...)
- `priority` orqali bir kunda bir nechta bo'lsa tartib

**Chastota**:
- `daily` — kuniga 1 marta (tavsiya)
- `twice_daily` — kuniga 2 marta (ertalab + kechqurun)

---

## 6. TEXNIK QISMLAR

| # | Qism | Fayl |
|---|---|---|
| 1 | DB modellar + migration | schema.prisma |
| 2 | Storage bucket `ad-images` (public) | Supabase (Claude) |
| 3 | Kanal avtomatik qo'shish (my_chat_member) | webhook/telegram |
| 4 | Kampaniya CRUD API | `/api/admin/ad-campaigns` |
| 5 | Kanal ro'yxati API | `/api/admin/ad-channels` |
| 6 | Cron broadcast | `/api/cron/ad-broadcast` |
| 7 | Telegram post helper (throttle) | `bot/ad-broadcast.ts` |
| 8 | super_admin UI (kampaniya/kanal) | `/admin/super/ads` |
| 9 | Statistika (qancha post) | `/api/admin/ad-stats` |

---

## 7. TELEGRAM TEXNIK NUANSLAR

### 7.1 — Kanalga post
```
POST https://api.telegram.org/bot<TOKEN>/sendPhoto
  chat_id: <channel_chat_id>
  photo: <imageUrl>
  caption: <adText>
  parse_mode: HTML
  reply_markup: { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] }
```

### 7.2 — Throttling (spam himoyasi)
- Kanallarga post: **20 post/daqiqa** xavfsiz
- Har post orasida **3 soniya** kutish
- 429 error (`retry_after`) bo'lsa — kutib qayta urinish

### 7.3 — Bot admin tekshiruvi
Post qilishdan oldin `getChatMember` bilan bot hali admin ekanini tekshirish (admin chiqarib yuborilgan bo'lishi mumkin).

### 7.4 — Cron
- Vercel Cron (`vercel.json`'da `crons`)
- Kuniga 1-2 marta belgilangan vaqtда
- `CRON_SECRET` bilan himoyalangan (allaqachon bor)

---

## 8. RUXSATLAR (aralash model)

| Amal | super_admin | clinic_admin | branch_admin |
|---|---|---|---|
| O'z kanalini ulash (scope=clinic) | ✅ (har klinikaga) | ✅ (o'z klinikasiga) | ❌ |
| Umumiy kanal ulash (scope=platform) | ✅ | ❌ | ❌ |
| Kampaniya yaratish (matn) | ✅ (siz yozasiz) | ❌ | ❌ |
| O'z kanali kampaniyasi (own) | ✅ | ko'rish (ixtiyoriy) | ❌ |
| Umumiy navbat (platform) | ✅ | ❌ | ❌ |
| Statistika | ✅ barcha | o'z klinikasi | ❌ |

> **Matnni har doim super_admin (siz) yozadi** — tibbiy mazmun nazorati uchun. clinic_admin faqat o'z kanalini **ulaydi**, lekin reklama matnini **yozmaydi** (siz yozasiz).

> **To'lov** — `clinic.subscriptionPlan` ga bog'liq. starter → faqat own; standard → own + platform (3 kun); premium → own + platform (7 kun). Alohida billing yo'q, paket ichida.

---

## 9. ⚠️ XAVF VA HIMOYA

1. **Bot admin emasligi** → post oldidan tekshirish, xato bo'lsa `ad_posts.status=failed`
2. **Telegram rate limit** → throttle + retry_after
3. **Kanal o'chirilishi** → 403 bo'lsa `ad_channels.isActive=false`
4. **Reklama mazmuni** → faqat super_admin tasdiqlaydi (tibbiy/foydali)
5. **Bot ichki chatга yuborilmaydi** → navbat tizimi himoyalangan

---

## 10. BOSQICHLAR

| Sprint | Nima |
|---|---|
| **A** | DB modellar + migration + Storage bucket |
| **B** | Kanal avtomatik qo'shish (my_chat_member webhook) |
| **C** | Kampaniya CRUD API + super_admin UI |
| **D** | Cron broadcast + Telegram post helper (throttle) |
| **E** | Statistika + monitoring |

---

## 11. ✅ HAMMA QAROR TASDIQLANGAN

- Model: **C** (o'z kanali + umumiy navbat)
- Kanal: **aralash** (clinic_admin o'z kanali, super_admin umumiy)
- Matn: **super_admin yozadi**
- To'lov: **oylik paket ichida** (`subscriptionPlan`)
- Opt-in: yo'q (kanal obunachilari)

## 12. BOSHLASH

Butun feature, 5 sprint tartibida:
1. **Sprint A** — DB modellar (4 jadval + 3 enum) + migration + Storage bucket `ad-images`
2. **Sprint B** — Kanal ulash (clinic_admin o'z kanali, super_admin umumiy, my_chat_member)
3. **Sprint C** — Kampaniya CRUD + super_admin UI (`/admin/super/ads`)
4. **Sprint D** — Cron broadcast + Telegram post helper (throttle, retry, own vs platform)
5. **Sprint E** — Statistika + paket cheklovlari (starter/standard/premium)

**Tartib**: Sprint A (DB) dan boshlanadi. Har sprint alohida commit. Claude migration'larni Supabase'da apply qiladi.

Keyingi qadam: men **Sprint A** uchun to'liq kodli prompt yozaman (VS Code Claude uchun). Tayyormisiz?
