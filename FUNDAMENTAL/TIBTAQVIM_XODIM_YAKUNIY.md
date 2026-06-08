# TibTaqvim — Qabulxona Xodim Boshqaruvi: YAKUNIY IMPLEMENTATSIYA

> Sening xaritalash hisoboting (`XODIM_IMPL_PROMPT.md`) zo'r. Reja asosan to'g'ri. Lekin men Supabase'dan **2 ta muhim masalani** aniqladim — ularni rejaga qo'shdim. Quyidagini bajar. Har qadamda tekshir, vizual ko'r, yakunda deploy.

---

## ⚠️ MEN SUPABASE'DAN ANIQLAGAN MASALALAR (rejaga qo'shilishi SHART)

### Masala 1 — `users` va `staff` sinxron EMAS
Hozir 2 ta receptionist bor, lekin holatlari farq qiladi:
| Ism | users'da | staff'da | Izoh |
|---|---|---|---|
| Ixtiyor Nusratov | ✅ | ✅ (`in_staff=1`) | Yangi oqim orqali — to'g'ri |
| Qabulxona Xodim (`user-reception`) | ✅ | ❌ (`in_staff=0`) | Eski seed/demo — `staff`'da yo'q |

**Oqibat:** Yangi `/admin/staff` sahifasi `staff` jadvalidan o'qiganda, "Qabulxona Xodim" **ro'yxatda ko'rinmaydi**. Bu jim yo'qotish (silent loss).

**HAL QILISH (tanla, menga ayt):**
- **(A)** Migratsiya skript: `users` da `role IN (receptionist, ...)` bo'lib `staff` da yo'q yozuvlar uchun `staff` yozuvi yarat (backfill). Eng to'g'ri — barcha xodim bitta joyda ko'rinadi.
- **(B)** "Qabulxona Xodim" eski demo bo'lsa va kerakmas bo'lsa — uni o'chir/e'tiborsiz qoldir.

**MEN backfill (A) ni tavsiya qilaman.** Lekin avtomatik bajarMA — avval menga ayt, qaysi yozuvlar backfill bo'lishini ko'rsat, men tasdiqlayman, keyin Supabase MCP bilan qil.

### Masala 2 — `GET /api/admin/staff` o'zgarishi doctor sahifasiga ta'sir qiladi
Hisobotда aytilgan: bu endpoint'ni `users`→`staff` jadvalidan o'qishga o'zgartirasan. Lekin `/admin/(panel)/doctors/page.tsx` ham shu endpoint'ni ishlatadi.
- **TEKSHIR:** doctor sahifasi bu endpoint'dan nima oladi? Agar u shu GET orqali receptionist'larni yoki staff'ni ko'rsatayotgan bo'lsa, jadval almashtirish doctor sahifasini sindirishi mumkin.
- **XAVFSIZ YO'L:** mavjud `GET /api/admin/staff` ni o'zgartirma. Buning o'rniga **yangi** endpoint yoki query param qo'sh (`?source=staff`), yoki staff sahifasi uchun alohida `GET /api/admin/staff/list` yarat. Doctor sahifasi tegilmasin. Hech narsa buzilmasligi SHART.

---

## BAJARISH TARTIBI (har qadam: kod → `tsc --noEmit` → vizual tekshir → keyingisi)

### Qadam 0 — Tekshir (kod yozishdan oldin)
- `/admin/(panel)/doctors/page.tsx` `GET /api/admin/staff` dan aniq nimani oladi va ko'rsatadi? Menga 1 jumlada ayt. Bu Masala 2 yo'lini belgilaydi.

### Qadam 1 — Supabase migration (`staff.photoUrl`)
```
Supabase MCP apply_migration
project_id: lxqimithjjabhnldcugc
name: add_staff_photo_url
query: ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
```
RLS tekshir: ustun qo'shish policy buzmaydi. Migrationdan keyin `staff` RLS holati o'zgarmaganini tasdiqlа.

### Qadam 2 — Prisma
`Staff` modeliga `photoUrl String?` qo'sh → `npx prisma generate` (migrate EMAS).

