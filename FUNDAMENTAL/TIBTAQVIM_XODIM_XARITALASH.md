# TibTaqvim — Shifokor Xodim CRUD Xaritalash (DIAGNOSTIKA)

> **VS Code Claude uchun.** MAQSAD: admin panelidagi **shifokorlar** bo'limida mavjud xodim boshqaruvi kodini to'liq xaritalash. Keyinchalik shu kodni umumlashtirib **qabulxona xodimi (receptionist)** uchun ham ishlatamiz.
>
> **HOZIR KOD YOZMA. HECH NARSANI O'ZGARTIRMA.** Faqat o'qib, topib, hisobot ber. Har topilmaga **aniq fayl yo'li + qator raqami** ber. Eng kichik joyni ham qoldirma.

## KONTEKST (men Supabase'dan tasdiqladim)
- Barcha rollar bitta `users` jadvalida: `doctor(11), patient(10), clinic_admin(3), branch_admin(2), receptionist(2), super_admin(1)`.
- Doctor va receptionist bir xil tuzilmaga ega (`users`: passwordHash, phone, clinicId, branchId, photoUrl?, isActive). Yangi jadval kerak emas.
- Bizni FAQAT quyidagi imkoniyatlar qiziqtiradi (screenshotdagi shifokor kartasidagidek): **o'chirish, ma'lumot tahrirlash, login/parol olish va tiklash, foto URL, telefon raqami, qaysi klinikaga/filialga biriktirilgani.**
- Shifokorga XOS qismlar (mutaxassislik, yo'nalish, ish jadvali, tajriba, operatsiyalar soni, flip-card profil va h.k.) — BULARNI receptionistga KO'CHIRMAYMIZ. Ularni faqat aniqla, ajratib ko'rsat.

## XARITALASH — quyidagilarni topib hisobot ber

### 1. Frontend — shifokorlar bo'limi UI
- [ ] Admin panelda shifokorlar ro'yxati/boshqaruvi qaysi sahifa? Aniq yo'l (`src/app/admin/**` yoki shunga o'xshash).
- [ ] Shifokor **kartasi** komponenti (screenshotdagi MRT/Ortoped kartalari — kalit🔑/qalam✏️/savat🗑 ikonkali) qaysi faylda? Komponent nomi.
- [ ] Shifokor **qo'shish/tahrirlash formasi** komponenti qaysi faylda? Qanday maydonlar bor (har birini sana)?
- [ ] **Login/parol olish va tiklash** UI qaysi yerda, qanday ishlaydi? (parolni ko'rsatish, reset qilish, yangi parol generatsiya?)
- [ ] **O'chirish** tugmasi qanday ishlaydi (confirm modal bormi)?
- [ ] **Foto URL** kiritish/ko'rsatish qanday?
- [ ] **Klinika/filialga biriktirish** UI (select?) qanday?
- [ ] Bu komponentlarda `role` qiymati QANDAY ishlatiladi? `"doctor"` HARDCODE qilinganmi yoki prop/parametr sifatida kelmoqdami? Har bir hardcode `"doctor"` joyini ro'yxatla (fayl + qator).
- [ ] Shifokorga XOS UI bloklari (mutaxassislik/jadval/tajriba/flip-profil) qaysi qismda — ularni aniq ajratib ko'rsat, chunki receptionistda BO'LMAYDI.

### 2. Backend — API route'lar
- [ ] Shifokor yaratish API (`POST`) — qaysi route fayli? `role` qanday o'rnatiladi (hardcode `doctor`mi)?
- [ ] Shifokor tahrirlash (`PATCH/PUT`) — qaysi route?
- [ ] Shifokor o'chirish (`DELETE`) — qaysi route? Soft delete (`isActive=false`) yoki hard delete? Bog'liq yozuvlar (appointments) bilan nima bo'ladi?
- [ ] Login/parol: parol generatsiya/hash/reset qaysi route va qaysi util/funksiya? (`passwordHash` qanday yaratiladi — bcrypt?)
- [ ] Bu route'larda `role="doctor"` hardcode bormi yoki parametrlanganmi? Har birini sana.
- [ ] Avtorizatsiya: bu route'larni kim chaqira oladi (clinic_admin? super_admin? branch_admin?)? Ruxsat tekshiruvi qanday (JWT role check)?
- [ ] Shifokorga XOS jadvallarga yozish (doctor_specialties/directions/experiences/workplaces) shu create/update oqimida sodir bo'ladimi? Agar ha — receptionist uchun bu qism O'TKAZIB YUBORILISHI kerak. Aniq ko'rsat.

### 3. Ma'lumotlar qatlami
- [ ] Prisma `User` modelida `photoUrl` (yoki foto) maydoni bormi? Ism maydonlari (`firstName/lastName/fatherName`)?
- [ ] Receptionist hozir qanday yaratilgan (2 ta bor) — qaysi oqim orqali yaratilgan? Admin paneldan yaratish UI'si HOZIR BORMI yo'qmi? (Aniqla: agar yo'q bo'lsa, demak ular qo'lda/seed orqali kelgan.)
- [ ] Receptionist'ning hozirgi boshqaruv UI'si umuman bormi (ro'yxat ko'rinadimi)? Yoki butunlay yo'qmi?

### 4. Qayta ishlatish imkoniyati bahosi
- [ ] Shifokor CRUD kodini `role` parametrli generic `StaffManager`/`StaffForm`/`StaffCard` ga ajratish QANCHALIK oson? To'siqlar bormi (chuqur hardcode, shifokorga xos logikaning aralashib ketishi)?
- [ ] Tavsiya: qaysi komponent/route'larni generiklashtirsa bo'ladi, qaysilarini receptionist uchun yangi yupqa qatlam (wrapper) qilish kerak?

## HISOBOT FORMATI
Har bo'lim uchun: fayl yo'li → qator → qisqa izoh. Oxirida:
- "Generiklashtirsa bo'ladigan" fayllar ro'yxati.
- "Shifokorga xos, ko'chirilmaydigan" qismlar ro'yxati.
- Taxminiy refactor hajmi (kichik/o'rta/katta) va asosiy xavf.

**Kod yozma. Faqat hisobot. Men o'qib, keyin aniq implementatsiya promptini beraman.**
