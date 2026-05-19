/**
 * Payme JSON-RPC 2.0 protokol tiplari.
 * Hujjat: https://developer.help.paycom.uz/metody-merchant-api/
 */

// ============ JSON-RPC Envelope ============

export interface PaymeRpcRequest<P = unknown> {
  jsonrpc?: "2.0";
  id: number | string;
  method: PaymeMethod;
  params: P;
}

export interface PaymeRpcSuccess<R = unknown> {
  jsonrpc?: "2.0";
  id: number | string | null;
  result: R;
}

export interface PaymeRpcError {
  jsonrpc?: "2.0";
  id: number | string | null;
  error: {
    code: number;
    message: PaymeLocalizedMessage;
    data?: string;
  };
}

export type PaymeRpcResponse<R = unknown> = PaymeRpcSuccess<R> | PaymeRpcError;

export interface PaymeLocalizedMessage {
  uz: string;
  ru: string;
  en: string;
}

// ============ Method nomlari ============

export type PaymeMethod =
  | "CheckPerformTransaction"
  | "CreateTransaction"
  | "PerformTransaction"
  | "CancelTransaction"
  | "CheckTransaction"
  | "GetStatement";

// ============ Account ============

export interface PaymeAccount {
  appointment_id: string;
}

// ============ CheckPerformTransaction ============

export interface CheckPerformTransactionParams {
  amount: number;
  account: PaymeAccount;
}

export interface CheckPerformTransactionResult {
  allow: boolean;
  detail?: PaymeReceiptDetail;
}

// ============ CreateTransaction ============

export interface CreateTransactionParams {
  id: string;
  time: number;
  amount: number;
  account: PaymeAccount;
}

export interface CreateTransactionResult {
  create_time: number;
  transaction: string;
  state: 1;
  receivers?: null;
}

// ============ PerformTransaction ============

export interface PerformTransactionParams {
  id: string;
}

export interface PerformTransactionResult {
  transaction: string;
  perform_time: number;
  state: 2;
}

// ============ CancelTransaction ============

export interface CancelTransactionParams {
  id: string;
  reason: PaymeCancelReason;
}

export interface CancelTransactionResult {
  transaction: string;
  cancel_time: number;
  state: -1 | -2;
}

export type PaymeCancelReason = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// ============ CheckTransaction ============

export interface CheckTransactionParams {
  id: string;
}

export interface CheckTransactionResult {
  create_time: number;
  perform_time: number;
  cancel_time: number;
  transaction: string;
  state: -2 | -1 | 1 | 2;
  reason: PaymeCancelReason | null;
}

// ============ GetStatement ============

export interface GetStatementParams {
  from: number;
  to: number;
}

export interface GetStatementResult {
  transactions: Array<{
    id: string;
    time: number;
    amount: number;
    account: PaymeAccount;
    create_time: number;
    perform_time: number;
    cancel_time: number;
    transaction: string;
    state: -2 | -1 | 1 | 2;
    reason: PaymeCancelReason | null;
    receivers?: null;
  }>;
}

// ============ Receipt detail (fiskal) ============

export interface PaymeReceiptDetail {
  receipt_type?: number;
  items?: Array<{
    title: string;
    price: number;
    count: number;
    code: string;
    units: number;
    vat_percent: number;
    package_code: string;
  }>;
}

export const PAYME_STATE_TO_OUR_STATE = {
  1: "authorized",
  2: "paid",
  "-1": "cancelled",
  "-2": "refunded",
} as const;
