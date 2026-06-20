import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden, serverError } from "@/lib/api-response";
import { canManageResources } from "@/lib/branch-scope";
import { createAuditLog } from "@/lib/services/config.service";
import { ApiError } from "@/lib/services/employment.service";
import {
  assertShowcaseBlockCapacity,
  nextBlockOrder,
  ShowcaseTabT,
} from "@/lib/services/showcase.service";

const TABS: ShowcaseTabT[] = ["doctors", "services"];

function clinicOf(auth: { role: string; clinicId: string | null }, explicit?: string | null): string | null {
  return auth.role === "super_admin" ? (explicit ?? null) : auth.clinicId;
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!canManageResources(auth)) return forbidden();
  const tab = req.nextUrl.searchParams.get("tab") as ShowcaseTabT | null;
  if (!tab || !TABS.includes(tab)) return error("tab noto'g'ri (doctors|services)", 400);
  const clinicId = clinicOf(auth, req.nextUrl.searchParams.get("clinicId"));
  if (!clinicId) return error("Klinika aniqlanmadi", 400);
  const blocks = await prisma.showcaseBlock.findMany({
    where: { clinicId, tab, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: { media: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } } },
  });
  return ok(blocks);
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!canManageResources(auth)) return forbidden();
  const body = await req.json();
  const tab = body.tab as ShowcaseTabT;
  if (!TABS.includes(tab)) return error("tab noto'g'ri", 400);
  const clinicId = clinicOf(auth, body.clinicId);
  if (!clinicId) return error("Klinika aniqlanmadi", 400);
  if (!body.title || String(body.title).trim() === "") return error("Sarlavha kerak", 400);
  try {
    const block = await prisma.$transaction(async (tx) => {
      await assertShowcaseBlockCapacity(tx, clinicId, tab);
      const sortOrder = await nextBlockOrder(tx, clinicId, tab);
      return tx.showcaseBlock.create({
        data: {
          clinicId,
          tab,
          sortOrder,
          source: ["em", "service", "manual"].includes(body.source) ? body.source : "manual",
          employeeId: body.employeeId ?? null,
          serviceId: body.serviceId ?? null,
          title: String(body.title).trim(),
          subtitle: body.subtitle ? String(body.subtitle).trim() : null,
          showRating: body.showRating !== false,
          cta: body.cta === "generic" ? "generic" : "auto",
          createdBy: auth.userId,
        },
      });
    });
    await createAuditLog(auth.userId, "showcase.block_created", { blockId: block.id, tab }, clinicId);
    return created(block);
  } catch (e: unknown) {
    if (e instanceof ApiError) return error(e.message, e.statusCode);
    console.error("showcase block POST", e);
    return serverError();
  }
}
