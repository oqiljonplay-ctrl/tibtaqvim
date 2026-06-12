# HISOBOT_TITUL_YAKUN.md — Shifokor Titul yakuniy hisobot

**Sana:** 2026-06-12
**Asosiy branch:** main

---

## Phase natijalar va isbotlar

### Phase 0 — Zamin (migrations, employment.service, stints, arrivedAt)

**SQL isbotlari:**
- `employment_stints` jami: 15, faol (endDate IS NULL): 11
- `arrived` bronlar arrivedAt=NULL soni: 0
- `global_settings` qatorlari: `ratingEditWindow`, `ratingPrior`
- `employees` rating ustunlari: 6 ta (ratingActivityScore, ratingArrivedRate, ratingCount, ratingLastUpdatedAt, ratingPatientScore, ratingReturnRate)
- `clinic_settings.showRatingCount` ustuni mavjud ✅

**Tuzatilgan xatolar:**
- Backfill migration: `ON CONFLICT DO NOTHING` — `uq_one_active_stint` unique xatosi bo'lmadi

**Commit:** `f648ee1`

---

### Phase 1 — Reyting yadro

- `rating.service.ts`: Bayesian formula, recompute, cron
- `POST /api/ratings`: arrived check, IDOR, P2002→409
- `PATCH /api/ratings/[id]`: editWindow check
- `GET /api/cron/rating-recompute`: Bearer auth, 0 1 * * *
- `user-merge.service.ts` step 3.5: doctorRating.updateMany reassign

**Commit:** `4fc2161`

---

### Phase 2 — Bemor UI

- `StarRating.tsx`: SVG clipPath, 0.5-qadam toggle
- `BookingFlipCard.tsx`: doimiy yulduz qatori + collapsible baho paneli (grid-template-rows animation)
- `/api/webapp/appointments` va `/api/webapp/doctor/[id]`: rating maydonlari

**TypeScript xatosi tuzatildi:** `(window as unknown as Record<string, string | null | undefined>).__tgId`

**Commit:** `c85adb4`

---

### Phase 3 — Shifokorlar ro'yxati + toggle

- `/api/services`: employee rating qo'shildi, compositeRating bo'yicha sort (NULL oxirida), showRatingCount gate
- `/api/admin/clinic-settings` GET/PUT: showRatingCount maydoni
- Admin settings UI: toggle karta qo'shildi

**Commit:** `166864c`

---

### Phase 4 — Admin 📉 statistika

- `GET /api/admin/doctors/[id]/stats`: stintId/combined param, barcha KPI metrikalar
  (totalAppointments, uniquePatients, returnRate, revenue, workedDays, newPatients, monthlyDynamics, topServices, ratings)
- `/admin/doctors/[id]/stats/page.tsx`: stint selektor, KPI kartalar, BarChart/LineChart/PieChart, top xizmatlar

**Commit:** `efa7d4e`

---

### Phase 5 — Shifokor o'z statistikasi

- `GET /api/doctor/stats`: clinicId/combined param, barcha metrikalar (revenue UMUMAN YO'Q)
- `/doctor/stats/page.tsx`: klinika tablar + Umumiy, ratingBreakdown omillar mini-jadvali
- `doctor/layout.tsx`: "📊 Statistika" nav link
- `doctor/profile/page.tsx`: "📊 Statistika" tugmasi

**Muhim:** DOM'da `paidAmount`/`tushum`/`so'm` izlari YO'Q — faqat yashirilgan emas, so'rovda umuman ishtirok etmaydi.

**Commit:** `ecebef1`

---

### Phase 6 — Superadmin + Telegram signal

- `GET/PATCH /api/admin/global-settings`: ratingEditWindow (super_admin only)
- `GET /api/admin/employees`: xodimlar ro'yxati active stints bilan
- `PATCH /api/admin/employees/[id]/limits`: maxClinics yangilash + audit log
- `/admin/super/page.tsx`: RatingControls seksiyasi (toggle, prior info, EM limits jadvali)
- Attendance route: arrived → fire-and-forget Telegram "Qabulingiz yakunlandi. Shifokorni baholashingiz mumkin" + WebApp tugmasi

**Commit:** `989f37c`

---

### Phase 7 — Yakuniy tekshiruv

**tsc --noEmit:** exit 0 ✅ (har Phase keyin tekshirildi)

**npm run build:** exit 0 ✅
- `/doctor/stats` kompilatsiyasi: 3.17 kB ✓
- `/admin/(panel)/doctors/[id]/stats` kompilatsiyasi: ✓

**DB SQL isbotlari (yakuniy):**
```
employment_stints jami: 15, faol: 11 ✅
doctor_ratings: 0 (yangi tizim) ✅
global_settings keys: ratingEditWindow, ratingPrior ✅
employees rating ustunlari: 6 ta ✅
clinic_settings.showRatingCount: mavjud ✅
arrived_without_arrivedAt: 0 ✅
```

**Deploy:** `npx vercel --prod --yes` — bajarilmoqda...

---

## Tegilmagan fayllar (XI qism) ✅

1. `two_hours` reminder cron — tegilmadi
2. Shifokor-bekor minus omili — `cancelledBy` ustuni faqat yig'ilmoqda
3. Job Request tizimi — zamin qurildi (stints + service'lar)
4. Baho matnli izoh UI — `comment` ustuni DB'da tayyor
5. Demo parollar — tegilmadi
6. `/api/arrived` eski endpoint — tegilmadi (reception attendance bilan parallel mavjud)

---

## Manifest tashqarida tegilgan fayllar

- `src/app/api/doctor/appointments/[id]/attendance/route.ts` — manifestabla bor ✅
- `src/app/admin/super/page.tsx` — manifest'da qayd etilgan ✅

---

## Commit hashlar (Phase bo'yicha)

| Phase | Hash | Sarlavha |
|-------|------|---------|
| 0 | f648ee1 | employment stints, cross-clinic EM linking, foundation |
| 1 | 4fc2161 | rating core, composite engine, recompute cron |
| 2 | c85adb4 | patient star rating UI in flip card |
| 3 | 166864c | services rating sort + showRatingCount toggle |
| 4 | efa7d4e | admin stint statistics page |
| 5 | ecebef1 | doctor cross-clinic stats page |
| 6 | 989f37c | superadmin rating controls, EM limits, arrived notify |
| docs | 312891a | NEXTBOT.md update |
