# 🎯 VAZIFA: Doctor formada specialty — qo'lda yozish o'rniga dropdown (xizmatlardan)

## LOYIHA KONTEKSTI
Repo: oqiljonplay-ctrl/tibtaqvim  
Stack: Next.js 14 (App Router) + Prisma + Supabase + Vercel + Telegram WebApp  
Production: https://tibtaqvim.vercel.app

Hozirgi holat: Service-Doctor M2M tizimi ishlamoqda, QueueMode (live/online/slot) tizimi tugagan. Lekin admin shifokor formada **specialty (mutaxassislik) maydonini qo'lda matn yozadi** — imloviy xatolar, xizmat ro'yxati bilan mos kelmaslik muammolari bor.

## ⚠️ MUAMMO

### Hozirgi xulq-atvor (xato)
1. Admin /admin/doctors/new ga kiradi
2. "Mutaxassislik" maydonqo'ldada** "Stomatolog" yozadi
3. Ehtimol xato qiladi: "Stamatolog" yoki "stomatolog" yoki "Стоматолог"
4. Pastda "Qatnashadigan xizmatlar" checkbox'lari mavjud
5. Admin alohida xizmatlarni belgilayNatija:a:**
- doctors.specialty qo'lda yozilgan (imloviy xato bo'lishi mumkin)
- service_doctors jadval — alohida bog'lanish
- Ikkalbog'lanmaganan** — chalkashlik manbai

### Sizning g'oya — yangi xulq-atvor
1. "Mutaxassislik" — qo'lda yozish o'rnDROPDOWNWN**
2. Dropdown optionmavjud xizmatlar ro'yxatidanan** (services jadvalidan)
3. Admin tanlaydi → specialty avtomatik to'ldiriladi
4. Saqlash bosgach → tanlangan xizmat avtomatik service_doctors ga ham bog'lanadi
5. Yangi xizmat qo'shilsa, avtomatik dropdown'da paydo bo'ladi

## STRATEGIK QARORLAR (user tasdiqlagan)
Yondashuv:v:** Dropdown — services.name ro'yxatidan tanlanadiSpecialty qiymati:i:** Xizmat nomi bilan bir xil saqlanadi (masalan: "Kardiolog qabuli" tanlansa, specialty = "Kardiolog qabuli")Default:t:** "Bo'sh qoldirish" (bo'sh string) — admin tanlamasligi mumkinAvtomatik service binding:g:** Mutaxassislik tanlangach, **shu xizmat avtomatik serviceIds** ga qo'shiladi (checkbox ham yoqilgan ko'rinishBoshqa xizmatlarni qo'shimcha tanlash mumkinmumkin** — admin pastdagi checkbox'larda boshqa xizmatlarni ham belgilashi mumkin (masalan, Yusupova hammasi Kardiolog qabulini emas, EKG ni ham qilFilial bo'yicha ajratish HOZIR QILINMAYDINMAYDI** — alohida vaMavjud shifokorlar:orlar:** Mavjud specialty qiymatlari saqlanadi (Kardiolog, Terapevt, va h.k.) — tegmaslikyangi shifokor yaratishda yoki tahrirlashdalashda** dropdown ishlatiladi.

## DB HOLATI (tegmHozirgi mavjud xizmatlar:atlar:**
- svc-queue-1 Terapevt qabuli (doctor_queue, 80k)
- svc-queue-2 Kardiolog qabuli (doctor_queue, 120k)
- cmoik6xo70001jy04xgvdywo2 Ortopedga kunlik kvota (doctor_queue, 100k)
- svc-diag-1 Qon tahlili (umumiy) (diagnostic, 50k)
- svc-diag-2 EKG (diagnostic, 60k)
- svc-home-1 Uyda bemor ko'rish (home_service,Mavjud shifokorlar (specialty saqlanadi, tegmaslik):slik):**
- Toshmatov Jasur — Terapevt
- Yusupova Dilnoza — Kardiolog
- Rahimov Nodir — Nevropatolog
- Sayfiyev Oqil — Stomatolog
- Qilichev Ruslan — Dietolog
- Amonov Sami — Ortoped

---

# 📋 ISH BOSQICHLARI

## BOSQICH 1 — FRONTEND: Doctor formasini topish va tahlil qilish

### Qadam 1.1 — Fayllarni topish

Quyidagi fayllarni topish va o'qish:
- src/app/admin/doctors/new/page.tsx (yangi shifokor formasi)
- src/app/admin/doctors/[id]/edit/page.tsx (tahrirlash formasi)

Yoki agar bular alohida bo'lmasa:
- src/app/admin/doctors/page.tsx (ehtimol modal)
- src/app/admin/doctors/components/...

### Qadam 1.2 — Hozirgi xulq-atvorni tushunish

