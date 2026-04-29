import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { key } = await req.json();
  const expected = (process.env.SUPERADMIN_KEY ?? "").trim();

  if (!expected || key.trim() !== expected) {
    return NextResponse.json({ success: false, error: "Kalit noto'g'ri" }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set("sa_key", key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 8, // 8 soat
    path: "/",
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ success: true });
  res.cookies.delete("sa_key");
  return res;
}
