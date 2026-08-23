"use client";

import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white h-screen p-5">
      <h1 className="text-2xl font-bold mb-8">
        UNITE Fleet
      </h1>

      <nav className="space-y-3">
        <Link
          href="/"
          className="block hover:text-blue-300"
        >
          🏠 ダッシュボード
        </Link>

        <Link
          href="/drivers"
          className="block hover:text-blue-300"
        >
          👤 ドライバー管理
        </Link>

        <Link
          href="/vehicles"
          className="block hover:text-blue-300"
        >
          🚗 車両管理
        </Link>

        <Link
          href="/shift"
          className="block hover:text-blue-300"
        >
          📅 シフト管理
        </Link>

        <Link
          href="/settings"
          className="block hover:text-blue-300"
        >
          ⚙️ 設定
        </Link>
      </nav>
    </aside>
  );
}