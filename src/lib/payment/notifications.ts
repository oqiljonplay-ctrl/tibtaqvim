import { prisma } from "@/lib/prisma";
import { formatSum } from "@/lib/payment/money";

/**
 * To'lov holati o'zgarganda bemorga Telegram xabar yuboradi.
 * Payme va Click handler'laridan chaqiriladi.
 */
export async function notifyPaymentResult(args: {
  appointmentId: string;
  paymentId: string;
  state: "paid" | "failed" | "cancelled" | "refunded";
}) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: args.appointmentId },
    include: { user: true, service: true, clinic: true },
  });
  if (!appointment?.user?.telegramId) return;

  const payment = await prisma.payment.findUnique({
    where: { id: args.paymentId },
  });
  if (!payment) return;

  const sum = formatSum(payment.amount);
  const dateStr = appointment.date.toISOString().slice(0, 10);

  let message = "";
  switch (args.state) {
    case "paid":
      message =
        `✅ To'lov qabul qilindi\n\n` +
        `🏥 ${appointment.clinic.name}\n` +
        `🩺 ${appointment.service.name}\n` +
        `💵 ${sum}\n\n` +
        `📅 Qabul: ${dateStr}`;
      break;
    case "failed":
      message =
        `❌ To'lov amalga oshmadi\n\n` +
        `${appointment.service.name}\n` +
        `${sum}\n\n` +
        `Iltimos, qaytadan urinib ko'ring.`;
      break;
    case "cancelled":
      message =
        `🚫 To'lov bekor qilindi\n\n` +
        `${appointment.service.name}\n` +
        `${sum}`;
      break;
    case "refunded":
      message =
        `↩️ To'lov qaytarib berildi\n\n` +
        `${appointment.service.name}\n` +
        `${sum}`;
      break;
  }

  try {
    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: appointment.user.telegramId,
          text: message,
        }),
      }
    );
  } catch (e) {
    console.error("[notify] Failed to send payment notification:", e);
  }
}