Topilgan fayllarda quyidagini tahlil qil:
1. specialty qaerdaqaerqandayqanday** input ishlatadi?
2. "Qatnashadigan xizmatlar" checkbqaerdaqaerda**?
3. services ro'yxatini olisqaysi APIsi API** chaqiriladi?
   - Ehtimol: GET /api/admin/services
4. Submit handler serviceIds ni qanday yuboradi?

Bu ma'lumotlarni o'rganib bo'lgach, foydalanqisqa hisobotisobot** ber: "Topdim, formada specialty hozir <input type='text'>, xizmatlar pastda checkbox..." va keyin tuzatishga o'tish ruxsati so'ra.

---

## BOSQICH 2 — Specialty Dropdown qo'shish

### Qadam 2.1 — Frontend — Yangi shifokor fFayl:*Fayl:** src/app/admin/doctors/new/page.tsx (yoki tegishli)
Eski input (qidir va almashtir):
<div>
  <label className="block text-sm font-medium mb-1">Mutaxassislik *</label>
  <input
    type="text"
    value={specialty}
    onChange={e => setSpecialty(e.target.value)}
    placeholder="Masalan: Kardiolog"
    required
  />
</div>
Yangi dropdown bilan almashtir:
<div>
  <label className="block text-sm font-medium mb-1">
    Mutaxassislik <span className="text-red-500">*</span>
  </label>
  <select
    value={specialty}
    onChange={e => {
      const newSpecialty = e.target.value;
      setSpecialty(newSpecialty);
      
      // ⚠️ MUHIM: Tanlangan xizmatni avtomatik serviceIds ga qo'shish
      if (newSpecialty) {
        const matchedService = allServices.find(s => s.name === newSpecialty);
        if (matchedService && !selectedServiceIds.includes(matchedService.id)) {
          setSelectedServiceIds(prev => [...prev, matchedService.id]);
        }
      }
    }}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    required
  >
    <option value="">-- Mutaxassislikni tanlang --</option>
    {allServices.map(service => (
      <option key={service.id} value={service.name}>
        {service.name}
      </option>
    ))}
  </select>
  
  {allServices.length === 0 && (
    <p className="mt-1 text-xs text-amber-600">
      ⚠️ Hech qanday xizmat topilmadi. Avval{' '}
      <a href="/admin/services" className="underline">Xizmatlar sahifasida</a>{' '}
      xizmat qo'shing.
    </p>
  )}
  
  {specialty && (
    <p className="mt-1 text-xs text-gray-500">
      Bu mutaxassislikka "{specialty}" xizmati avtomatik biriktiriladi.
      Quyida boshqa xizmatlarni ham qo'shishingiz mumkin.
    </p>
  )}
</div>
### Qadam 2.2 — allServices ni olish (agar yo'q bo'lsa)

Forma yuqorisida useEffect orqali xizmatlar ro'yxatini olib kelish:

const [allServices, setAllServices] = useState<Array<{ id: string; name: string; price: number }>>([]);
const [servicesLoading, setServicesLoading] = useState(true);

useEffect(() => {
  let cancelled = false;
  setServicesLoading(true);
  
  fetch('/api/admin/services', { credentials: 'include' })
    .then(r => r.json())
    .then(json => {
      if (cancelled) return;
      if (json.success && Array.isArray(json.data)) {
        setAllServices(json.data);
      }
    })
    .catch(err => {
      console.error('Services yuklashda xato:', err);
    })
    .finally(() => {
      if (!cancelled) setServicesLoading(false);
    });
  
  return () => { cancelled = true; };
}, []);
⚠️ DIQQAT: Agar formada allServices mavjud bo'lsa (chunki checkbox'lar ham shu ma'lumotni ishlatadi), qayta yaratma — mavjudini ishlat.

### Qadam 2.3 — Tahrirlash formasida ham xuddi shu o'zgarish

Fayl: src/app/admin/doctors/[id]/edit/page.tsx

Xuddi shu dropdown pattern'ni edit formasida ham qo'lla. Diqqat: edit'da specialty allaqachon to'ldirilgan bo'ladi — dropdown shu qiymatda turishi kerak.

// Edit formasida — defaultValue uchun:
useEffect(() => {
  if (doctor?.specialty) {
    setSpecialty(doctor.specialty);
  }
  if (doctor?.services) {
    setSelectedServiceIds(doctor.services.map((s: any) => s.id));
  }
}, [doctor]);
⚠️ NOZIK JOY: Edit formasida agar mavjud specialty qiymati services.name ro'yxatida yo'q bo'lsa (masalan, "Stomatolog" — bu xizmat emas), dropdown bo'sh ko'rinadi. Bu holatda:

