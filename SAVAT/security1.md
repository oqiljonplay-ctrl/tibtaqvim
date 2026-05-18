

3️⃣ Boshqa frontend joylarda localStorage.getItem("auth_token") ishlatilishi
VS Code'da qidiring (Ctrl+Shift+F): localStorage.getItem("auth_token") yoki localStorage.getItem('auth_token')
Topilgan har bir joyda — agar Authorization: Bearer ${token} ko'rinishida ishlatilsa, olib tashlang. Backend endi auth_token cookie'ni o'qiydi (getTokenFromRequest ikkalasini ham tekshiradi — cookie va header).
⚡️ Eng tez sinash — bir martalik test
Agar barchasini bir paytda qilishni xohlamasangiz, faqat (b) ni qiling:
// router.push(redirect);     ← O'chiring
window.location.href = redirect;  // ← Qo'shing
Lokal test:
npm run dev
Login qilib ko'ring — admin sahifaga o'tishi kerak. Ishlasa, git commit && push qiling.
Ishlamasa — auth-edge.ts faylini menga yuboring.