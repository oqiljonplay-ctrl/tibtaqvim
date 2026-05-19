"use client";

import { useEffect, useState } from "react";

interface PaymeConfig {
  enabled: boolean;
  merchantId: string;
  secretKey: string;
  testMode: boolean;
  accountFieldName: string;
  cashboxId?: string;
}

interface ClickConfig {
  enabled: boolean;
  merchantId: string;
  serviceId: string;
  merchantUserId?: string;
  secretKey: string;
  testMode: boolean;
}

interface PaymentConfig {
  payme?: PaymeConfig;
  click?: ClickConfig;
}

interface Props {
  clinicId: string;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-indigo-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function MaskedInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className="input pr-10"
        value={value}
        placeholder={placeholder || "****"}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
      >
        {show ? "Yashir" : "Ko'rsat"}
      </button>
    </div>
  );
}

const DEFAULT_PAYME: PaymeConfig = {
  enabled: false,
  merchantId: "",
  secretKey: "",
  testMode: true,
  accountFieldName: "appointment_id",
};

const DEFAULT_CLICK: ClickConfig = {
  enabled: false,
  merchantId: "",
  serviceId: "",
  secretKey: "",
  testMode: true,
};

export function PaymentTab({ clinicId }: Props) {
  const [payme, setPayme] = useState<PaymeConfig>(DEFAULT_PAYME);
  const [click, setClick] = useState<ClickConfig>(DEFAULT_CLICK);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    fetch(`/api/admin/clinics/${clinicId}/payment-config`)
      .then((r) => r.json())
      .then((data) => {
        const cfg = data.config as PaymentConfig | null;
        if (cfg?.payme) setPayme({ ...DEFAULT_PAYME, ...cfg.payme });
        if (cfg?.click) setClick({ ...DEFAULT_CLICK, ...cfg.click });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clinicId]);

  async function save(provider: "payme" | "click") {
    setSaving(true);
    const body = provider === "payme" ? { payme } : { click };
    const res = await fetch(`/api/admin/clinics/${clinicId}/payment-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      showToast(`${provider === "payme" ? "Payme" : "Click"} sozlamalari saqlandi ✓`);
      // Reload to get masked keys
      fetch(`/api/admin/clinics/${clinicId}/payment-config`)
        .then((r) => r.json())
        .then((d) => {
          const cfg = d.config as PaymentConfig | null;
          if (provider === "payme" && cfg?.payme) setPayme({ ...DEFAULT_PAYME, ...cfg.payme });
          if (provider === "click" && cfg?.click) setClick({ ...DEFAULT_CLICK, ...cfg.click });
        });
    } else {
      showToast(data.error || "Xatolik", "err");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        To'lov tizimi sozlamalari. Secret key'lar ko'rsatilmaydi — yangi kiritilsa yangilanadi.
        Sandbox test uchun <strong>testMode</strong> yoqilgan holda qoldiring.
      </div>

      {/* ── Payme ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center font-bold text-cyan-700">P</div>
            <h3 className="font-semibold text-gray-900 text-sm">Payme</h3>
          </div>
          <Toggle checked={payme.enabled} onChange={(v) => setPayme({ ...payme, enabled: v })} />
        </div>
        <div className={`p-5 space-y-4 ${!payme.enabled ? "opacity-50 pointer-events-none" : ""}`}>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Merchant ID</label>
            <input
              className="input"
              value={payme.merchantId}
              onChange={(e) => setPayme({ ...payme, merchantId: e.target.value })}
              placeholder="5e730..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cashbox ID (ixtiyoriy)</label>
            <input
              className="input"
              value={payme.cashboxId || ""}
              onChange={(e) => setPayme({ ...payme, cashboxId: e.target.value })}
              placeholder="..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Secret Key</label>
            <MaskedInput
              value={payme.secretKey}
              onChange={(v) => setPayme({ ...payme, secretKey: v })}
              placeholder="Bo'sh qoldirsangiz eski saqlanadi"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Account Field Name</label>
            <input
              className="input"
              value={payme.accountFieldName}
              onChange={(e) => setPayme({ ...payme, accountFieldName: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-sm font-medium text-gray-900">Test rejim</div>
              <div className="text-xs text-gray-400">Sandbox URL ishlatiladi (checkout.test.paycom.uz)</div>
            </div>
            <Toggle checked={payme.testMode} onChange={(v) => setPayme({ ...payme, testMode: v })} />
          </div>
        </div>
        <div className="px-5 pb-5 flex justify-end">
          <button
            onClick={() => save("payme")}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? "Saqlanmoqda..." : "Payme saqlash"}
          </button>
        </div>
      </div>

      {/* ── Click ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center font-bold text-blue-700">C</div>
            <h3 className="font-semibold text-gray-900 text-sm">Click</h3>
          </div>
          <Toggle checked={click.enabled} onChange={(v) => setClick({ ...click, enabled: v })} />
        </div>
        <div className={`p-5 space-y-4 ${!click.enabled ? "opacity-50 pointer-events-none" : ""}`}>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Merchant ID</label>
            <input
              className="input"
              value={click.merchantId}
              onChange={(e) => setClick({ ...click, merchantId: e.target.value })}
              placeholder="12345"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Service ID</label>
            <input
              className="input"
              value={click.serviceId}
              onChange={(e) => setClick({ ...click, serviceId: e.target.value })}
              placeholder="67890"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Merchant User ID (ixtiyoriy)</label>
            <input
              className="input"
              value={click.merchantUserId || ""}
              onChange={(e) => setClick({ ...click, merchantUserId: e.target.value })}
              placeholder="..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Secret Key</label>
            <MaskedInput
              value={click.secretKey}
              onChange={(v) => setClick({ ...click, secretKey: v })}
              placeholder="Bo'sh qoldirsangiz eski saqlanadi"
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-sm font-medium text-gray-900">Test rejim</div>
              <div className="text-xs text-gray-400">my.click.uz — production va sandbox URL bir xil</div>
            </div>
            <Toggle checked={click.testMode} onChange={(v) => setClick({ ...click, testMode: v })} />
          </div>
        </div>
        <div className="px-5 pb-5 flex justify-end">
          <button
            onClick={() => save("click")}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? "Saqlanmoqda..." : "Click saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
