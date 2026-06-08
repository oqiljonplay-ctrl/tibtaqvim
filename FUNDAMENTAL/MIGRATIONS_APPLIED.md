# TibTaqvim — Migration Jurnali

> Yaratildi: 2026-06-02
> Har DB o'zgarishi bu yerda qayd etiladi.

---

## HOLAT: 4 TA MIGRATION QOLMAGAN (Deploy kerak)

`npx prisma migrate status` — 2026-06-02 holati:

| Migration | Holat | Maqsad | Reversible? | Backfill kerak? | Rollback rejasi |
|-----------|-------|--------|-------------|-----------------|-----------------|
| `20260522121640_add_service_branch_id` | ❌ Qo'llanmagan | Service'ga branchId qo'shish | ✅ | Yo'q | DROP COLUMN |
| `20260528000001_flip_card_doctor_profile` | ❌ Qo'llanmagan | Shifokor profil maydonlari (bio, position, department, va boshq.) | ✅ | Yo'q | DROP COLUMN |
| `20260528000002_user_clinic_is_current` | ❌ Qo'llanmagan | UserClinic.isCurrent partial unique index | ✅ | Yo'q | DROP INDEX |
| `20260529100001_add_father_name_region_district_to_users` | ❌ Qo'llanmagan | User'ga fatherName, region, district qo'shish | ✅ | Yo'q | DROP COLUMN |

### Deploy buyruqlari:
```bash
npx prisma migrate deploy
```

> **DIQQAT:** Bu migrationlar production'ga qo'llanmagan. Agar kod bu ustunlara murojaat qilayotgan bo'lsa (doctor profile, webapp profile) — runtime xato berishi mumkin. **Deploy qilishdan oldin ushbu migrationlarni ishga tushirish SHART.**

---

## WAVE 1 O'ZGARISHLARI — DB yo'q

Wave 1 tuzatishlari faqat kod darajasida (utility va endpoint yangilashlari). DB migrationi yo'q.

---

> **Oxirgi yangilanish:** 2026-06-02
