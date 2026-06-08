# TASK: CLINIC-CURRENT-01 — Tanlangan klinikani DB'da doimiy saqlash

## MUAMMO (rasmlar ketma-ketligidan tasdiqlangan)
Bemor "Mening klinikalarim" sahifasidan Test klinikaga o'tdi (Tanlash tugmasi) → bronlar to'g'ri ko'rindi ✅. LEKIN botdan chiqib qayta kirganda → BUYUK TABIB qaytib keldi ❌. Ya'ni klinika tanlovi sessiya orasida YO'QOLADI.

## SABAB
`users` jadvalida bemor uchun "tanlangan klinika" maydoni YO'Q. `user_clinics` jadvalida `isActive` bor (membership uchun), lekin "aynan HOZIR aktiv qaysi" tushunchasi yo'q. Tanlov faqat URL parametri yoki client state'da bo'lsa kerak — sessiya o'zgarganda yo'qoladi.

## FOYDALANUVCHI TALABI
Bemor klinika tanlasa, u **bir necha oy/yil** tepada turishi kerak — bot orqali qayta kirsa, brauzer kesh tozalasa, boshqa qurilmadan kirsa ham SHU klinika ko'rinsin. Faqat foydalanuvchi o'zi "Mening klinikalarim"dan boshqasini tanlaganda o'zgarsin.

---

## YECHIM — DB DARAJASIDA `isCurrent` FLAG

### 1. Prisma schema + migration

`user_clinics` jadvaliga 2 ta yangi maydon qo'sh:
```prisma
model UserClinic {
  // ... mavjud maydonlar ...
  isCurrent      Boolean   @default(false)   // shu user uchun HOZIR aktiv klinika
  lastSelectedAt DateTime?                    // oxirgi tanlangan vaqt (kelajakda muddat siyosati uchun)

  @@index([userId, isCurrent])  // tez topish uchun
}
```

DB qoidasi: HAR USER UCHUN faqat BITTA satrida `isCurrent = true` bo'lishi mumkin. Buni partial unique index bilan kafolatlash:
```sql
CREATE UNIQUE INDEX user_clinics_one_current_per_user
  ON user_clinics ("userId")
  WHERE "isCurrent" = true;
```

Bu index borligida 2 satr `isCurrent=true` qilib qo'yib bo'lmaydi — bitta user faqat bitta aktiv klinikaga ega bo'ladi.

### 2. Klinika tanlash mantiqi (transaction)

"Tanlash" tugmasi bosilganda yangi API yoki mavjud endpoint kengaytmasi:
`POST /api/webapp/clinics/[id]/select` (yoki shunga o'xshash mavjud)

Mantiq (transaction ichida):
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Avvalgi aktiv klinikani o'chir
  await tx.userClinic.updateMany({
    where: { userId, isCurrent: true },
    data: { isCurrent: false },
  });
  // 2. Yangisini belgila
  await tx.userClinic.update({
    where: { userId_clinicId: { userId, clinicId } },
    data: { isCurrent: true, lastSelectedAt: new Date() },
  });
});
```

Agar bemor bu klinikaga hali ulanmagan bo'lsa (user_clinics'da yozuv yo'q) — upsert qil yoki avval `joinClinic` mantiqini chaqir.

### 3. O'qish mantiqi — har sahifa yuklanganda

Webapp boshlanish nuqtasida (layout yoki bosh sahifa) — auth qilingan bemor uchun:
```typescript
// Hozir aktiv klinikani DB'dan ol
const current = await prisma.userClinic.findFirst({
  where: { userId, isCurrent: true },
  include: { clinic: true },
});