### Qadam 3 — Backend: `/api/admin/staff/[id]/route.ts` (YANGI)
- GET (bitta xodim), PATCH (firstName/lastName/phone/photoUrl/branchId), DELETE (soft delete: `staff.isActive=false` VA `users.isActive=false` ikkalasi — login bloklansin).
- Avtorizatsiya: `super_admin` (hamma), `clinic_admin` (o'z klinikasi), `branch_admin` (o'z filiali). Hisobotdagi `canManageResources` + scope tekshiruvlaridan foydalan.
- **MUHIM:** DELETE da `staff` va `users` ikkala yozuvni ham `isActive=false` qil (faqat staff emas) — aks holda o'chirilgan xodim hali login qila oladi.

### Qadam 4 — `GET` ro'yxat endpoint (Masala 2 ga ko'ra xavfsiz)
Doctor sahifasini buzmasdan, staff ro'yxati `staff` jadvalidan (`photoUrl`, `branch` bilan) o'qiladigan qil. Qadam 0 javobiga qarab: alohida endpoint yoki param.

### Qadam 5 — `StaffCard.tsx` (YANGI)
Shifokor `DoctorCard` uslubida, lekin **faqat:** avatar (photoUrl yoki placeholder), ism familiya, lavozim (Qabulxona xodimi), telefon, filial, va amal ikonkalari: 🔑 parol tiklash, ✏️ tahrir, 🗑 o'chirish. Shifokorga xos hech narsa yo'q (mutaxassislik/jadval/flip — §13 ro'yxatiga amal qil).

### Qadam 6 — `/admin/(panel)/staff/page.tsx` (YANGI)
Ro'yxat + "+ Yangi xodim" forma (firstName, lastName, phone, branchId, photoUrl). Yaratilganda credentials modal (telefon + generatsiya qilingan parol) ko'rsatilsin. **Responsive MAJBURIY** — `layout/` primitivlaridan qur.

### Qadam 7 — `/admin/staff/[id]/edit/page.tsx` (YANGI)
Ma'lumot yuklab, tahrirlab saqlash (PATCH). Foto URL preview. Responsive.

### Qadam 8 — Sidebar
`AdminSidebar.tsx` ga "Xodimlar" → `/admin/staff` qo'sh (Shifokorlardan keyin). Ko'rinish roli: `super_admin`, `clinic_admin`, `branch_admin`.

### Qadam 9 — Backfill (Masala 1) — FAQAT mening tasdiqimdan keyin
`staff`'da yo'q receptionist yozuvlarini backfill. Avval ro'yxatini menga ko'rsat.

### Qadam 10 — Tekshir + Deploy
`npx tsc --noEmit` → `npm run build` → vizual (har sahifa) → `npx vercel --prod`.

---

## RUXSATLAR (admin + superadmin amallar)
- **super_admin:** barcha klinikalardagi har bir xodimni qo'shish/tahrir/o'chirish/parol tiklash.
- **clinic_admin:** o'z klinikasidagi xodimlar ustida hamma amal.
- **branch_admin:** o'z filialidagi xodimlar ustida.
- Har bir amal (qo'shish/tahrir/o'chirish/parol-reset) audit logga yozilsin (agar audit tizimi mavjud bo'lsa — bor edi).

## TEKSHIRISH RO'YXATI (vizual, har biri ko'rilsin)
- [ ] `/admin/staff` sidebar'da ko'rinadi, ochiladi (super_admin + clinic_admin + branch_admin).
- [ ] "+ Yangi xodim" → forma → yaratilganda credentials modal (telefon + parol).
- [ ] Karta: avatar, ism, lavozim, telefon, filial.
- [ ] ✏️ tahrir → edit sahifa → saqlash ishlaydi.
- [ ] 🔑 parol tiklash → yangi parol modal.
- [ ] 🗑 o'chirish → confirm → `staff` VA `users` ikkalasi `isActive=false` → ro'yxatdan yo'qoladi → o'sha xodim endi login qila olmaydi.
- [ ] Foto URL preview ishlaydi.
- [ ] **Doctor sahifasi avvalgidek ishlaydi (BUZILMAGAN).**
- [ ] Backfill'dan keyin "Qabulxona Xodim" ham ro'yxatda ko'rinadi.
- [ ] super_admin boshqa klinika xodimini ham boshqara oladi; clinic_admin faqat o'zinikini.
- [ ] `tsc --noEmit` 0 xato, `npm run build` 0 xato, deploy READY.
- [ ] Barcha yangi sahifalar responsive (xs/md/lg/2xl).

---
**Boshlashdan oldin Qadam 0 javobini va Masala 1 tanlovini (A yoki B) menga ayt. Keyin ketma-ket bajar.**
