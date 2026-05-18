🔐 Ikkinchi muammo — localStorage da token saqlash
Sizning kodda:
localStorage.setItem("auth_token", token);
localStorage.setItem("user_role", user.role);
Bu endi keraksiz va xavfli:
⚠️ XSS hujumida localStorage JavaScript orqali o'g'irlanadi
HttpOnly cookie bilan bir paytda saqlash — ikki tomonlama xavf
Sizning yangi xavfsizlik prinsipingiz httpOnly cookie edi — bu uni buzadi
Tavsiya: localStorage.setItem("auth_token", token) qatorini o'chiring.
user_role, user_name, clinicId saqlashingiz mumkin (sezgir emas), lekin token — yo'q.
🎁 Bonus — auth-edge.ts haqida
Sizning middleware verifyTokenEdge ni @/lib/auth-edge dan import qiladi, lekin men hali bu faylni ko'rmadim. Agar xato shu yerda bo'lsa ham, men aytaman.
Lekin logically — agar auth-edge.ts buzilgan bo'lsa, /admin sahifasi DARHOL /login'ga qayta yo'naltirardi. Loglardan ko'rinadi: middleware cookie'ni umuman topmagan (token yo'q → redirect login'ga, verifyTokenEdge chaqirilmagan).
Demak auth-edge.ts muammo emas. Asosiy muammo — router.push orqali navigation'da cookie yetib bormaydi.
📋 TO'LIQ TUZATISH — Aniq qadamlar
1️⃣ src/app/login/page.tsx da 3 ta o'zgartirish:
(a) Toping:
const { token, user } = json.data;
localStorage.setItem("auth_token", token);
localStorage.setItem("user_role", user.role);
localStorage.setItem("user_name", user.firstName);
if (user.clinicId) localStorage.setItem("clinicId", user.clinicId);
Almashtiring:
const { user } = json.data;
// token endi httpOnly cookie'da, localStorage ga saqlash KERAK EMAS
localStorage.setItem("user_role", user.role);
localStorage.setItem("user_name", user.firstName);
if (user.clinicId) localStorage.setItem("clinicId", user.clinicId);
(b) Toping:
const redirect = returnUrl  roleRedirects[user.role]  "/";
router.push(redirect);
Almashtiring:
const redirect = returnUrl  roleRedirects[user.role]  "/";
window.location.href = redirect;
(c) Yuqoridagi import qismida useRouter ishlatilmasa, uni olib tashlasangiz bo'ladi (linter ogohlantirishidan qutulish uchun) — lekin majburiy emas.