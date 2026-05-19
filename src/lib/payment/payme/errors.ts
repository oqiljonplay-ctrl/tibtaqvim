import type { PaymeLocalizedMessage } from "./types";

export const PAYME_ERROR_CODES = {
  INVALID_HTTP_METHOD: -32300,
  JSON_PARSE_ERROR: -32700,
  INVALID_RPC_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INSUFFICIENT_PRIVILEGE: -32504,
  SYSTEM_ERROR: -32400,
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANNOT_CANCEL_COMPLETED: -31007,
  CANNOT_PERFORM_OPERATION: -31008,
  ACCOUNT_NOT_FOUND: -31050,
  APPOINTMENT_NOT_PAYABLE: -31051,
} as const;

export type PaymeErrorCode =
  (typeof PAYME_ERROR_CODES)[keyof typeof PAYME_ERROR_CODES];

export const PAYME_ERROR_MESSAGES: Record<number, PaymeLocalizedMessage> = {
  [-32300]: {
    uz: "So'rov turi noto'g'ri",
    ru: "Неверный тип запроса",
    en: "Invalid request method",
  },
  [-32700]: {
    uz: "JSON parslashda xato",
    ru: "Ошибка парсинга JSON",
    en: "JSON parse error",
  },
  [-32600]: {
    uz: "So'rovda majburiy maydonlar yo'q",
    ru: "Отсутствуют обязательные поля",
    en: "Invalid request",
  },
  [-32601]: {
    uz: "Metod topilmadi",
    ru: "Метод не найден",
    en: "Method not found",
  },
  [-32504]: {
    uz: "Yetarli imtiyoz yo'q",
    ru: "Недостаточно привилегий",
    en: "Insufficient privilege",
  },
  [-32400]: {
    uz: "Tizim xatosi",
    ru: "Системная ошибка",
    en: "System error",
  },
  [-31001]: {
    uz: "Noto'g'ri summa",
    ru: "Неверная сумма",
    en: "Invalid amount",
  },
  [-31003]: {
    uz: "Tranzaksiya topilmadi",
    ru: "Транзакция не найдена",
    en: "Transaction not found",
  },
  [-31007]: {
    uz: "Tranzaksiyani bekor qilib bo'lmaydi",
    ru: "Невозможно отменить транзакцию",
    en: "Cannot cancel transaction",
  },
  [-31008]: {
    uz: "Operatsiyani bajarib bo'lmaydi",
    ru: "Невозможно выполнить операцию",
    en: "Cannot perform operation",
  },
  [-31050]: {
    uz: "Qabul nomerini topib bo'lmadi",
    ru: "Номер приёма не найден",
    en: "Appointment not found",
  },
  [-31051]: {
    uz: "Qabul uchun to'lov qabul qilinmaydi",
    ru: "Приём не принимает оплату",
    en: "Appointment is not payable",
  },
};

export class PaymeError extends Error {
  constructor(
    public code: PaymeErrorCode | number,
    public data?: string,
    public localizedMessage?: PaymeLocalizedMessage
  ) {
    super(
      localizedMessage?.ru ||
        PAYME_ERROR_MESSAGES[code]?.ru ||
        "Unknown Payme error"
    );
    this.name = "PaymeError";
  }

  toRpcError(id: number | string | null) {
    return {
      jsonrpc: "2.0" as const,
      id,
      error: {
        code: this.code,
        message:
          this.localizedMessage ||
          PAYME_ERROR_MESSAGES[this.code] || {
            uz: "Noma'lum xato",
            ru: "Неизвестная ошибка",
            en: "Unknown error",
          },
        ...(this.data ? { data: this.data } : {}),
      },
    };
  }
}
