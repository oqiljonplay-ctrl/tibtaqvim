"use client";
import { useEffect, useState } from "react";

interface AuditEntry {
  id: string;
  action: string;
  actorId: string;
  clinicId: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
}

const ACTION_META: Record<string, { label: string; color: string; icon: string }> = {
  CLINIC_CREATED: { label: "Klinika yaratildi", color: "text-green-700 bg-green-50", icon: "+" },
  CLINIC_UPDATED: { label: "Klinika yangilandi", color: "text-blue-700 bg-blue-50", icon: "✎" },
  CLINIC_DELETED: { label: "Klinika o'chirildi", color: "text-red-700 bg-red-50", icon: "×" },
  SETTINGS_UPDATED: { label: "Sozlamalar", color: "text-yellow-700 bg-yellow-50", icon: "⚙" },
  MODULES_UPDATED: { label: "Modullar", color: "text-purple-700 bg-purple-50", icon: "🧩" },
  FEATURES_UPDATED: { label: "Feature flags", color: "text-indigo-700 bg-indigo-50", icon: "🚩" },
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token") || "";
    fetch("/api/admin/super/audit?take=100", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => { if (j.success) setLogs(j.data); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">Barcha admin amallari ro'yxati</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Yuklanmoqda...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">Hozircha hech narsa yo'q</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map((log) => {
              const meta = ACTION_META[log.action];
              return (
                <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 ${
                      meta?.color ?? "text-gray-600 bg-gray-100"
                    }`}
                  >
                    {meta?.icon ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">
                        {meta?.label ?? log.action}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("uz-UZ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400 font-mono truncate max-w-[200px]">
                        {log.actorId}
                      </span>
                      {log.clinicId && (
                        <span className="text-xs text-indigo-500 font-mono">{log.clinicId}</span>
                      )}
                    </div>
                    {Object.keys(log.payload).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-indigo-500 cursor-pointer hover:text-indigo-700">
                          JSON payload
                        </summary>
                        <pre className="mt-1.5 text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto text-gray-600 max-h-28">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
