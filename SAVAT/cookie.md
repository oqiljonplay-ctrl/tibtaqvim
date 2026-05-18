Cookie tuzatish kodi
Fayl: src/app/api/auth/login/route.ts
Eski qator(lar) (taxminan shunday):
return ok({ token, user: { id, role, clinicId, firstName } });
Yangi kod bilan ALMASHTIRING:
import { NextResponse } from 'next/server';

// ... mavjud login logikasi ...

// JSON response (token YO'Q response body'da)
const response = NextResponse.json({
  ok: true,
  user: { id, role, clinicId, firstName }
});

// HttpOnly cookie set qilish
response.cookies.set('auth_token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24, // 24 soat
  path: '/',
});

return response;
Fayl: src/app/api/auth/logout/route.ts (agar mavjud bo'lsa)
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('auth_token');
  return response;
}
Frontend tomonidan — barcha document.cookie = "auth_token=..." qatorlarni o'chiring. Cookie endi avtomatik backend tomonidan keladi va brauzerga ham avtomatik saqlanadi.
Qidiruv qaytaring (VS Code): Ctrl+Shift+F → document.cookie — barcha topilgan joylarni ko'rib, auth_token bilan bog'liqlarini o'chiring.
Frontend tomonidan login chaqirish — fetch ga credentials: 'include' qo'shing:
const res = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include', // ⚠️ MUHIM - cookie qabul qilish uchun
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone, password })
});
Va boshqa har qanday /api/... chaqirig'iga ham credentials: 'include' qo'shing.
⏸️ TO'XTAB TURING
Hozir Portsiya #1 ning server qismi tugadi (RLS + Audit). Mijoz tomon sizning ishingiz.
Vazifangiz:
Yuqoridagi login/route.ts kodini almashtiring
Frontend'da document.cookie = "auth_token..." qatorlarini o'chiring
fetch chaqiriqlariga credentials: 'include' qo'shing
Logout route'ni yangilang (agar bor bo'lsa)
Lokal test qiling:
npm run dev
Login qilib ko'ring
DevTools → Application → Cookies — auth_token HttpOnly bilan ko'rinishi kerak
Git commit + push qiling
Vercel deploy bo'lgach menga ayting: "Portsiya 1 tayyor"
Men Vercel deploy log'larini kuzataman, runtime xatolar bor-yo'qligini tasdiqlayman.
Keyin → Portsiya #2 (Webhook secret + JWT 24h)
Eslatma: Parol almashtirildi? Hali ham javob yo'q. Bu eng birinchi navbatda hal qilinishi kerak edi.
Boshlaylik 1-portsiya bilan — natijani kutaman.