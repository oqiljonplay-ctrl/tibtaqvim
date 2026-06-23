"use client";
import { useState } from "react";
import { CIS_RULES, isValidPhone } from "@/lib/utils/phone";

interface PhoneInputProps {
  value: string;
  onChange: (canonical: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
}

export function PhoneInput({
  value,
  onChange,
  error,
  disabled,
  required,
  label = "Telefon raqam",
}: PhoneInputProps) {
  const [code, setCode] = useState<string>(() => {
    const match = CIS_RULES.find((r) => value?.startsWith(r.code));
    return match?.code ?? "+998";
  });

  const rule = CIS_RULES.find((r) => r.code === code) ?? CIS_RULES[0];
  const national = value?.startsWith(code) ? value.slice(code.length) : "";

  function handleCodeChange(newCode: string) {
    setCode(newCode);
    onChange(newCode + national);
  }

  function handleNationalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, rule.len);
    onChange(code + digits);
  }

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex items-stretch rounded-2xl border overflow-hidden transition-colors ${
          error
            ? "border-red-400 focus-within:ring-2 focus-within:ring-red-400"
            : "border-gray-300 focus-within:ring-2 focus-within:ring-blue-500"
        }`}
      >
        <select
          aria-label="Davlat kodi"
          value={code}
          disabled={disabled}
          onChange={(e) => handleCodeChange(e.target.value)}
          className="bg-gray-50 px-2 text-sm border-r border-gray-200 outline-none text-gray-700 cursor-pointer disabled:opacity-60"
        >
          {CIS_RULES.map((r) => (
            <option key={r.code} value={r.code}>
              {r.code}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={code === "+998" ? "90 123 45 67" : "Raqam"}
          disabled={disabled}
          aria-invalid={!!error}
          aria-label={label}
          value={national}
          maxLength={rule.len}
          onChange={handleNationalChange}
          className="flex-1 px-3 py-3 outline-none bg-white text-sm text-gray-900 placeholder-gray-400 disabled:bg-gray-50 disabled:opacity-60"
        />
      </div>
      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}
    </div>
  );
}

export { isValidPhone };
