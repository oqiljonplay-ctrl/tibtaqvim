import TelegramBot from "node-telegram-bot-api";
import { prisma } from "@/lib/prisma";

export async function handleEditedMessage(_bot: TelegramBot, msg: any) {
  if (!msg?.location) return;

  const location = msg.location;
  const messageId = BigInt(msg.message_id);

  try {
    const appointment = await prisma.appointment.findFirst({
      where: {
        liveMessageId: messageId,
        liveStatus: "active",
      },
    });

    if (!appointment) return;

    const now = new Date();

    if (appointment.liveExpiresAt && appointment.liveExpiresAt < now) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { liveStatus: "expired" },
      });
      return;
    }

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        liveLat: location.latitude,
        liveLng: location.longitude,
        liveLastUpdatedAt: now,
      },
    });
  } catch (err) {
    console.error("[editedMessage] live update failed:", err);
  }
}
