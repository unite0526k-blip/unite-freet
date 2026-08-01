'use client';

import { useMemo, useState } from 'react';

type DriverStatus = '稼働' | '休み' | '応援';

type Driver = {
  id: number;
  name: string;
  area: string;
  phone: string;
  vehicle: string;
  status: DriverStatus;
  rank: string;
};

const drivers: Driver[] = [
  {
    id: 1,
    name: 'Aiko Tanaka',
    area: 'Central Tokyo',
    phone: '+81 90 1234 5678',
    vehicle: 'Toyota Prius',
    status: '稼働',
    rank: 'S',
  },
  {
    id: 2,
    name: 'Kenji Sato',
    area: 'Yokohama',
    phone: '+81 80 9876 5432',
    vehicle: 'Honda StepWGN',
    status: '応援',
    rank: 'A',
  },
  {
    id: 3,
    name: 'Mina Kobayashi',
    area: 'Osaka',
    phone: '+81 70 5555 0101',
    vehicle: 'Nissan Note',
    status: '稼働',
    rank: 'A',
  },
  {
    id: 4,
    name: 'Ryo Ishida',
    area: 'Nagoya',
    phone: '+81 90 2222 3344',
    vehicle: 'Suzuki Swift',
    status: '休み',
    rank: 'B',
  },
];

const sidebarItems = [
  'ダッシュボード',
  'ドライバー',
  '車両',
  '配達',
  'シフト',
  '売上',
  'KPI',
  'サポート',
  'クレーム',
  '設定',
];

export default function DriversPage() {
  const [search, setSearch] = useState('');

  const filteredDrivers = useMemo(() => {
    const query = search.toLowerCase();
    return drivers.filter((driver) =>
      [driver.name, driver.area, driver.phone, driver.vehicle, driver.status, driver.rank]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [search]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="w-full border-b border-slate-200 bg-white/90 p-6 shadow-sm lg:w-72 lg:border-b-0 lg:border-r">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
              UNITE Fleet
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Driver Center</h1>
          </div>

          <nav className="space-y-2">
            {sidebarItems.map((item, index) => {
              const isActive = item === 'ドライバー';
              return (
                <button
                  key={item}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{item}</span>
                  {index === 0 && <span className="text-xs">↗</span>}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Fleet Operations</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">ドライバー一覧</h2>
              </div>
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                + ドライバー追加
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="検索"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none ring-0 transition focus:border-blue-400 focus:bg-white"
                />
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                4名のドライバーが登録されています
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-3 font-semibold">名前</th>
                    <th className="px-3 py-3 font-semibold">担当エリア</th>
                    <th className="px-3 py-3 font-semibold">電話番号</th>
                    <th className="px-3 py-3 font-semibold">車両</th>
                    <th className="px-3 py-3 font-semibold">ステータス</th>
                    <th className="px-3 py-3 font-semibold">KPIランク</th>
                    <th className="px-3 py-3 font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map((driver) => (
                    <tr key={driver.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-3 py-4 font-medium text-slate-900">{driver.name}</td>
                      <td className="px-3 py-4 text-slate-600">{driver.area}</td>
                      <td className="px-3 py-4 text-slate-600">{driver.phone}</td>
                      <td className="px-3 py-4 text-slate-600">{driver.vehicle}</td>
                      <td className="px-3 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            driver.status === '稼働'
                              ? 'bg-emerald-100 text-emerald-700'
                              : driver.status === '応援'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {driver.status}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-slate-600">{driver.rank}</td>
                      <td className="px-3 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
