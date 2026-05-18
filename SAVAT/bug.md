# 🎯 VAZIFA: requiresSlot ni vaqtinchalik yashirish (Bosqich 2 ga qadar)

## LOYIHA KONTEKSTI
Repo: oqiljonplay-ctrl/tibtaqvim  
Stack: Next.js 14 (App Router) + Prisma + Supabase + Vercel + Telegram bot  
Production: https://tibtaqvim.vercel.app

## MUAMMO

Admin yangi xizmat yaratganda formada requiresSlot ("Uyacha kerak") checkbox bor. Admin uni yoqib qo'ysa, lekin DB'da slotlar yaratilmagan bo'lsa — bot va webda "Bu kunda bo'sh vaqt mavjud emas" xato chiqadi.

Real misol:
- Admin "MSKT" xizmati yaratdi, requiresSlot=true yoqdi
- Slot CRUD tizimi hali yo'q (Bosqich 2 da bo'ladi)
- Bot har sana uchun "bo'sh vaqt yo'q" deydi
- Bemor bron qila olmaydi

## STRATEGIK QAROR (foydalanuvchi tasdiqlagan)

Slot tizimi KELAJAKDA KERAK BO'LADI (Bosqich 2 — alohida vazifa). Hozir uni butunlay o'chirmaslik, lekin xato manbai bo'lmasligi uchun yashirish:

1. Frontend — admin formasidan requiresSlot checkbox VAQTINCHALIK YASHIRILADI (// TODO: Bosqich 2 — slot tizimi)
2. Backend — POST/PATCH endpointlarda requiresSlot har doim false ga aylantiriladi (validation)
3. DB — services.requiresSlot ustuni TEGILMAYDI (saqlanadi, kelajakda qaytariladi)
4. Mavjud "Qon tahlili" xizmati — DB'da requiresSlot=true va 8 slot saqlanadi. Bosqich 2 da bu birinchi sinov xizmat bo'ladi
5. Bot va Web — kod tegilmaydi. Qon tahlili slotsiz fallback bilan ishlaydi (yoki mavjud slot mantiq saqlanadi)

## ⚠️ MUHIM QOIDALAR

1. Hech narsa o'chirma:
   - requiresSlot ustuni DB'da qoladi
   - requiresSlot haqidagi mavjud bot/web mantiq tegilmaydi
   - slots jadvali, slot bilan bog'liq kod — tegilmaydi
   - "Qon tahlili" uchun requiresSlot=true qoladi (test maydoni Bosqich 2 da)

2. Faqat 2 ta narsa o'zgaradi:
   - Admin formada checkbox yashirinadi (commented out, kelajakda qaytarish oson)
   - Backend POST/PATCH'da requiresSlot: false majburiy

3. Kod tartibi saqlanadi:
   - // TODO: Bosqich 2 - slot tizimi yoqilganda checkbox qaytariladi izoh qo'shilsin
   - Komment har joyda — kelajakda topish oson bo'lishi uchun

4. TypeScript strict — any ishlatmaslik

---

# 📋 ISH BOSQICHLARI

## BOSQICH 1 — DIAGNOSTIKA

### Topish kerak bo'lgan fayllar:
# Admin xizmat formasi qaerda?
find src/app/admin -name "*.tsx" | xargs grep -l "requiresSlot" 2>/dev/null

# Backend API
find src/app/api/admin/services -name "route.ts"
Topilgan fayllarni o'qib, requiresSlot qaerda ishlatiladi tahlil qil:
- Frontend: checkbox JSX qaerda
- Backend: POST va PATCH handler'larda body validation

Foydalanuvchiga qisqa hisobot ber, keyin Bosqich 2 ga o't.

---

## BOSQICH 2 — FRONTEND: Checkbox'ni yashirish

### Fayl: Admin xizmat formasi (taxminan src/app/admin/services/page.tsx yoki src/app/admin/xizmatlar/page.tsx)

Topish kerak — taxminan shunday kod:
<label>
  <input
    type="checkbox"
    checked={requiresSlot}
    onChange={e => setRequiresSlot(e.target.checked)}
  />
  Uyacha kerak
</label>
O'zgartirish — JSX'ni comment'ga olib qo'yish:
{/* TODO: Bosqich 2 - slot tizimi yoqilganda qaytariladi
<label>
  <input
    type="checkbox"
    checked={requiresSlot}
    onChange={e => setRequiresSlot(e.target.checked)}
  />
  Uyacha kerak
</label>
*/}
⚠️ MUHIM: 
- useState (requiresSlot, setRequiresSlot) saqlanadi — boshqa joyda ishlatilishi mumkin
- Default qiymat **false** bo'lishini ta'minlash
- Agar requiresSlot boshqa state bilan birga submit body'ga yuborilsa — requiresSlot: false majburiy qilib qo'yiYangi yaratish formasi (Yangi xizmat):):**
- requiresSlot default false
- Submit'da requiresSlot: false yuboriladi (yoki yubormasliTahrirlash formasi (Tahrirlash):):**
- Mavjud qiymat saqlanadi (Qon tahlili true qoladi)
- Lekin admin uni o'zgartiriskira olmaydidi** (checkbox yashirin)
- Submit'da requiresSlot fiyubormaslikik** (yoki mavjud qiymatni saqlash)