// Agar yo'q bo'lsa (yangi user, hech qachon tanlamagan):
//   - Birinchi membership clinic'ni default qil
//   - YOKI bot deeplink'dan kelgan clinicId ni belgila
//   - YOKI "Klinika tanlang" sahifasiga yo'naltir
```

### 4. Bot deeplink ehtiyotkorligi
Bot orqali kirilganda URL'da `?clinic=...` bo'lishi mumkin. Qoida:
- **Agar URL'da klinika bor VA u user_clinics'da bor** → uni `isCurrent` qilib belgila va o'sha ko'rinsin (bot deeplink prioritetli — bemor "BUYUK TABIB botiga" kirsa, BUYUK TABIB ko'rinishi mantiqiy).
- **Agar URL'da klinika YO'Q** → DB'dagi `isCurrent` ni ishlat.
- **Agar URL'da klinika bor LEKIN user_clinics'da yo'q** → avval ulashtir (membership qo'sh), keyin aktiv qil.

Bu xulq foydalanuvchi talabi bilan mos: bemor o'zi tanlagan klinika saqlanadi, lekin bot deeplink orqali boshqasiga kirsa, u almashadi (chunki bot xabarini bosish — bu ham ongli harakat).

### 5. Muddat siyosati — HOZIR EMAS, lekin tayyor
`lastSelectedAt` ustuni qo'shildi. Hozir uni ishlatma — kelajakda agar "6 oy o'tgan bo'lsa qayta so'rash" siyosati kerak bo'lsa, mantiq qo'shiladi. Hozircha tanlangan klinika cheksiz saqlanadi (foydalanuvchi o'zi o'zgartirmaguncha).

### 6. RLS (yangi maydonlar uchun)
user_clinics jadvali RLS allaqachon yoqilgan. Yangi ustunlar avtomatik shu policy ostida bo'ladi — qo'shimcha policy SHART EMAS. Prisma service_role bilan ishlaydi, RLS deny-by-default qoladi.

### 7. Mavjud bemorlar uchun DATA migration
Hozir DB'da bemorlarning `isCurrent` hammasi false (yangi ustun, default false). Bu shuni anglatadi: birinchi yuklanishda hech kim "aktiv klinikasi yo'q" holatda. Migration ichida YOKI alohida skript bilan:
```sql
-- Har user uchun eng so'nggi user_clinic ni isCurrent qil
UPDATE user_clinics SET "isCurrent" = true
WHERE id IN (
  SELECT DISTINCT ON ("userId") id
  FROM user_clinics
  WHERE "isActive" = true
  ORDER BY "userId", "joinedAt" DESC
);
```

Bu mavjud bemorlarga "oxirgi qo'shilgan klinikani" default aktiv qilib beradi (eng yangi ulanish ehtimol oxirgi tanlovga to'g'ri keladi).

---

## 0. MAJBURIY QOIDALAR
- Responsive (mavjud Klinikalarim sahifasi allaqachon responsive — buzilmasin).
- `&apos;` ISHLATMA — to'g'ridan-to'g'ri `'`.
- RLS deny-by-default saqlansin.
- Transaction'sız `isCurrent` o'zgartirma (race condition!).
- Partial unique index majburiy (DB darajasida kafolat).

## TEKSHIRUV (deploydan oldin)
- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0
- Migration qo'llanildi, partial unique index DB'da bor
- Mavjud bemorlarda har biriga 1 ta isCurrent=true belgilangan
- Test stsenariy:
  1. Bemor "Mening klinikalarim" → Test klinika "Tanlash" → bosh sahifa Test klinika ko'rsatadi
  2. Botdan chiq, qayta kir (deeplink'siz `/webapp`) → HALI HAM Test klinika
  3. Boshqa brauzer/qurilmadan kir → HALI HAM Test klinika
  4. Yana "Mening klinikalarim" → BUYUK TABIB tanla → endi BUYUK TABIB
  5. Bot deeplink `?clinic=clinic-demo` bilan kir → BUYUK TABIB (deeplink prioritetli) va isCurrent ham yangilandi

## YAKUNDA HISOBOT
- Migration nomi + qaysi ustun/index qo'shildi
- Yangi/o'zgargan fayllar (API + frontend o'qish joyi)
- Bot deeplink mantiqi qanday ishlaydi
- Data migration natijasi (nechta yozuv yangilandi)
- tsc/build + deploy commit hash
- Test stsenariy natijalari (5 ta qadam — har biri ✅ yoki ❌)

## NEGA MUHIM
Foydalanuvchi aniq aytdi: "bir necha oy/yil tepada turishi kerak". Hozirgi holat — har sessiya boshida default'ga qaytadi, bemor uchun bezovta. Bu poydevor tuzatish: bir marta to'g'ri qilinsa, hamma bemorga, hamma qurilmaga, hamma sessiyaga ishlaydi.

## KEYINGI (HOZIR EMAS)
1. SERVICE-PICKER-01 ham qoldi (xizmat tanlash rasmli versiyani yagona qilish) — keyin yoki birga qilish mumkin
2. Muddat siyosati (6 oy o'tsa qayta so'rash) — lastSelectedAt allaqachon tayyor
3. Sahifa sekinligi optimizatsiyasi
4. Bron qabul qilish (shifokor paneli)
5. Shifokor ID tizimi (EM000001) — bemor uchun tib000039 allaqachon ishlayapti
