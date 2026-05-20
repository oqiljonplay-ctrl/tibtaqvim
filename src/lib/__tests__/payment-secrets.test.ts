import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret, maskSecret, isEncryptionConfigured } from "../payment/secrets";

// Test uchun deterministik key
beforeAll(() => {
  // 32 byte base64 — test uchun
  process.env.PAYMENT_ENCRYPTION_KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
});

describe("payment/secrets", () => {
  it("encrypts and decrypts roundtrip", () => {
    const plain = "my-very-secret-key-12345";
    const encrypted = encryptSecret(plain);
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain(plain);

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(plain);
  });

  it("backward compat: plaintext passes through decrypt", () => {
    const plain = "old-plaintext-secret";
    expect(decryptSecret(plain)).toBe(plain);
  });

  it("encrypting already-encrypted is idempotent", () => {
    const plain = "my-secret";
    const encrypted = encryptSecret(plain);
    const doubleEncrypted = encryptSecret(encrypted);
    expect(doubleEncrypted).toBe(encrypted);
  });

  it("different IV each time (non-deterministic)", () => {
    const plain = "same-secret";
    const enc1 = encryptSecret(plain);
    const enc2 = encryptSecret(plain);
    expect(enc1).not.toBe(enc2);
    expect(decryptSecret(enc1)).toBe(plain);
    expect(decryptSecret(enc2)).toBe(plain);
  });

  it("tampering with ciphertext throws", () => {
    const encrypted = encryptSecret("my-secret");
    const tampered = encrypted.slice(0, -10) + "AAAAAAAAAA";
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("mask encrypted secret shows (shifrlangan)", () => {
    const encrypted = encryptSecret("my-secret");
    expect(maskSecret(encrypted)).toBe("(shifrlangan)");
  });

  it("mask plaintext shows first 2 + **** + last 2", () => {
    expect(maskSecret("abcdefgh")).toBe("ab****gh");
  });

  it("mask empty/undefined", () => {
    expect(maskSecret(undefined)).toBe("(yo'q)");
    expect(maskSecret("")).toBe("(yo'q)");
    expect(maskSecret("abc")).toBe("****");
  });

  it("isEncryptionConfigured returns true when key set", () => {
    expect(isEncryptionConfigured()).toBe(true);
  });

  it("empty string passes through encrypt", () => {
    expect(encryptSecret("")).toBe("");
  });

  it("throws if key is wrong length", () => {
    const oldKey = process.env.PAYMENT_ENCRYPTION_KEY;
    process.env.PAYMENT_ENCRYPTION_KEY = "tooshort";
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
    process.env.PAYMENT_ENCRYPTION_KEY = oldKey;
  });
});