<select value={specialty} onChange={...}>
  <option value="">-- Mutaxassislikni tanlang --</option>
  
  {/* Agar mavjud specialty xizmatlar orasida bo'lmasa — alohida ko'rsat */}
  {specialty && !allServices.some(s => s.name === specialty) && (
    <option value={specialty} disabled>
      {specialty} (eski qiymat — yangilang)
    </option>
  )}
  
  {allServices.map(service => (
    <option key={service.id} value={service.name}>
      {service.name}
    </option>
  ))}
</select>
Bu mavjud shifokorlar (Kardiolog, Terapevt, va h.k.) uchun backward compatibility ta'minlaydi.

---
## BOSQICH 3 — Submit logikasi — service avtomatik biriktirish

### Qadam 3.1 — Frontend submit handler

Submit'da specialty va serviceIds ikkalasini ham yuborish:

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (submitting) return;  // race condition (oldingi promptdan kelgan)
  setSubmitting(true);
  
  try {
    // Specialty bilan bog'liq xizmatni majburiy serviceIds ga qo'shish
    let finalServiceIds = [...selectedServiceIds];
    const matchedService = allServices.find(s => s.name === specialty);
    if (matchedService && !finalServiceIds.includes(matchedService.id)) {
      finalServiceIds.push(matchedService.id);
    }
    
    const body = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      specialty,  // dropdown'dan tanlangan qiymat
      phone: phone.trim(),
      photoUrl: photoUrl.trim() || null,
      serviceIds: finalServiceIds,
    };
    
    const res = await fetch('/api/admin/doctors', {
      method: 'POST',  // edit'da PATCH
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const json = await res.json();
    if (!json.success) {
      alert(json.error?.message || 'Saqlashda xato');
      return;
    }
    
    router.push('/admin/doctors');
  } catch (err) {
    alert('Server bilan bog\'lanishda xato');
  } finally {
    setSubmitting(false);
  }
};
### Qadam 3.2 — Backend (agar kerak bo'lsa)

POST /api/admin/doctors va PATCH /api/admin/doctors/[id] allaqachon serviceIds qabul qiladi (oldingi M2M promptida qo'shilgan). Hech qanday backend o'zgarishi kerak emas.

⚠️ Lekin tekshirish kerak — agar backend serviceIds ni qabul qilmasa, qo'shing (oldingi M2M promptida ko'rsatilgan).

---

## BOSQICH 4 — "Qatnashadigan xizmatlar" checkbox'larini saqlash

Pastdagi checkbox ro'yxati saqlanadi — chunki admin boshqa xizmatlarni ham qo'shishi kerak bo'lishi mumkin. Misol:

- Specialty: "Kardiolog qabuli" (asosiy)
- Qo'shimcha xizmatlar: "EKG" (checkbox), "Uyda bemor ko'rish" (checkbox)

UI tartibi:
[Mutaxassislik dropdown]  ← BIRINCHI tanlash (avtomatik service)
[Foto URL]
[Telefon]

Qatnashadigan xizmatlar:  ← QO'SHIMCHA (ixtiyoriy)
  [✓] Kardiolog qabuli  ← dropdown'dan tanlanganida avtomatik check
  [ ] Terapevt qabuli
  [✓] EKG  ← admin qo'shimcha tanlagan
  [✓] Uyda bemor ko'rish  ← admin qo'shimcha tanlagan
⚠️ Specialty checkbox'i avtomatik check qilinishini ta'minla:

// Dropdown onChange'da:
onChange={e => {
  const newSpecialty = e.target.value;
  setSpecialty(newSpecialty);
  
  // Agar specialty xizmat bilan mos kelsa — checkbox ni ham yoqib qo'y
  if (newSpecialty) {
    const matchedService = allServices.find(s => s.name === newSpecialty);
    if (matchedService && !selectedServiceIds.includes(matchedService.id)) {
      setSelectedServiceIds(prev => [...prev, matchedService.id]);
    }
  }
}}
⚠️ Lekin ehtiyot bo'l: Agar admin specialty ni o'zgartirsa, eski check avtomatik o'chmasligi kerak (admin uni qo'lda olib tashlasin). Yangi tanlanganga qo'shiladi, eski qoladi.

---

## BOSQICH 5 — TEST VA VERIFIKATSIYA

### 5.1 — TypeScript build
npm run build
Xato bo'lmasligi shart.

### 5.2 — Lokal test (ixtiyoriy)
npm run dev
### 5.3 — Production deploy
git add .
git commit -m "feat(admin): doctor specialty dropdown from services list + auto-bind"
git push
### 5.4 — Foydalanuvchi tasdiqlash uchun
"Tuzatildi. Production deploy bo'lgach test qiling:

