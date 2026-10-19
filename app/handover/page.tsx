
"use client";

export default function HandoverPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900">
          UNITE コース別引き継ぎノート
        </h1>

        <p className="mt-3 text-gray-600">
          営業所・コース別の注意事項を管理します。
        </p>

        <div className="mt-6 rounded-xl border bg-white p-5">
          <h2 className="font-bold text-gray-900">
            引き継ぎノート
          </h2>

          <p className="mt-2 text-gray-500">
            ここにコース選択と引き継ぎ一覧を追加します。
          </p>
        </div>
      </div>
    </main>
  );
}
