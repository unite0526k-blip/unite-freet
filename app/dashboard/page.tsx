export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-blue-600">
        📊 ダッシュボード
      </h1>

      <div className="grid grid-cols-2 gap-4 mt-8">

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-bold">🚗 車両</h2>
          <p className="text-3xl mt-2">20台</p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-bold">👤 ドライバー</h2>
          <p className="text-3xl mt-2">18名</p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-bold">🔔 車検期限</h2>
          <p className="text-3xl mt-2">2台</p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-bold">💰 修理費</h2>
          <p className="text-3xl mt-2">¥0</p>
        </div>

      </div>
    </main>
  );
}