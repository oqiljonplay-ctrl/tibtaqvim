import { useState } from "react";

type Props = {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
};

export function ClinicLogo({ src, name, size = 96, className = "" }: Props) {
  const [imgError, setImgError] = useState(false);
  const showImg = src && !imgError;

  return (
    <div
      className={`rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span style={{ fontSize: size * 0.4 }}>🏥</span>
      )}
    </div>
  );
}
