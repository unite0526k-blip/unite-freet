export default function VehiclesPage() {
  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-blue-600">
        🚗 車両一覧
      </h1>

      <div className="mt-6 space-y-4">

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold">
            車両ID001
          </h2>

          <p>ナンバー：三重480れ3216</p>
          <p>車種：ダイハツ ハイゼット</p>
          <p>担当：横溝</p>
          <p>車検：2028/03/31</p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold">
            車両ID002
          </h2>

          <p>ナンバー：三重481れ1234</p>
          <p>車種：スズキ エブリイ</p>
          <p>担当：徳田</p>
          <p>車検：2027/11/15</p>
        </div>

      </div>
    </main>
  );
}