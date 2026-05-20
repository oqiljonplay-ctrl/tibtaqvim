import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Payment provider secret'larini AES-256-GCM bilan shifrlash/deshifrlash.
 *
 * Format: enc:v1:<iv_base64>:<ciphertext_base64>:<authtag_base64>
 *
 * Backward compatibility: agar matn "enc:v1:" prefiksi bilan boshlanmasa,
 * u plaintext deb hisoblanadi va o'zgartirilmasdan qaytariladi (eski data).
 * Bu Phase 0.8.3 deployment'idan oldin yozilgan secret'lar bilan ishlash uchun.
 *
 * KELAJAK (Sprint 5): migrate-payment-secrets.ts script orqali barcha eski
 * plaintext secret'lar encrypted formatga ko'chiriladi va backward compat olib tashlanadi.
 */

const ENC_PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM uchun standart
const KEY_LENGTH = 32; // AES-256 uchun 32 byte

function getMasterKey(): Buffer {
  const raw = process.env.PAYMENT_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "PAYMENT_ENCRYPTION_KEY env variable not set. Generate one with: openssl rand -base64 32"
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `PAYMENT_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (current: ${key.length}). ` +
      `Use: openssl rand -base64 32`
    );
  }
  return key;
}

/**
 * Plaintext matnni encrypt qiladi.
 * Natija: enc:v1:<iv>:<ciphertext>:<authtag> formatda string.
 */
export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  // Idempotency: agar allaqachon encrypted bo'lsa, qayta encrypt qilmaymiz
  if (plain.startsWith(ENC_PREFIX)) return plain;

  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return (
    ENC_PREFIX +
    iv.toString("base64") + ":" +
    ciphertext.toString("base64") + ":" +
    authTag.toString("base64")
  );
}

/**
 * Encrypted matnni decrypt qiladi.
 * Backward compat: agar enc:v1: prefiksi yo'q bo'lsa, plaintext deb qaytaradi.
 */
export function decryptSecret(stored: string): string {
  if (!stored) return stored;
  // Backward compat: eski plaintext secret'lar
  if (!stored.startsWith(ENC_PREFIX)) return stored;

  const payload = stored.slice(ENC_PREFIX.length);
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format (expected enc:v1:iv:ct:tag)");
  }
  const [ivB64, ctB64, tagB64] = parts;

  const key = getMasterKey();
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Secret'ni UI'da ko'rsatish uchun mask qiladi.
 * Mavjud holatda decrypt qilmaydi — buni faqat secret yaratuvchi sahifalar uchun chaqir.
 */
export function maskSecret(secret: string | undefined): string {
  if (!secret) return "(yo'q)";
  // Encrypted bo'lsa, "(shifrlangan)" deb qaytar
  if (secret.startsWith(ENC_PREFIX)) return "(shifrlangan)";
  if (secret.length <= 4) return "****";
  return secret.slice(0, 2) + "****" + secret.slice(-2);
}

/**
 * Encryption mavjudligini tekshirish (debug/health uchun).
 */
export function isEncryptionConfigured(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}
