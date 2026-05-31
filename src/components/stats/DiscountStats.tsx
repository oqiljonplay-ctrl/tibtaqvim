"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface DiscountData { x: number; y: number; z: number }

function fmt(v: number) {
  return new Intl.NumberFormat("uz-UZ").format(v) + " so'm";
}

function fmtShort(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

export default function DiscountStats() {
  const [data, setData] = useState<DiscountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats/discount", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d.data);
        else setErr(d.error?.message ?? "Xato");
      })
      .catch(() => setErr("Tarmoq xatosi"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />;
  if (err) return <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">{err}</div>;
  if (!data) return null;

  const chartData = [
    { name: "X — Jami tushum", value: data.x, color: "#10b981" },
    { name: "Y — Chegirilgan", value: data.y, color: "#ef4444" },
    { name: "Z — Chegirmali tushum", value: data.z, color: "#3b82f6" },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
      <h3 className="font-semibold text-gray-900">Chegirma statistikasi</h3>

      {/* 3 karta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 rounded-lg p-4">
          <p className="text-xs text-emerald-700 font-medium mb-1">X — Jami tushum</p>
          <p className="text-xl font-bold text-emerald-900">{fmt(data.x)}</p>
          <p className="text-xs text-emerald-600 mt-1">Barcha to'lovlar (chegirmali + to'liq)</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-xs text-red-700 font-medium mb-1">Y — Chegirilgan</p>
          <p className="text-xl font-bold text-red-900">{fmt(data.y)}</p>
          <p className="text-xs text-red-600 mt-1">Chegirma tufayli olinmagan pul</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-xs text-blue-700 font-medium mb-1">Z — Chegirmali tushum</p>
          <p className="text-xl font-bold text-blue-900">{fmt(data.z)}</p>
          <p className="text-xs text-blue-600 mt-1">Chegirma berilgan bronlardan</p>
        </div>
      </div>

      {/* Bar chart */}
      <div>
        <p className="text-xs text-gray-500 mb-3">Solishtirma diagramma (so'm)</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [fmt(Number(v ?? 0)), ""]} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-gray-400">
        X = Z + chegirmasiz to'lovlar. Y = chegirmali bronlarda berilmagan pul. Qaytarilgan bronlar hisoblanmaydi.
      </p>
    </div>
  );
}
