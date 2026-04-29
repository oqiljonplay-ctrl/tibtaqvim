import TelegramBot, { InlineKeyboardButton } from "node-telegram-bot-api";
import { mkCalendarKeyboard, currentYearMonth } from "./calendar";

const WEBAPP_URL = process.env.NEXT_PUBLIC_WEBAPP_URL || "";

const typeEmojis: Record<string, string> = {
  doctor_queue: "👨‍⚕️",
  diagnostic: "🔬",
  home_service: "🏠",
};

// ─── Core helper ──────────────────────────────────────────────────────────────
// Tries editMessageText first. Falls back to sendMessage only if message is gone.
// Returns the final messageId used.

export async function editOrSend(
  bot: TelegramBot,
  chatId: number,
  messageId: number | undefined,
  text: string,
  keyboard: InlineKeyboardButton[][]
): Promise<number> {
  const markup = { inline_keyboard: keyboard };

  if (messageId) {
    try {
      await (bot as any).editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: markup,
      });
      return messageId;
    } catch (err: any) {
      // "message is not modified" — content unchanged, keep same id
      if (typeof err?.message === "string" && err.message.includes("message is not modified")) {
        return messageId;
      }
      // Other errors (deleted message, too old, etc.) — fall through to send
    }
  }

  const sent = await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: markup,
  });
  return sent.message_id;
}

// ─── Keyboard builders ────────────────────────────────────────────────────────

// Pastki persistent tugma uchun (reply keyboard)
export function mkWebAppReplyKeyboard() {
  return {
    keyboard: [[{ text: "🌐 Onlayn bron (Web App)", web_app: { url: WEBAPP_URL } }]],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

export function mkRemoveKeyboard() {
  return { remove_keyboard: true as const };
}

export function mkServiceKeyboard(services: any[], showWebAppInline = false): InlineKeyboardButton[][] {
  const rows: InlineKeyboardButton[][] = [];

  if (showWebAppInline && WEBAPP_URL) {
    rows.push([{ text: "📱 Onlayn bron (Web App)", web_app: { url: WEBAPP_URL } } as any]);
  }

  for (const s of services) {
    const emoji = typeEmojis[s.type] ?? "🏥";
    const pricePart = s.price != null ? ` — ${formatPrice(s.price)}` : "";
    const limitPart =
      s.dailyLimit != null
        ? s.isAvailable !== false
          ? ` (${s.todayCount ?? 0}/${s.dailyLimit})`
          : " ❌ To'ldi"
        : "";
    rows.push([{
      text: `${emoji} ${s.name}${pricePart}${limitPart}`,
      callback_data: s.isAvailable !== false ? `svc:${s.id}:${s.type}` : `full:${s.id}`,
    }]);
  }

  return rows;
}

export function mkWelcomeBackKeyboard(): InlineKeyboardButton[][] {
  return [[
    { text: "✅ Ha, davom etish", callback_data: "use_saved" },
    { text: "✏️ O'zgartirish", callback_data: "change_info" },
  ]];
}

export function mkDateKeyboard(): InlineKeyboardButton[][] {
  const { year, month } = currentYearMonth();
  return mkDateKeyboardForMonth(year, month);
}

export function mkDateKeyboardForMonth(year: number, month: number): InlineKeyboardButton[][] {
  return [
    ...mkCalendarKeyboard(year, month),
    [back("select_service")],
  ];
}

export function mkDoctorKeyboard(doctors: any[]): InlineKeyboardButton[][] {
  return [
    ...doctors.map((d: any) => [{
      text: `👨‍⚕️ ${d.firstName} ${d.lastName} — ${d.specialty}`,
      callback_data: `doc:${d.id}`,
    }]),
    [{ text: "➡️ Shifokorsiez davom etish", callback_data: "doc:none" }],
    [back("select_date")],
  ];
}

export function mkSlotKeyboard(slots: any[]): InlineKeyboardButton[][] {
  return [
    ...slots.map((s: any) => [{
      text: `🕐 ${s.startTime} — ${s.endTime}`,
      callback_data: `slot:${s.id}`,
    }]),
    [back("select_date")],
  ];
}

export function mkNameKeyboard(backStep: string): InlineKeyboardButton[][] {
  return [[back(backStep)]];
}

export function mkPhoneKeyboard(): InlineKeyboardButton[][] {
  return [[back("enter_name")]];
}

export function mkAddressKeyboard(): InlineKeyboardButton[][] {
  return [[back("enter_phone")]];
}

export function mkConfirmKeyboard(): InlineKeyboardButton[][] {
  return [
    [
      { text: "✅ Tasdiqlash", callback_data: "confirm" },
      { text: "❌ Bekor", callback_data: "cancel" },
    ],
    [back("enter_name")],
  ];
}

// ─── Text builders ────────────────────────────────────────────────────────────

export function mkConfirmText(state: any): string {
  const dateLabel = new Date(state.date + "T00:00:00").toLocaleDateString("uz-UZ", {
    weekday: "long", day: "numeric", month: "long",
  });
  return [
    "📋 *Ma'lumotlarni tasdiqlang:*",
    "",
    `👤 Ism: *${state.patientName}*`,
    `📞 Telefon: *${state.patientPhone}*`,
    `📅 Sana: *${dateLabel}*`,
    state.servicePrice != null ? `💰 Narx: *${formatPrice(state.servicePrice)}*` : "",
    state.address ? `📍 Manzil: *${state.address}*` : "",
  ].filter(Boolean).join("\n");
}

// ─── Private ──────────────────────────────────────────────────────────────────

function back(step: string): InlineKeyboardButton {
  return { text: "⬅️ Orqaga", callback_data: `back:${step}` };
}

function formatPrice(price: number): string {
  return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
}
