import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

function forbidden() {
  return NextResponse.json({ success: false, error: "Ruxsat yo'q" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth || auth.role !== "super_admin") return forbidden();

  const { clinicId } = await req.json();
  const res = NextResponse.json({ success: true });

  if (clinicId) {
    res.cookies.set("acting_clinic", clinicId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  } else {
    res.cookies.delete("acting_clinic");
  }
  return res;
}

export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth || auth.role !== "super_admin") return forbidden();

  const res = NextResponse.json({ success: true });
  res.cookies.delete("acting_clinic");
  return res;
}
