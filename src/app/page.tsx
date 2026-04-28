import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">ClinicBot</h1>
        <p className="text-lg text-gray-500 mb-10">Ko'p klinikali boshqaruv tizimi</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/admin" className="card hover:shadow-md transition-shadow cursor-pointer text-center">
            <div className="text-3xl mb-3">🏥</div>
            <h2 className="font-semibold text-gray-900">Admin Panel</h2>
            <p className="text-sm text-gray-500 mt-1">Klinikalar, xizmatlar boshqaruvi</p>
          </Link>

          <Link href="/doctor" className="card hover:shadow-md transition-shadow cursor-pointer text-center">
            <div className="text-3xl mb-3">👨‍⚕️</div>
            <h2 className="font-semibold text-gray-900">Shifokor Panel</h2>
            <p className="text-sm text-gray-500 mt-1">Bugungi bemorlar ro'yxati</p>
          </Link>

          <Link href="/reception" className="card hover:shadow-md transition-shadow cursor-pointer text-center">
            <div className="text-3xl mb-3">📋</div>
            <h2 className="font-semibold text-gray-900">Qabulxona</h2>
            <p className="text-sm text-gray-500 mt-1">Navbat va kelish boshqaruvi</p>
          </Link>
        </div>

        <div className="mt-8 text-sm text-gray-400">
          <span>API: </span>
          <code className="bg-gray-100 px-2 py-1 rounded">/api/services · /api/book · /api/appointments</code>
        </div>
      </div>
    </main>
  );
}
