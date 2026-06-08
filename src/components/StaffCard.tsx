interface StaffCardProps {
  staff: {
    firstName: string;
    lastName: string;
    photoUrl?: string | null;
  };
  size?: "sm" | "md" | "lg";
}

export function StaffCard({ staff, size = "md" }: StaffCardProps) {
  const sizeClasses = {
    sm: { img: "w-8 h-8", text: "text-sm", sub: "text-xs" },
    md: { img: "w-12 h-12", text: "text-base", sub: "text-sm" },
    lg: { img: "w-16 h-16", text: "text-lg", sub: "text-sm" },
  };
  const s = sizeClasses[size];

  return (
    <div className="flex items-center gap-3">
      {staff.photoUrl ? (
        <img
          src={staff.photoUrl}
          alt={staff.firstName}
          className={`${s.img} rounded-full object-cover flex-shrink-0`}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div
          className={`${s.img} rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center flex-shrink-0`}
        >
          <span className="text-white font-medium text-xs">
            {staff.firstName[0]}{staff.lastName?.[0] ?? ""}
          </span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={`${s.text} font-medium text-gray-900 leading-tight`}>
          {staff.lastName} {staff.firstName}
        </p>
        <p className={`${s.sub} text-gray-500`}>Qabulxona xodimi</p>
      </div>
    </div>
  );
}
