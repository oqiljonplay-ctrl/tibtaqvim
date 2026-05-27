# Klinika almashtirish rejasi (kelajak)

Bu hujjat xodim/xizmatni bir klinikadan boshqasiga ko'chirish
uchun kelajakdagi implementatsiya rejasidir. Hali hech qanday
UI yoki endpoint amalga oshirilmagan.

---

## Asosiy savol: qaysi jadvallar yangilanadi?

| Jadval | O'zgarish | Izoh |
|---|---|---|
| `users` | `clinicId`, `branchId` yangilanadi | Akkaunt yangi klinikaga o'tadi |
| `doctors` | `clinicId`, `branchId` yangilanadi | Shifokor yozuvi |
| `service_doctors` | eski bog'liqlar o'chiriladi | Yangi klinikada qayta biriktirish kerak |
| `appointments` | **O'ZGARMAYDI** | Tarix eski klinikada qoladi (qarang: maxfiylik) |
| `slots` | **O'ZGARMAYDI** | Tarix eski klinikada qoladi |

---

## Tarix (appointments) qayerda qoladi?

**Qaror:** eski klinikada qoladi.

Sabab: bemor eski klinikada qilgan bronlar o'sha klinikaning
mulkidir. Ko'chirish paytida eski tarix o'chirilmaydi yoki
yangi klinikaga ko'chirilmaydi. Maxfiylik va audit integritetini
saqlab qolish uchun.

---

## Audit yozuvi nimani o'z ichiga oladi?

```json
{
  "action": "doctor.clinic_change",
  "payload": {
    "doctorId": "...",
    "oldClinicId": "...",
    "newClinicId": "...",
    "oldBranchId": "...",
    "newBranchId": "...",
    "movedBy": "<actorId>"
  }
}
```

Xizmat uchun `service.clinic_change`, xodim uchun `staff.clinic_change`
(konstantalar `src/lib/audit/actions.ts` da `CLINIC_CHANGE_AUDIT_ACTIONS`).

---

## Kim amalga oshira oladi?

| Rol | Ruxsat | Izoh |
|---|---|---|
| `super_admin` | ✅ | Cheklovsiz |
| `clinic_admin` | ❌ | O'z klinikasidan tashqari resurslarga kira olmaydi |
| `branch_admin` | ❌ | Filial darajasida boshqaradi, klinika emas |

Faqat `super_admin` boshqa klinikaga ko'chira oladi.

---

## Implementatsiya ketma-ketligi (kelajak MD uchun)

1. Super admin UI: xodim/xizmat kartasida "Klinikani almashtirish" tugmasi.
2. Tasdiqlash modali: eski klinika → yangi klinika, ogohlantirish matni.
3. POST `/api/admin/super/transfer` endpoint:
   - `entityType`: `doctor | service | staff`
   - `entityId`, `targetClinicId`, `targetBranchId`
   - `$transaction` ichida: users + doctors/service jadvallarni yangilash.
   - Audit log yozish.
4. `service_doctors` ko'chgandan keyin shifokorni qayta biriktirish taklifi.

---

## Ehtiyot choralar

- Ko'chirish paytida aktiv bronlar (`appointments.status = confirmed`) bo'lsa, ogohlantirish.
- `service_doctors` ko'chirish paytida o'chiriladi — yangi klinikada xizmatga qayta qo'lda biriktirish kerak.
- Bir akkaunt bir vaqtda faqat bitta klinikada faol bo'lishi mumkin (`clinicId` unique emas, lekin `branchId` faqat bir filialni ko'rsatadi).
