export const CLICK_ERROR_CODES = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  INVALID_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  USER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  FAILED_TO_UPDATE_USER: -7,
  ERROR_IN_REQUEST: -8,
  TRANSACTION_CANCELLED: -9,
} as const;

export type ClickErrorCode = (typeof CLICK_ERROR_CODES)[keyof typeof CLICK_ERROR_CODES];

export const CLICK_ERROR_NOTES: Record<number, string> = {
  [0]: "Success",
  [-1]: "SIGN CHECK FAILED!",
  [-2]: "Incorrect parameter amount",
  [-3]: "Action not found",
  [-4]: "Already paid",
  [-5]: "User does not exist",
  [-6]: "Transaction does not exist",
  [-7]: "Failed to update user",
  [-8]: "Error in request from click",
  [-9]: "Transaction cancelled",
};

export class ClickError extends Error {
  constructor(
    public code: ClickErrorCode | number,
    public note?: string
  ) {
    super(note || CLICK_ERROR_NOTES[code] || "Unknown Click error");
    this.name = "ClickError";
  }

  toResponse() {
    return {
      error: this.code,
      error_note: this.note || CLICK_ERROR_NOTES[this.code] || "Unknown error",
    };
  }
}

export const CLICK_ACTIONS = {
  PREPARE: 0,
  COMPLETE: 1,
} as const;
