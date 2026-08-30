'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const sidebarItems = [
  { label: 'ダッシュボード', href: '/dashboard' },
  { label: 'ドライバー', href: '/drivers' },
  { label: '車両', href: '/vehicles' },
  { label: '配達', href: '/deliveries' },
  { label: 'シフト', href: '/shifts' },
  { label: '売上', href: '/sales' },
  { label: 'KPI', href: '/kpi' },
  { label: 'サポート', href: '/support' },
  { label: 'クレーム', href: '/claims' },
  { label: '設定', href: '/settings' },
];

const deliveryRows = [
  { driver: '田中', area: '中央区', planned: 38, completed: 31, progress: 82, location: '東京駅前', status: '進行中' },
  { driver: '佐藤', area: '横浜', planned: 34, completed: 25, progress: 74, location: '横浜港', status: '遅延少' },
  { driver: '伊藤', area: '大阪', planned: 29, completed: 19, progress: 66, location: '梅田', status: '予定内' },
  { driver: '山本', area: '名古屋', planned: 27, completed: 24, progress: 89, location: '名古屋駅', status: '順調' },
];

const notices = [
  { title: '期限切れ', detail: '車検予定の車両が3台あります。' },
  { title: '車検予定', detail: '来週の車検対応が必要です。' },
  { title: "保険通知", detail: "保険期限が近い車両を確認してください。" },
  { title: '契約更新', detail: '配送契約の更新手続きを進めています。' },
];

const rankings = [
  { rank: 1, name: 'Aiko Tanaka', points: '2,480', level: 'S' },
  { rank: 2, name: 'Kenji Sato', points: '2,310', level: 'A' },
  { rank: 3, name: 'Mina Kobayashi', points: '2,080', level: 'A' },
  { rank: 4, name: 'Ryo Ishida', points: '1,940', level: 'B' },
  { rank: 5, name: 'Haruka Lee', points: '1,820', level: 'C' },
];

const levelStyles: Record<string, string> = {
  S: 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40',
  A: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/40',
  B: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/40',
  C: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40',
};

export default function DashboardPage() {
  const pathname = usePathname();

  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  const now = new Date().toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#111827,_#030712_70%)] text-slate-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="w-full border-b border-white/10 bg-[#05070b] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.35)] lg:w-72 lg:border-b-0 lg:border-r">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">
              Unified Fleet OS
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">UNITE Fleet</h1>
            <p className="mt-1 text-sm text-slate-400">Operations Center</p>
          </div>

          <nav className="mt-6 space-y-1.5">
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-xs opacity-70">→</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="flex-1 p-3 sm:p-4 lg:p-5 xl:p-6">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:p-5">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-sky-300">Enterprise Operations Dashboard</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">ダッシュボード</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300">
                  {today}
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300">
                  {now}
                </div>
                <button
                  type="button"
                  className="rounded-xl bg-sky-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
                >
                  更新
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">本日稼働車両</p>
                <p className="mt-2 text-2xl font-semibold text-white">18台</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">稼働ドライバー</p>
                <p className="mt-2 text-2xl font-semibold text-white">18名</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">本日配達個数</p>
                <p className="mt-2 text-2xl font-semibold text-white">2,346</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">本日の売上</p>
                <p className="mt-2 text-2xl font-semibold text-white">¥324,500</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">未確認クレーム</p>
                <p className="mt-2 text-2xl font-semibold text-white">2件</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">車検期限</p>
                <p className="mt-2 text-2xl font-semibold text-white">3台</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-6">
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">天気</p>
                <p className="mt-2 text-lg font-semibold text-white">晴れ・28℃</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">今月売上</p>
                <p className="mt-2 text-lg font-semibold text-white">¥8,240,000</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">今月配送個数</p>
                <p className="mt-2 text-lg font-semibold text-white">68,120件</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">今月クレーム件数</p>
                <p className="mt-2 text-lg font-semibold text-white">12件</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">今月給油金額</p>
                <p className="mt-2 text-lg font-semibold text-white">¥540,000</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">運用状況</p>
                <p className="mt-2 text-lg font-semibold text-white">安定稼働</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">本日の配達状況</h3>
                  <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-300">
                    進行中
                  </span>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400">
                        <th className="px-2 py-2 font-semibold">ドライバー</th>
                        <th className="px-2 py-2 font-semibold">担当エリア</th>
                        <th className="px-2 py-2 font-semibold">配達予定</th>
                        <th className="px-2 py-2 font-semibold">配達済</th>
                        <th className="px-2 py-2 font-semibold">進捗率</th>
                        <th className="px-2 py-2 font-semibold">現在地</th>
                        <th className="px-2 py-2 font-semibold">状態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryRows.map((row) => (
                        <tr key={row.driver} className="border-b border-white/5 text-slate-200 last:border-b-0">
                          <td className="px-2 py-2 font-medium">{row.driver}</td>
                          <td className="px-2 py-2">{row.area}</td>
                          <td className="px-2 py-2">{row.planned}</td>
                          <td className="px-2 py-2">{row.completed}</td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 rounded-full bg-slate-800">
                                <div className="h-2 rounded-full bg-sky-400" style={{ width: `${row.progress}%` }} />
                              </div>
                              <span>{row.progress}%</span>
                            </div>
                          </td>
                          <td className="px-2 py-2">{row.location}</td>
                          <td className="px-2 py-2">
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300">
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <h3 className="text-lg font-semibold text-white">通知</h3>
                {notices.map((item) => (
                  <Link
  key={item.title}
  href={item.title.includes("保険") ? "/vehicles" : "/dashboard"}
  className="block rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10"
>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{item.detail}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">KPIランキング</h3>
                <span className="text-sm text-slate-400">今月の実績</span>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="px-2 py-2 font-semibold">順位</th>
                      <th className="px-2 py-2 font-semibold">名前</th>
                      <th className="px-2 py-2 font-semibold">ポイント</th>
                      <th className="px-2 py-2 font-semibold">ランク</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((item) => (
                      <tr key={item.rank} className="border-b border-white/5 text-slate-200 last:border-b-0">
                        <td className="px-2 py-2 font-semibold">{item.rank}</td>
                        <td className="px-2 py-2">{item.name}</td>
                        <td className="px-2 py-2">{item.points}</td>
                        <td className="px-2 py-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${levelStyles[item.level]}`}>
                            {item.level}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}