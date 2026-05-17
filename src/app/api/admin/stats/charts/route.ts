import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { getAllChartsData, type ChartRange } from "@/lib/stats/charts";

export const dynamic = "force-dynamic";

const ALLOWED_RANGES: ChartRange[] = [7, 14, 30, 90];

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();

  if (auth.role !== "super_admin" && auth.role !== "clinic_admin") {
    return forbidden("Faqat admin grafiklarni ko'ra oladi");
  }

  // super_admin: barcha klinikalar (clinicId = null)
  // clinic_admin: faqat o'z klinikasi
  const clinicId = auth.role === "super_admin" ? null : auth.clinicId;

  const { searchParams } = new URL(req.url);
  const rangeParam = parseInt(searchParams.get("range") ?? "30", 10);
  const range: ChartRange = ALLOWED_RANGES.includes(rangeParam as ChartRange)
    ? (rangeParam as ChartRange)
    : 30;

  try {
    const data = await getAllChartsData(clinicId, range);
    return ok(data);
  } catch (err) {
    console.error("[stats/charts] error:", err);
    return error(
      { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Charts fetch failed" },
      500
    );
  }
}
