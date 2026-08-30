'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type DriverStatus = '稼働' | '休み' | '応援';

type Driver = {
  id: number;
  name: string;
  phone: string;
  address: string;
  area: string;
  vehicle_id: number | null;
  kpi: string;
  status: DriverStatus;
};

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

const emptyDriver: Omit<Driver, 'id'> = {
  name: '',
  phone: '',
  address: '',
  area: '',
  vehicle_id: null,
  kpi: 'A',
  status: '稼働',
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyDriver);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const loadDrivers = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from('drivers').select('*').order('id', { ascending: true });
    if (!error) {
      setDrivers((data ?? []) as Driver[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadDrivers();
  }, []);

  const filteredDrivers = useMemo(() => {
    const query = search.toLowerCase();
    return drivers.filter((driver) =>
      [driver.name, driver.phone, driver.address, driver.area, driver.kpi, driver.status]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [drivers, search]);

  const resetForm = () => {
    setForm(emptyDriver);
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setMessage('Supabase の設定が未完了です。');
      return;
    }

    if (!form.name.trim()) return;

    if (editingId) {
      const { error } = await supabase.from('drivers').update(form).eq('id', editingId);
      if (!error) {
        setMessage('更新しました');
        await loadDrivers();
        resetForm();
      }
    } else {
      const { error } = await supabase.from('drivers').insert({ ...form, name: form.name.trim() });
      if (!error) {
        setMessage('追加しました');
        await loadDrivers();
        resetForm();
      }
    }
  };

  const handleEdit = (driver: Driver) => {
    setEditingId(driver.id);
    setForm({
      name: driver.name,
      phone: driver.phone,
      address: driver.address,
      area: driver.area,
      vehicle_id: driver.vehicle_id,
      kpi: driver.kpi,
      status: driver.status,
    });
  };

  const handleDelete = async (id: number) => {
    if (!supabase) return;
    const { error } = await supabase.from('drivers').delete().eq('id', id);
    if (!error) {
      setMessage('削除しました');
      await loadDrivers();
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="w-full border-b border-slate-200 bg-white/90 p-6 shadow-sm lg:w-72 lg:border-b-0 lg:border-r">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">UNITE Fleet</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Driver Center</h1>
          </div>

          <nav className="space-y-2">
            {sidebarItems.map((item, index) => {
              const isActive = item === 'ドライバー';
              return (
                <button key={item} type="button" className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
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
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">ドライバー管理</h2>
              </div>
              <div className="text-sm text-slate-500">{message}</div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-6">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="名前" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="電話番号" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="住所" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              <input value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} placeholder="担当エリア" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              <input value={form.vehicle_id ?? ''} onChange={(event) => setForm({ ...form, vehicle_id: event.target.value ? Number(event.target.value) : null })} placeholder="車両ID" type="number" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as DriverStatus })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="稼働">稼働</option>
                <option value="休み">休み</option>
                <option value="応援">応援</option>
              </select>
              <select value={form.kpi} onChange={(event) => setForm({ ...form, kpi: event.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="S">S</option>
              </select>
              <div className="md:col-span-2 xl:col-span-6 flex gap-2">
                <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">{editingId ? '更新' : '追加'}</button>
                <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">クリア</button>
              </div>
            </form>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="検索" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none ring-0 transition focus:border-blue-400 focus:bg-white" />
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{loading ? '読み込み中...' : `${drivers.length}名のドライバーが登録されています`}</div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-3 font-semibold">名前</th>
                    <th className="px-3 py-3 font-semibold">電話番号</th>
                    <th className="px-3 py-3 font-semibold">住所</th>
                    <th className="px-3 py-3 font-semibold">担当エリア</th>
                    <th className="px-3 py-3 font-semibold">車両ID</th>
                    <th className="px-3 py-3 font-semibold">KPI</th>
                    <th className="px-3 py-3 font-semibold">ステータス</th>
                    <th className="px-3 py-3 font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map((driver) => (
                    <tr key={driver.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-3 py-4 font-medium text-slate-900">{driver.name}</td>
                      <td className="px-3 py-4 text-slate-600">{driver.phone}</td>
                      <td className="px-3 py-4 text-slate-600">{driver.address}</td>
                      <td className="px-3 py-4 text-slate-600">{driver.area}</td>
                      <td className="px-3 py-4 text-slate-600">{driver.vehicle_id ?? '-'}</td>
                      <td className="px-3 py-4 text-slate-600">{driver.kpi}</td>
                      <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${driver.status === '稼働' ? 'bg-emerald-100 text-emerald-700' : driver.status === '応援' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{driver.status}</span></td>
                      <td className="px-3 py-4"><div className="flex gap-2"><button type="button" onClick={() => handleEdit(driver)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">編集</button><button type="button" onClick={() => handleDelete(driver.id)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50">削除</button></div></td>
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
