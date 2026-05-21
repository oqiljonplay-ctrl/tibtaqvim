import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { key } = await req.json();
  const expected = (process.env.SUPERADMIN_KEY ?? "").trim();

  if (!expected || key.trim() !== expected) {
    return NextResponse.json({ success: false, error: "Kalit noto'g'ri" }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set("sa_key", key.trim(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax" — client-side navigatsiya (router.push) + middleware redirect
    // bilan to'g'ri ishlaydi. "strict" cookie'ni birinchi navigatsiyada
    // yubormaydi va /admin/super/auth loop yuzaga keladi (auth_token ham "lax").
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 kun (dasturchi gate'i)
    path: "/",
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ success: true });
  res.cookies.delete("sa_key");
  return res;
}
