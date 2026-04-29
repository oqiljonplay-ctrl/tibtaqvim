import { prisma } from "@/lib/prisma";
import type { ServiceType, Prisma } from "@prisma/client";

export const DEFAULT_FLAGS: Record<string, boolean> = {
  enable_reminders: true,
  enable_tibid_display: true,
  enable_confirmation: true,
  enable_auto_close_webapp: false,
  enable_queue_mode: true,
};

export const FLAG_LABELS: Record<string, string> = {
  enable_reminders: "Eslatmalar yoqilgan",
  enable_tibid_display: "TibId ko'rsatish",
  enable_confirmation: "Tasdiqlash xabari",
  enable_auto_close_webapp: "WebApp avtomatik yopish",
  enable_queue_mode: "Navbat rejimi",
};

export async function getClinicConfig(clinicId: string) {
  let settings = await prisma.clinicSettings.findUnique({ where: { clinicId } });
  if (!settings) {
    settings = await prisma.clinicSettings.create({ data: { clinicId } });
  }
  return settings;
}

export async function isFeatureEnabled(clinicId: string, key: string): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({
    where: { clinicId_key: { clinicId, key } },
  });
  return flag?.enabled ?? DEFAULT_FLAGS[key] ?? false;
}

export async function getModuleConfig(clinicId: string, module: ServiceType) {
  const config = await prisma.moduleConfig.findUnique({
    where: { clinicId_module: { clinicId, module } },
  });
  return config ?? { enabled: true, config: {} };
}

export async function upsertModuleConfig(
  clinicId: string,
  module: ServiceType,
  enabled: boolean,
  config: Prisma.InputJsonValue = {}
) {
  return prisma.moduleConfig.upsert({
    where: { clinicId_module: { clinicId, module } },
    create: { clinicId, module, enabled, config },
    update: { enabled, config },
  });
}

export async function upsertFeatureFlag(clinicId: string, key: string, enabled: boolean) {
  return prisma.featureFlag.upsert({
    where: { clinicId_key: { clinicId, key } },
    create: { clinicId, key, enabled },
    update: { enabled },
  });
}

export async function createAuditLog(
  actorId: string,
  action: string,
  payload: Prisma.InputJsonValue,
  clinicId?: string
) {
  return prisma.auditLog.create({
    data: { actorId, action, payload, clinicId: clinicId ?? null },
  });
}
