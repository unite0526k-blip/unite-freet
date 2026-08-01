'use client';

import { useMemo, useState } from 'react';

type DriverStatus = 'Active' | 'On Leave' | 'Training';

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
    status: 'Active',
    rank: 'A+',
  },
  {
    id: 2,
    name: 'Kenji Sato',
    area: 'Yokohama',
    phone: '+81 80 9876 5432',
    vehicle: 'Honda StepWGN',
    status: 'Training',
    rank: 'A',
  },
  {
    id: 3,
    name: 'Mina Kobayashi',
    area: 'Osaka',
    phone: '+81 70 5555 0101',
    vehicle: 'Nissan Note',
    status: 'Active',
    rank: 'A',
  },
  {
    id: 4,
    name: 'Ryo Ishida',
    area: 'Nagoya',
    phone: '+81 90 2222 3344',
    vehicle: 'Suzuki Swift',
    status: 'On Leave',
    rank: 'B+',
  },
];

const sidebarItems = [
  'Dashboard',
  'Drivers',
  'Deliveries',
  'Shifts',
  'Fuel',
  'Sales',
  'KPI',
  'Support',
  'Claims',
  'Settings',
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
              const isActive = item === 'Drivers';
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
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">Driver Management</h2>
              </div>
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                + Add Driver
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search drivers"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none ring-0 transition focus:border-blue-400 focus:bg-white"
                />
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                4 drivers available
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-3 font-semibold">Name</th>
                    <th className="px-3 py-3 font-semibold">Area</th>
                    <th className="px-3 py-3 font-semibold">Phone</th>
                    <th className="px-3 py-3 font-semibold">Vehicle</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">KPI Rank</th>
                    <th className="px-3 py-3 font-semibold">Actions</th>
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
                            driver.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : driver.status === 'Training'
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
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            Delete
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