1. /admin/doctors/new ga o'ting
2. 'Mutaxassislik' dropdown'ida mavjud xizmatlar ro'yxati ko'rinishi kerak:
   - Bo'sh qoldirish
   - Kardiolog qabuli
   - Terapevt qabuli
   - Ortopedga kunlik kvota
   - Qon tahlili (umumiy)
   - EKG
   - Uyda bemor ko'rish

3. 'Kardiolog qabuli' ni tanlang → pastdagi checkbox'da 'Kardiolog qabuli' avtomatik yoqiladi

4. Boshqa xizmatlarni qo'shimcha tanlashingiz mumkin (EKG, Uyda bemor ko'rish, va h.k.)
5. Saqlash bossangiz, yangi shifokor:
   - specialty = 'Kardiolog qabuli'
   - service_doctors da barcha tanlangan xizmatlar bilan bog'lanish

6. Tahrirlashda — mavjud specialty dropdown'da turadi. Agar eski qiymat (masalan 'Kardiolog' — xizmat nomi emas) bo'lsa, 'eski qiymat — yangilang' disabled option ko'rinadi.

7. Yangi xizmat yarating /admin/services da → Yangi shifokor formasidagi dropdown'ga avtomatik qo'shiladi."

---

## ⚠️ MUHIM QOIDALAR

1. Hech narsa o'chirma:
   - Mavjud "Qatnashadigan xizmatlar" checkbox'lari saqlanadi
   - Mavjud specialty qiymatlari (Kardiolog, Terapevt) tegilmaydi — backward compatibility uchun disabled option
   - Mavjud submit handler logikasi saqlanadi (race condition tuzatishi oldingi promptdan)
   - Mavjud queueMode tizimi tegilmaydi

2. TypeScript strict:
   - allServices type aniq berilsin: Array<{ id: string; name: string; price: number }>
   - any ishlatmaslik

3. Race condition saqlanishi shart:
   - Submit tugmasi disabled={submitting} saqlanadi (oldingi promptdan)
   - Yangi pattern'ga xalal bermaslik

4. API endpoint'lar:
   - GET /api/admin/services — barcha mavjud xizmatlarni qaytaradi (allaqachon mavjud)
   - POST /api/admin/doctors — serviceIds qabul qiladi (allaqachon mavjud)
   - PATCH /api/admin/doctors/[id] — serviceIds qabul qiladi (allaqachon mavjud)
   - Hech qanday backend o'zgarishi kerak emas (tekshirish kifoya)

5. Edit formasida backward compatibility:
   - Mavjud specialty qiymatlari (Kardiolog, Stomatolog) xizmat nomi bo'lmasligi mumkin
   - Disabled option bilan ko'rsatish, admin yangilashga taklif

6. Mavjud kasblar mappingi:
   - "Kardiolog" → admin keyinroq "Kardiolog qabuli" ga o'zgartirishi mumkin (ixtiyoriy)
   - Bu avtomatik migration emas — admin qo'lda yangilaydi tahrirlashda

7. Yangi xizmat yaratilganda dropdown'da paydo bo'lishi:
   - Hech qanday qo'shimcha kod kerak emas
   - useEffect har form ochilishida /api/admin/services ni chaqiradi
   - Yangi xizmat avtomatik dropdown'da paydo bo'ladi

8. Build test:
   - npm run build xato bermasligi shart
   - Vercel deploy READY bo'lishi kerak

---

## 📋 BAJARISH TARTIBI

### Qadam 1: Diagnostika
- src/app/admin/doctors/new/page.tsx va [id]/edit/page.tsx ni o'qib chiq
- Specialty input qaerda, checkbox'lar qaerda ekanini top
- allServices mavjudmi tekshir
- Foydalanuvchiga qisqa hisobot ber

### Qadam 2: New form — dropdown
- <input> ni <select> ga almashtir
- onChange da specialty + serviceIds ikkalasini yangilash
- Empty option + warning (xizmat yo'q bo'lsa)

### Qadam 3: Edit form — dropdown
- Xuddi shunday tuzatish
- Backward compat: mavjud qiymat disabled option sifatida ko'rinishi

### Qadam 4: Submit handler
- Race condition saqlanadi
- serviceIds ga specialty bilan mos xizmat avtomatik qo'shiladi

### Qadam 5: Build + Test
- npm run build
- Lokal test (ixtiyoriy)
- Commit + push

### Qadam 6: Foydalanuvchiga xabar
Yuqoridagi 7 ta test bandi bilan.

---

## 🚀 BOSHLA

1. Avval src/app/admin/doctors/new/page.tsx ni o'qib chiq
2. Specialty input qaerdaligi va allServices mavjudligini aniqla
3. Foydalanuvchiga "Topdim, ishni boshlashga ruxsatmi?" deb ayt
4. Tasdiqdan keyin Bosqich 2 ga o't