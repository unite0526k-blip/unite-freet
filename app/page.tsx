export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-blue-600">
        UNITE Fleet
      </h1>

      <p className="mt-4 text-gray-600">
        車両管理システム Ver1
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold">🚗 車両管理</h2>
          <p className="mt-2">20台登録</p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold">👤 ドライバー</h2>
          <p className="mt-2">18名登録</p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold">🔔 通知</h2>
          <p className="mt-2">車検・保険期限</p>
        </div>
      </div>
    </main>
  );
}