import Link from "next/link";

export default function StatsButton() {
  return (
    <Link
      href="/stats"
      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-md text-sm font-medium hover:opacity-90 transition shadow-sm whitespace-nowrap"
    >
      📊 Statistika
    </Link>
  );
}
