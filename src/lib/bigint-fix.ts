// Global BigInt JSON serializer
// JSON.stringify default'da BigInt'ni serialize qila olmaydi.
// Bu fix barcha BigInt qiymatlarni string sifatida ko'rsatadi.

if (typeof (BigInt.prototype as any).toJSON !== "function") {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

export {};
