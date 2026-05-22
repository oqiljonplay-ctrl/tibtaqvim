"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  telegramId: string | null | undefined;
  patientName?: string;
  phone?: string | null;
  appointmentId?: string;
  variant?: "button" | "compact" | "icon";
  className?: string;
}

interface AttachedFile {
  file: File;
  preview: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const QUICK_TEMPLATES = [
  "Tahlil natijasi tayyor. Klinikaga keling.",
  "Iltimos, klinikaga belgilangan vaqtda keling.",
  "Tahlil namunangiz olindi, natija tez orada tayyor bo'ladi.",
  "Qo'shimcha ma'lumot uchun klinikaga qo'ng'iroq qiling.",
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function TelegramChatButton({
  telegramId,
  patientName = "Bemor",
  phone,
  appointmentId,
  variant = "button",
  className = "",
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const hasTelegram = !!(telegramId && telegramId.length > 0);

  if (!hasTelegram) {
    if (variant === "icon") return null;
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs text-gray-400 ${className}`}
        title="Bemor Telegram orqali ro'yxatdan o'tmagan"
      >
        Telegram yo&apos;q
      </span>
    );
  }

  const buttonClass = {
    icon: "inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600",
    compact:
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium",
    button:
      "inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium",
  }[variant];

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        title={
          variant === "icon" ? `${patientName}ga xabar yuborish` : undefined
        }
        className={`${buttonClass} transition ${className}`}
      >
        <span>💬</span>
        {variant !== "icon" && <span>Telegram</span>}
      </button>

      {modalOpen && (
        <TelegramRelayModal
          telegramId={telegramId!}
          patientName={patientName}
          phone={phone}
          appointmentId={appointmentId}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  telegramId: string;
  patientName: string;
  phone?: string | null;
  appointmentId?: string;
  onClose: () => void;
}

function TelegramRelayModal({
  telegramId,
  patientName,
  phone,
  appointmentId,
  onClose,
}: ModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // ── File handlers ──────────────────────────────────────────────────────────

  const addFiles = useCallback(async (newFiles: File[]) => {
    setError(null);
    const validFiles: AttachedFile[] = [];

    for (const file of newFiles) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`Format qo'llab-quvvatlanmaydi: ${file.name}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`Fayl 20 MB dan oshmasin: ${file.name}`);
        continue;
      }

      let preview: string | null = null;
      if (file.type.startsWith("image/")) {
        try {
          preview = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        } catch {
          preview = null;
        }
      }

      validFiles.push({ file, preview });
    }

    if (validFiles.length > 0) {
      setFiles([validFiles[0]]);
      if (newFiles.length > 1) {
        setError("Bir vaqtda faqat 1 ta fayl yuborilishi mumkin");
      }
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list && list.length > 0) addFiles(Array.from(list));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target === dropZoneRef.current) setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) addFiles(dropped);
  };

  // Paste from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pasted: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            const ext = file.type.split("/")[1] || "png";
            pasted.push(
              new File([file], `clipboard_${Date.now()}.${ext}`, {
                type: file.type,
              })
            );
          }
        }
      }

      if (pasted.length > 0) {
        e.preventDefault();
        addFiles(pasted);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [addFiles]);

  // ESC to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [sending, onClose]);

  // ── Send handlers ──────────────────────────────────────────────────────────

  const sendMessage = async (): Promise<{ success: boolean; error?: string }> => {
    const res = await fetch("/api/telegram-relay/send-message", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramId,
        message: message.trim(),
        appointmentId,
        patientName,
      }),
    });
    const json = await res.json();
    return { success: json.success === true, error: json.error?.message };
  };

  const sendFile = (attached: AttachedFile): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const fd = new FormData();
      fd.append("file", attached.file);
      fd.append("telegramId", telegramId);
      if (message.trim()) fd.append("caption", message.trim());
      if (appointmentId) fd.append("appointmentId", appointmentId);
      if (patientName) fd.append("patientName", patientName);

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve({ success: result.success === true, error: result.error?.message });
        } catch {
          resolve({ success: false, error: "Javob xatosi" });
        }
      };
      xhr.onerror = () => resolve({ success: false, error: "Tarmoq xatosi" });
      xhr.open("POST", "/api/telegram-relay/send-file");
      xhr.withCredentials = true;
      xhr.send(fd);
    });
  };

  const handleSend = async () => {
    if (sending) return;

    const hasMessage = message.trim().length > 0;
    const hasFile = files.length > 0;

    if (!hasMessage && !hasFile) {
      setError("Xabar yoki fayl kiriting");
      return;
    }

    setSending(true);
    setError(null);
    setProgress(0);

    try {
      const result = hasFile ? await sendFile(files[0]) : await sendMessage();

      if (result.success) {
        setSent(true);
        setTimeout(() => onClose(), 900);
      } else {
        setError(result.error || "Yuborib bo'lmadi");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Xato");
    } finally {
      setSending(false);
      setProgress(0);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && !sending && onClose()}
    >
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-white rounded-2xl shadow-xl max-w-md w-full p-4 max-h-[90vh] overflow-y-auto relative transition ${
          dragOver ? "ring-4 ring-blue-400 ring-offset-2" : ""
        }`}
      >
        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 bg-blue-50/95 rounded-2xl flex items-center justify-center pointer-events-none z-10">
            <div className="text-center">
              <div className="text-5xl mb-2">📥</div>
              <p className="font-semibold text-blue-700">Tortib tashlang</p>
            </div>
          </div>
        )}

        {/* Success overlay */}
        {sent && (
          <div className="absolute inset-0 bg-white/95 rounded-2xl flex items-center justify-center z-10">
            <div className="text-center">
              <div className="text-5xl mb-2">✅</div>
              <p className="font-semibold text-green-700">Xabar yuborildi!</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-base">💬 Telegram xabar</h3>
            <p className="text-xs text-gray-500 truncate">Kimga: {patientName}</p>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-2 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {/* Quick templates */}
        {files.length === 0 && message.length === 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1.5">Tezkor matnlar:</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMessage(tpl)}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-left"
                >
                  {tpl.length > 35 ? tpl.slice(0, 35) + "…" : tpl}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message textarea */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            files.length > 0 ? "Faylga izoh (ixtiyoriy)..." : "Xabar matni..."
          }
          rows={files.length > 0 ? 2 : 4}
          maxLength={files.length > 0 ? 1024 : 3000}
          disabled={sending}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50"
        />
        <p className="text-xs text-gray-400 mt-0.5 mb-3">
          {message.length} / {files.length > 0 ? 1024 : 3000}
        </p>

        {/* File zone */}
        {files.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg p-4 text-center cursor-pointer transition mb-3"
          >
            <div className="text-2xl mb-1">📎</div>
            <p className="text-sm text-gray-600">
              Tortib tashlang yoki{" "}
              <span className="text-blue-600 font-medium">tanlang</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Ctrl+V — rasmni yopishtirish
            </p>
            <p className="text-xs text-gray-400">
              PDF, DOC, JPG, PNG, WEBP · max 20 MB
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-3">
              {files[0].preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={files[0].preview}
                  alt="preview"
                  className="w-16 h-16 object-cover rounded"
                />
              ) : (
                <div className="text-3xl">
                  {files[0].file.type === "application/pdf"
                    ? "📄"
                    : files[0].file.type.includes("word")
                    ? "📝"
                    : "📎"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {files[0].file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatSize(files[0].file.size)}
                  {files[0].file.type.startsWith("image/")
                    ? " · Photo"
                    : " · Document"}
                </p>
              </div>
              <button
                onClick={() => setFiles([])}
                disabled={sending}
                className="text-red-500 hover:text-red-700 disabled:opacity-50 text-sm"
                title="O'chirish"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif"
          onChange={handleFileInput}
          className="hidden"
        />

        {/* Progress */}
        {sending && progress > 0 && progress < 100 && (
          <div className="mb-3">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">
              {progress}%
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSend}
            disabled={sending || (!message.trim() && files.length === 0)}
            className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
          >
            {sending
              ? progress > 0
                ? `Yuborilmoqda ${progress}%`
                : "Yuborilmoqda..."
              : files.length > 0
              ? "📤 Fayl yuborish"
              : "📤 Yuborish"}
          </button>
          <button
            onClick={onClose}
            disabled={sending}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm disabled:opacity-50"
          >
            Bekor
          </button>
        </div>

        {/* Phone fallback */}
        {phone && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <a
              href={`tel:${phone}`}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs"
            >
              📞 Qo&apos;ng&apos;iroq: {phone}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
