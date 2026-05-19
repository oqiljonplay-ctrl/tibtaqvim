/**
 * Provider secret'larini shifrlash/deshifrlash.
 *
 * HOZIR: Identity (pass-through). Hech narsa qilmaydi.
 * KELAJAK (Sprint 4): KMS/libsodium/AWS Secrets Manager integratsiyasi.
 *
 * Bu funksiyalarni ishlatish HOZIRDAN MAJBURIY — keyin almashtirish oson bo'lsin uchun.
 */

export function encryptSecret(plain: string): string {
  // TODO(Sprint 4): KMS bilan shifrlash
  return plain;
}

export function decryptSecret(stored: string): string {
  // TODO(Sprint 4): KMS bilan deshifrlash
  return stored;
}

export function maskSecret(secret: string | undefined): string {
  if (!secret) return "(yo'q)";
  if (secret.length <= 4) return "****";
  return secret.slice(0, 2) + "****" + secret.slice(-2);
}
