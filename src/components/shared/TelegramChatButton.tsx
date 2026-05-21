"use client";

import { useState } from "react";

interface Props {
  telegramId: string | null | undefined;
  patientName?: string;
  appointmentId?: string;
  variant?: "button" | "icon" | "compact";
  className?: string;
  phone?: string | null;
}

export default function TelegramChatButton({
  telegramId,
  patientName,
  appointmentId,
  variant = "button",
  className = "",
}: Props) {
  const [opening, setOpening] = useState(false);

  const hasTelegram = !!(telegramId && telegramId.length > 0);

  const handleClick = () => {
    if (!hasTelegram || opening) return;
    setOpening(true);

    // Silent audit log
    fetch("/api/telegram-relay/log", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, patientTelegramId: telegramId, patientName }),
    }).catch(() => {});

    // tg://user?id=N — Telegram Desktop va mobil ilova uchun
    // Telegram o'rnatilmagan bo'lsa — phone orqali t.me
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `tg://user?id=${telegramId}`;
    } else {
      window.open(`tg://user?id=${telegramId}`, "_blank", "noopener,noreferrer");
    }

    setTimeout(() => setOpening(false), 2000);
  };

  if (!hasTelegram) {
    if (variant === "icon") return null;
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-gray-400 ${className}`}>
        Telegram yo&apos;q
      </span>
    );
  }

  if (variant === "icon") {
    return (
      <button
        onClick={handleClick}
        disabled={opening}
        title={`${patientName || "Bemor"} Telegram chatiga yozish`}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition disabled:opacity-50 ${className}`}
      >
        💬
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        onClick={handleClick}
        disabled={opening}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition disabled:opacity-50 ${className}`}
      >
        💬 {opening ? "Ochilmoqda..." : "Telegram"}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={opening}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition disabled:opacity-50 ${className}`}
    >
      <span>💬</span>
      <span>{opening ? "Ochilmoqda..." : "Telegram chatga yozish"}</span>
    </button>
  );
}
