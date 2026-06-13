"use client";

export interface ServiceDoctor {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  photoUrl: string | null;
  queueMode?: "live" | "online" | "slot";
  compositeRating?: number | null;
  ratingCount?: number | null;
}

export interface Service {
  id: string;
  name: string;
  type: string;
  price: number;
  requiresSlot: boolean;
  requiresAddress: boolean;
  requiresPrePayment: boolean;
  dailyLimit: number | null;
  todayCount: number;
  isAvailable: boolean;
  defaultQueueMode?: "live" | "online" | "slot";
  doctors: ServiceDoctor[];
}

interface Props {
  services: Service[];
  loading: boolean;
  onSelect: (service: Service) => void;
  userLoading?: boolean;
}

const TYPE_EMOJI: Record<string, string> = {
  doctor_queue: "👨‍⚕️",
  diagnostic: "🔬",
  home_service: "🏠",
};
const TYPE_LABEL: Record<string, string> = {
  doctor_queue: "Shifokor navbati",
  diagnostic: "Diagnostika",
  home_service: "Uyga chiqish",
};

export function ServicePicker({ services, loading, onSelect, userLoading }: Props) {
  return (
    <div>
      <h2 className="font-semibold text-gray-900 mb-4">Xizmatni tanlang</h2>
      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm animate-pulse">
          Yuklanmoqda...
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((s) => (
            <button
              key={s.id}
              disabled={!s.isAvailable || !!userLoading}
              onClick={() => onSelect(s)}
              className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                s.isAvailable && !userLoading
                  ? "bg-white border-transparent shadow-sm active:scale-95 hover:border-blue-100"
                  : "bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{TYPE_EMOJI[s.type] ?? "🏥"}</span>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{s.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{TYPE_LABEL[s.type]}</div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="text-sm font-bold text-blue-600">{s.price.toLocaleString()} so'm</div>
                  {s.requiresPrePayment && (
                    <div className="text-xs mt-0.5 text-orange-600">Oldindan to'lov</div>
                  )}
                  {s.dailyLimit && (
                    <div className={`text-xs mt-0.5 ${s.isAvailable ? "text-green-600" : "text-red-500"}`}>
                      {s.isAvailable ? `${s.dailyLimit - s.todayCount} joy` : "To'ldi"}
                    </div>
                  )}
                </div>
              </div>
              {s.doctors && s.doctors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-3">
                  {s.doctors.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2">
                      {doc.photoUrl ? (
                        <img
                          src={doc.photoUrl}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-600 text-sm font-bold leading-none">
                            {doc.firstName[0]}
                          </span>
                        </div>
                      )}
                      <span className="text-xs text-gray-500">
                        {doc.specialty} — {doc.lastName} {doc.firstName}
                        {doc.compositeRating != null && (
                          <span className="ml-1 text-amber-500 font-medium">★ {doc.compositeRating.toFixed(1)}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
