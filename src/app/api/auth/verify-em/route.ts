import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized } from "@/lib/api-response";
import { normalizeEmId } from "@/lib/services/em-id.service";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const allowed = await rateLimit(`em:min:${ip}`, 5, 60_000);
    if (!allowed) return error("Juda ko'p urinish. Keyinroq qayta urining.", 429);

    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const { emId: rawEmId } = await req.json();
    if (!rawEmId || typeof rawEmId !== "string") return error("EM id kiritilmadi");

    const employee = await prisma.employee.findUnique({ where: { userId: auth.userId } });
    if (!employee) return error("Sizga EM id biriktirilmagan", 400);

    if (normalizeEmId(rawEmId) !== employee.emId) {
      return error({ code: "EM_WRONG", message: "EM id noto'g'ri" }, 401);
    }

    const res = NextResponse.json({ success: true, data: { emId: employee.emId } });
    res.cookies.set("em_key", employee.emId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    });
    return res;
  } catch {
    return error("Server error", 500);
  }
}
