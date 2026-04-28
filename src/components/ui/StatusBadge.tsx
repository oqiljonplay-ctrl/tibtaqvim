"use client";

const labels: Record<string, string> = {
  booked: "Bron qilingan",
  arrived: "Keldi",
  missed: "Kelmadi",
  cancelled: "Bekor qilindi",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge-${status}`}>
      {labels[status] ?? status}
    </span>
  );
}
