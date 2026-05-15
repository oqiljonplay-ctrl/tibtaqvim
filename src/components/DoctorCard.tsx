interface DoctorCardProps {
  doctor: {
    firstName: string;
    lastName: string;
    specialty: string;
    photoUrl?: string | null;
  };
  price?: number;
  size?: "sm" | "md" | "lg";
  showPrice?: boolean;
}

export function DoctorCard({ doctor, price, size = "md", showPrice = false }: DoctorCardProps) {
  const sizeClasses = {
    sm: { img: "w-8 h-8", text: "text-sm", sub: "text-xs" },
    md: { img: "w-12 h-12", text: "text-base", sub: "text-sm" },
    lg: { img: "w-16 h-16", text: "text-lg", sub: "text-sm" },
  };
  const s = sizeClasses[size];

  return (
    <div className="flex items-center gap-3">
      {doctor.photoUrl ? (
        <img
          src={doctor.photoUrl}
          alt={doctor.firstName}
          className={`${s.img} rounded-full object-cover flex-shrink-0`}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className={`${s.img} rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0`}>
          <span className="text-white font-medium text-xs">
            {doctor.firstName[0]}{doctor.lastName[0]}
          </span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={`${s.text} font-medium text-gray-900 leading-tight`}>{doctor.specialty}</p>
        <p className={`${s.sub} text-gray-500`}>{doctor.lastName} {doctor.firstName}</p>
        {showPrice && price !== undefined && (
          <p className={`${s.sub} text-green-700 font-medium`}>
            {Number(price).toLocaleString()} so&apos;m
          </p>
        )}
      </div>
    </div>
  );
}
