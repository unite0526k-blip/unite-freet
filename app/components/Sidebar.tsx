
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  if (pathname === "/handover/share") {
    return null;
  }
  const menuItems = [
    {
      href: "/",
      label: "🏠 ダッシュボード",
    },
    {
      href: "/drivers",
      label: "👤 ドライバー管理",
    },
    {
      href: "/vehicles",
      label: "🚗 車両管理",
    },
    {
      href: "/shift",
      label: "📅 シフト管理",
    },
    {
     href: "/handover/share",
      label: "📒 コース別引き継ぎノート",
    },
    {
      href: "/settings",
      label: "⚙️ 設定",
    },
  ];

  return (
    <aside className="w-64 shrink-0 bg-slate-900 text-white min-h-screen p-5">
      <h1 className="text-2xl font-bold mb-8">
        UNITE Fleet
      </h1>

      <nav className="space-y-3">
        {menuItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href ||
                pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 transition ${
                isActive
                  ? "bg-blue-600 text-white font-bold"
                  : "hover:bg-slate-800 hover:text-blue-300"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
