import { createHash } from "crypto";

/**
 * Click Prepare sign:
 * md5(click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time)
 */
export function buildPrepareSignString(params: {
  clickTransId: string;
  serviceId: string;
  secretKey: string;
  merchantTransId: string;
  amount: string;
  action: string;
  signTime: string;
}): string {
  const raw =
    params.clickTransId +
    params.serviceId +
    params.secretKey +
    params.merchantTransId +
    params.amount +
    params.action +
    params.signTime;
  return md5(raw);
}

/**
 * Click Complete sign:
 * md5(click_trans_id + service_id + secret_key + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
 */
export function buildCompleteSignString(params: {
  clickTransId: string;
  serviceId: string;
  secretKey: string;
  merchantTransId: string;
  merchantPrepareId: string;
  amount: string;
  action: string;
  signTime: string;
}): string {
  const raw =
    params.clickTransId +
    params.serviceId +
    params.secretKey +
    params.merchantTransId +
    params.merchantPrepareId +
    params.amount +
    params.action +
    params.signTime;
  return md5(raw);
}

function md5(s: string): string {
  return createHash("md5").update(s, "utf8").digest("hex");
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