### Aniq pattern — tavsiya etilgan:

`tsx
// State (saqlanadi):
const [requiresSlot, setRequiresSlot] = useState(false);
// Yuklash paytida (tahrirlash uchun) — mavjud qiymatni saqlash:
useEffect(() => {
  if (service) {
    setRequiresSlot(service.requiresSlot ?? false);
  }
}, [service]);

// JSX'da — checkbox YASHIRILGAN:
{/* TODO: Bosqich 2 - slot tizimi yoqilganda qaytariladi
<label>...</label>
*/}

// Submit body'da — qiymat saqlanadi (mavjudni yuboradi):
const body = {
  name,
  type,
  price,
  // ... boshqa maydonlar
  requiresSlot, // mavjud qiymat (yangi xizmat uchun false, eski Qon tahlili uchun true)
  requiresAddress,
  requiresPrePayment,
};

---

## BOSQICH 3 — BACKEND: POST'da default `false`

### Fayl: `src/app/api/admin/services/route.ts`

**Mavjud POST handler taxminan:**
typescript
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return error('Unauthorized', 401);
  
  const body = await req.json();
  
  const service = await prisma.service.create({
    data: {
      clinicId: body.clinicId,
      name: body.name,
      type: body.type,
      price: body.price,
      requiresSlot: body.requiresSlot ?? false,  // ⚠️ HOZIR — admin xohlasa true bo'lishi mumkin
      requiresAddress: body.requiresAddress ?? false,
      requiresPrePayment: body.requiresPrePayment ?? false,
      // ...
    }
  });
  
  return ok(service);
}

**O'zgartirish:**
typescript
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return error('Unauthorized', 401);
  
  const body = await req.json();
  
  const service = await prisma.service.create({
    data: {
      clinicId: body.clinicId,
      name: body.name,
      type: body.type,
      price: body.price,
      // TODO: Bosqich 2 - slot tizimi yoqilganda body.requiresSlot qaytariladi
      requiresSlot: false,  // ⚠️ Yangi xizmatlar uchun majburiy false
      requiresAddress: body.requiresAddress ?? false,
      requiresPrePayment: body.requiresPrePayment ?? false,
      // ...
    }
  });
  
  return ok(service);
}

---

## BOSQICH 4 — BACKEND: PATCH'da `requiresSlot` saqlash

### Fayl: `src/app/api/admin/services/[id]/route.ts`

PATCH handler — tahrirlashda `requiresSlot` ni **o'zgartirmaslik** (mavjud qiymat saqlanadi):

typescript
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(req);
  if (!auth) return error('Unauthorized', 401);
  
  const body = await req.json();
  
  // ⚠️ requiresSlot ni body'dan QABUL QILMAYMIZ
  // TODO: Bosqich 2 - slot tizimi yoqilganda body.requiresSlot qaytariladi
  const { requiresSlot, ...allowedFields } = body;
  
  const service = await prisma.service.update({
    where: { id: params.id },
    data: {
      ...allowedFields,
      // requiresSlot mavjud qiymatda qoladi (DB'dan tegilmaydi)
    }
  });
  
  return ok(service);
}

⚠️ **MUHIM:** Agar PATCH'da boshqa field'lar shunchaki `body` orqali o'tkazilsa, `requiresSlot` ni alohida ajratish kerak.

**Yaxshiroq variant — aniq field'lar bilan:**
typescript
const service = await prisma.service.update({
  where: { id: params.id },
  data: {
    name: body.name,
    type: body.type,
    price: body.price,
    description: body.description,
    requiresAddress: body.requiresAddress,
    requiresPrePayment: body.requiresPrePayment,
    prePaymentAmount: body.prePaymentAmount,
    dailyLimit: body.dailyLimit,
    defaultQueueMode: body.defaultQueueMode,
    isActive: body.isActive,
    // ⚠️ requiresSlot — qabul qilinmaydi (Bosqich 2)
  }
});

---

## BOSQICH 5 — XIZMATLAR JADVAL UI: Belgi yashirish

### Fayl: Admin xizmatlar jadvalida (sizning Image 2'da ko'rinadi)

Skrinshotda "Xususiyatlar" ustuni ostida **"Uyacha"** badge ko'rinadi (Qon tahlili va MSKT da). MSKT'da hozir `requiresSlot=false` (men SQL bilan tuzatdim), lekin frontend cache eski qiymatni ko'rsatishi mumkin.

**Strategiya:** "Uyacha" badge'ini xizmatlar jadvalida **yashirish** — admin uni ko'rmasin va chalkashmasin.

Jadval ichida `requiresSlot` belgi ko'rsatuvchi kod taxminan:
tsx
{service.requiresSlot && (
  <span className="badge">Uyacha</span>
)}
`
O'zgartirish:
{/* TODO: Bosqich 2 - slot tizimi yoqilganda qaytariladi
{service.requiresSlot && (
  <span className="badge">Uyacha</span>
)}
*/}
⚠️ Faqat ADMIN jadvali — bot va web tegilmaydi.

