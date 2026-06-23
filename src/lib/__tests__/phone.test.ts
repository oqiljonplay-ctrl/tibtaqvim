import { describe, it, expect } from "vitest";
import { normalizePhone, isValidPhone } from "../utils/phone";

describe("normalizePhone", () => {
  it("+998XXXXXXXXX — o'zgarishsiz", () => {
    expect(normalizePhone("+998901234567")).toBe("+998901234567");
  });

  it("998XXXXXXXXX — '+' qo'shiladi", () => {
    expect(normalizePhone("998901234567")).toBe("+998901234567");
  });

  it("9XXXXXXXX — +998 prefiksi qo'shiladi", () => {
    expect(normalizePhone("901234567")).toBe("+998901234567");
  });

  it("0XXXXXXXXX — 0 o'rniga +998", () => {
    expect(normalizePhone("0901234567")).toBe("+998901234567");
  });

  it("bo'shliq va chiziqlar olib tashlanadi", () => {
    expect(normalizePhone("+998 90 123-45-67")).toBe("+998901234567");
  });

  it("qavslar olib tashlanadi", () => {
    expect(normalizePhone("+998(90)1234567")).toBe("+998901234567");
  });

  it("TIBBIYOT axlat — null qaytaradi", () => {
    expect(normalizePhone("TIBBIYOT")).toBeNull();
  });

  it("harf bor string — null qaytaradi", () => {
    expect(normalizePhone("abc123")).toBeNull();
  });

  it("bo'sh string — null qaytaradi", () => {
    expect(normalizePhone("")).toBeNull();
  });

  it("null kirish — null qaytaradi", () => {
    expect(normalizePhone(null)).toBeNull();
  });

  it("undefined kirish — null qaytaradi", () => {
    expect(normalizePhone(undefined)).toBeNull();
  });

  it("Rossiya (+7) raqami", () => {
    expect(normalizePhone("+79001234567")).toBe("+79001234567");
  });
});

describe("isValidPhone", () => {
  it("to'g'ri raqam — true", () => {
    expect(isValidPhone("+998901234567")).toBe(true);
  });

  it("axlat — false", () => {
    expect(isValidPhone("TIBBIYOT")).toBe(false);
  });

  it("null — false", () => {
    expect(isValidPhone(null)).toBe(false);
  });
});
