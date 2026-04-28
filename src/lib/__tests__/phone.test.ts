import { describe, it, expect } from "vitest";
import { normalizePhone } from "../utils/phone";

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
});