---

## BOSQICH 6 — TEST VA VERIFIKATSIYA

### 6.1 — Build test
npm run build
TypeScript xato bo'lmasligi shart.

### 6.2 — Lokal test (ixtiyoriy)
npm run dev
- `/admin/xizmatlar (yoki /admin/services) ga o'ting
- "Yangi xizmat" bossangiz, "Uyacha kerak" checkbox **ko'rinmaydi**
- "Tahrirlash" bossangiz — xuddi shunday, checkbox yo'q
- Jadvalda "Uyacha" badge yo'q (Qon tahlili da ham)

### 6.3 — Production deploy
``bash
git add .
git commit -m "fix(admin): hide requiresSlot UI until slot system phase 2 (data preserved)"
git push

### 6.4 — Foydalanuvchi tasdiqlash uchun
"Tuzatildi. Deploy bo'lgach test qiling:

1. `/admin/xizmatlar` da yangi xizmat yarating
2. Formada **"Uyacha kerak"** checkbox **YO'Q** ekanini tekshiring
3. Saqlash bossangiz, yangi xizmat `requiresSlot=false` bilan yaratiladi
4. Bot/Web'da yangi xizmat sana tanlashda **ishlaydi** (bo'sh vaqt yo'q xato yo'q)
5. Mavjud 'Qon tahlili' — DB'da `requiresSlot=true` qoladi, slot tizimi Bosqich 2 da yoqiladi
6. Tahrirlashda checkbox yo'q — admin xato qila olmaydi

Eslatma: `requiresSlot` ustuni DB'da saqlanadi. Bosqich 2 da slot CRUD UI bilan birga qaytariladi."

---

## 🚀 BOSHLA

1. **Diagnostika** — `requiresSlot` qaysi fayllarda ekanini top:
bash
grep -rn "requiresSlot" src/ --include="*.tsx" --include="*.ts"
`

2. Topilgan har bir joyni tahlil qil:
   - Frontend admin formasi (yangi + tahrirlash)
   - Backend POST/PATCH
   - Admin xizmatlar jadvali (badge ko'rsatishtegilmaydiWeb — **tegilmaydi**

3. Foydalanuvchiga qisqa hisobot ber: "Topdim, X ta joyda. Tuzatishga ruxsatmi?"

4. Tasdiqdan keyin Bosqich 2-5 ni ketma-ket bajar.

5. Build → Commit → Push.

6. Foydalanuvchiga test bosqichlarini ayt.