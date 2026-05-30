"use client";
import type { ServiceDoctor } from "@/components/webapp/ServicePicker";

interface Props {
  doctors: ServiceDoctor[];
  onSelect: (doctor: ServiceDoctor) => void;
}

const queueLabels: Record<string, string> = {
  live: "Kunlik 💵",
  online: "Onlayn 🎫",
  slot: "Vaqtli ⏰",
};

function DoctorAvatar({ doc }: { doc: ServiceDoctor }) {
  const initials = [doc.firstName[0], doc.lastName[0]].join("").toUpperCase();
  if (doc.photoUrl) {
    return (
      <img
        src={doc.photoUrl}
        alt=""
        className="w-12 h-12 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm shrink-0">
      {initials}
    </div>
  );
}

export function DoctorPicker({ doctors, onSelect }: Props) {
  if (doctors.length === 0) return null;

  // 1 shifokor — avtomatik banner
  if (doctors.length === 1) {
    const doc = doctors[0];
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <DoctorAvatar doc={doc} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-blue-900">
              {doc.firstName} {doc.lastName}
            </div>
            {doc.specialty && (
              <div className="text-xs text-blue-600 mt-0.5">{doc.specialty}</div>
            )}
            {doc.queueMode && (
              <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {queueLabels[doc.queueMode] ?? doc.queueMode}
              </span>
            )}
          </div>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full shrink-0">
            ✅ Tanlangan
          </span>
        </div>
        <p className="text-xs text-blue-600 mb-3">
          Siz <strong>{doc.firstName} {doc.lastName}</strong> shifokorga yozilasiz
        </p>
        <button
          onClick={() => onSelect(doc)}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold active:scale-95 transition-all"
        >
          Davom etish →
        </button>
      </div>
    );
  }

  // N shifokor — tanlash ro'yxati
  return (
    <div>
      <h2 className="font-semibold text-gray-900 mb-3">Shifokorni tanlang</h2>
      <div className="space-y-3">
        {doctors.map((doc) => (
          <button
            key={doc.id}
            onClick={() => onSelect(doc)}
            className="w-full text-left bg-white rounded-2xl border-2 border-transparent shadow-sm p-4
                       hover:border-blue-200 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <DoctorAvatar doc={doc} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900">
                  {doc.firstName} {doc.lastName}
                </div>
                {doc.specialty && (
                  <div className="text-xs text-gray-500 mt-0.5">{doc.specialty}</div>
                )}
                {doc.queueMode && (
                  <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                    {queueLabels[doc.queueMode] ?? doc.queueMode}
                  </span>
                )}
              </div>
              <span className="text-blue-400 text-lg shrink-0">›</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
