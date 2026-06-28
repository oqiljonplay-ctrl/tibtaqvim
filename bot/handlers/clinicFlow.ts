import TelegramBot from "node-telegram-bot-api";
import { prisma } from "@/lib/prisma";
import { userState } from "../state";
import { fetchServices } from "../api";
import { editOrSend, mkBranchKeyboard, mkServiceKeyboard, mkClinicKeyboard } from "../helpers/render";

/**
 * Klinika tanlanganidan keyin:
 * - 1 ta filial → to'g'ridan xizmatlar
 * - Ko'p filial → filial tanlash
 */
export async function showBranchOrService(
  bot: TelegramBot,
  chatId: number,
  clinicId: string,
  msgId?: number
) {
  const state = await userState.get(chatId) ?? {};

  const branches = await prisma.branch.findMany({
    where:   { clinicId, isActive: true },
    select:  { id: true, name: true, nearbyMetro: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  if (branches.length === 0) {
    await bot.sendMessage(chatId, "⚠️ Bu klinikada hali faol filial yo'q. Keyinroq urinib ko'ring.");
    return;
  }

  if (branches.length === 1) {
    // Auto-skip branch selection
    const autoState = { ...state, clinicId, branchId: branches[0].id, step: "select_service", _createdAt: Date.now() };
    await userState.set(chatId, autoState);
    return showServiceSelection(bot, chatId, clinicId, branches[0].id, msgId, autoState);
  }

  const newMsgId = await editOrSend(
    bot, chatId, msgId,
    "📍 *Filialni tanlang:*",
    mkBranchKeyboard(branches)
  );

  await userState.set(chatId, {
    ...state,
    clinicId,
    step:      "select_branch",
    _branches: branches,
    _createdAt: Date.now(),
    messageId: newMsgId,
  });
}

/**
 * Filial tanlanganidan keyin xizmatlar
 */
export async function showServiceSelection(
  bot: TelegramBot,
  chatId: number,
  clinicId: string,
  branchId: string,
  msgId?: number,
  passedState?: Record<string, any>
) {
  const state = passedState ?? await userState.get(chatId) ?? {};
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });

  const { services } = await fetchServices(clinicId, today, branchId);

  if (!services.length) {
    await bot.sendMessage(chatId, "⚠️ Bu klinikada hozirda xizmatlar yo'q. Keyinroq urinib ko'ring.");
    return;
  }

  const newMsgId = await editOrSend(
    bot, chatId, msgId,
    "🏥 *ClinicBot ga xush kelibsiz!*\n\nQaysi xizmatdan foydalanmoqchisiz?",
    mkServiceKeyboard(services)
  );

  await userState.set(chatId, {
    ...state,
    clinicId,
    branchId,
    step:      "select_service",
    _services: services,
    _createdAt: Date.now(),
    messageId: newMsgId,
  });
}

/**
 * Callback: clinic:<id>
 */
export async function handleClinicCallback(
  bot: TelegramBot,
  chatId: number,
  clinicId: string,
  msgId?: number
) {
  const state = await userState.get(chatId) ?? {};
  await userState.set(chatId, { ...state, clinicId, step: "select_branch" });
  return showBranchOrService(bot, chatId, clinicId, msgId);
}

/**
 * Callback: branch:<id>
 */
export async function handleBranchCallback(
  bot: TelegramBot,
  chatId: number,
  branchId: string,
  msgId?: number
) {
  const state = await userState.get(chatId) ?? {};
  const nextState = { ...state, branchId, step: "select_service" };
  await userState.set(chatId, nextState);
  return showServiceSelection(bot, chatId, state.clinicId, branchId, msgId, nextState);
}

/**
 * back:select_clinic — klinika tanlov sahifasiga qaytish
 */
export async function handleBackToClinic(
  bot: TelegramBot,
  chatId: number,
  msgId?: number
) {
  const state = await userState.get(chatId) ?? {};
  const clinics: Array<{ id: string; name: string; city?: string | null }> =
    state._clinics ?? await prisma.clinic.findMany({
      where: { isActive: true, deletedAt: null, subscriptionStatus: { in: ["trial", "active"] } },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
      take:    20,
    });

  if (clinics.length === 1) {
    return showBranchOrService(bot, chatId, clinics[0].id, msgId);
  }

  const newMsgId = await editOrSend(
    bot, chatId, msgId,
    "🏥 *Klinikani tanlang:*",
    mkClinicKeyboard(clinics)
  );

  await userState.set(chatId, {
    ...state,
    step:      "select_clinic",
    _clinics:  clinics,
    _createdAt: Date.now(),
    messageId: newMsgId,
    clinicId:  undefined,
    branchId:  undefined,
  });
}
