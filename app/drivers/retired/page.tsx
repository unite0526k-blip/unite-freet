"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase as maybeSupabase } from "../../../lib/supabase";

const supabase = maybeSupabase!;
const STORAGE_KEY = "unite-fleet-drivers";

type Driver = {
  id: number;
  name: string;
  office: string;
  phone?: string;
  startDate?: string;
  retirementDate?: string;
  status: "稼働" | "休み" | "応援" | "退職";
  [key: string]: unknown;
};

function normalizeName(value: string) {
  return value.replace(/[\s　]+/g, "").trim();
}

function tenure(startText?: string, endText?: string) {
  if (!startText || !endText) return "未登録";
  const start = new Date(`${startText}T00:00:00`);
  const end = new Date(`${endText}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return "日付確認";
  let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months--;
  months = Math.max(0, months);
  const anchor = new Date(start);
  anchor.setDate(1);
  anchor.setMonth(anchor.getMonth() + months);
  anchor.setDate(Math.min(start.getDate(), new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()));
  const days = Math.max(0, Math.floor((end.getTime() - anchor.getTime()) / 86400000));
  if (days >= 15) months++;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return years ? `${years}年${rest ? `${rest}ヶ月` : ""}` : `${months}ヶ月`;
}

export default function RetiredDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [dateEdits, setDateEdits] = useState<Record<number, string>>({});
  const [pinEdits, setPinEdits] = useState<Record<number, string>>({});
  const [visiblePins, setVisiblePins] = useState<Record<number, string>>({});
  const [pinLoadingId, setPinLoadingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setVisiblePins({});
    try {
      const { data: auth } = await supabase.auth.getSession();
      if (auth.session) {
        const { data, error } = await supabase.from("fleet_master").select("drivers").eq("id", "default").single();
        if (error) throw error;
        if (!Array.isArray(data?.drivers)) throw new Error("クラウドの名簿を確認できません。");
        setDrivers(data.drivers as Driver[]);
        setMessage("");
      } else {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) throw new Error("ローカル名簿がありません。管理者ログインしてから開いてください。");
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error("ローカル名簿の形式が正しくありません。");
        setDrivers(parsed as Driver[]);
        setMessage("ローカルの名簿を表示中です。変更には管理者ログインが必要です。");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "読込に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const retired = useMemo(() => drivers.filter((d) => d.status === "退職")
    .filter((d) => [d.name, d.office, d.phone ?? ""].join(" ").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.retirementDate ?? "").localeCompare(a.retirementDate ?? "")), [drivers, search]);

  const showPin = async (driver: Driver) => {
    if (visiblePins[driver.id]) {
      setVisiblePins((old) => {
        const next = { ...old };
        delete next[driver.id];
        return next;
      });
      return;
    }
    if (pinLoadingId !== null) return;
    setPinLoadingId(driver.id);
    setMessage("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getSession();
      if (authError || !auth.session?.access_token) throw new Error("管理者ログインが必要です。");
      const response = await fetch("/api/admin/retired-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.session.access_token}`,
        },
        body: JSON.stringify({ driverId: driver.id }),
        cache: "no-store",
      });
      const result: { pin?: string; error?: string } = await response.json();
      if (!response.ok || !result.pin) throw new Error(result.error || "PINを取得できませんでした。");
      setVisiblePins((old) => ({ ...old, [driver.id]: result.pin! }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PINの確認に失敗しました。");
    } finally {
      setPinLoadingId(null);
    }
  };

  const updateDriver = async (driver: Driver, patch: Partial<Driver>) => {
    if (busy) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) throw new Error("変更するには管理者ログインが必要です。");
      const { data: master, error: readError } = await supabase.from("fleet_master")
        .select("offices,drivers,course_settings").eq("id", "default").single();
      if (readError) throw readError;
      const current = Array.isArray(master?.drivers) ? master.drivers as Driver[] : [];
      const target = current.find((d) => d.id === driver.id);
      if (!target || target.status !== "退職") throw new Error("退職者データが更新されています。再読込してください。");
      const next = current.map((d) => d.id === driver.id ? { ...d, ...patch } : d);
      const { error } = await supabase.from("fleet_master").upsert({
        id: "default", offices: master.offices, drivers: next,
        course_settings: master.course_settings,
        updated_by: auth.session.user.id, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setDrivers(next);
      setVisiblePins({});
      setMessage(`${driver.name}さんの情報を保存しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    } finally { setBusy(false); }
  };

  const savePin = async (driver: Driver) => {
    if (busy) return;
    const pin = pinEdits[driver.id] ?? "";
    if (!/^\d{4}$/.test(pin)) return setMessage("PINは数字4桁で入力してください。");
    if (!confirm(`${driver.name}さんの共通PINを登録・変更しますか？`)) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) throw new Error("PIN変更には管理者ログインが必要です。");
      const { data: rows, error: readError } = await supabase.from("shift_driver_settings")
        .select("id,driver_name");
      if (readError) throw readError;
      const matches = (rows ?? []).filter((r) => normalizeName(String(r.driver_name ?? "")) === normalizeName(driver.name));
      if (matches.length > 1) throw new Error("同名の設定が複数あります。シフト設定を確認してください。");
      if (matches.length === 1) {
        const { error } = await supabase.from("shift_driver_settings")
          .update({ pin_code: pin }).eq("id", matches[0].id);
        if (error) throw error;
      } else {
        // 退職者で設定が消えている場合も、必要な初期値を付けて新規登録する。
        const { error } = await supabase.from("shift_driver_settings").insert({
          driver_name: driver.name,
          office: driver.office || "営業所なし",
          pin_code: pin,
          fixed_days_off: [],
          available_courses: [],
          course_priorities: [],
          auto_assign: false,
        });
        if (error) throw error;
      }
      setPinEdits((old) => ({ ...old, [driver.id]: "" }));
      setVisiblePins((old) => { const next = { ...old }; delete next[driver.id]; return next; });
      setMessage(`${driver.name}さんのPINを登録・更新しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PIN変更に失敗しました。");
    } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">退職者リスト</h1>
        <Link href="/drivers" className="rounded bg-slate-800 px-4 py-2 font-semibold text-white">← ドライバー管理に戻る</Link>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className="min-w-64 flex-1 rounded border p-3" placeholder="名前・営業所・電話番号で検索" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button onClick={() => void load()} disabled={busy || loading} className="rounded border bg-white px-4 py-3 disabled:opacity-50">クラウドから再読込</button>
      </div>
      {message && <p className="mb-4 rounded border bg-slate-50 p-3 text-sm">{message}</p>}
      <p className="mb-3 text-sm text-gray-600">退職者 {retired.length}名 ／ 在籍期間は15日以上の端数を1ヶ月に切り上げ</p>
      {loading ? <p>読み込み中…</p> : retired.length === 0 ? <p className="rounded border p-6 text-center">退職者は登録されていません。</p> : (
        <div className="space-y-4">
          {retired.map((driver) => (
            <section key={driver.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold">{driver.name}</h2>
                <span className="rounded bg-gray-200 px-2 py-1 text-xs">{driver.office}</span>
                <span className="text-sm text-gray-500">{driver.phone || "電話番号未登録"}</span>
              </div>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div><p className="text-xs text-gray-500">勤務開始日</p><p>{driver.startDate || "未登録"}</p></div>
                <div><p className="text-xs text-gray-500">退職日</p><p>{driver.retirementDate || "未登録"}</p></div>
                <div><p className="text-xs text-gray-500">在籍期間</p><p className="font-semibold">{tenure(driver.startDate, driver.retirementDate)}</p></div>
              </div>
              <div className="flex flex-wrap items-end gap-3 border-t pt-4">
                <label className="text-sm">退職日を変更
                  <input type="date" className="mt-1 block rounded border p-2" value={dateEdits[driver.id] ?? driver.retirementDate ?? ""} onChange={(e) => setDateEdits((old) => ({ ...old, [driver.id]: e.target.value }))} />
                </label>
                <button disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" onClick={() => {
                  const date = dateEdits[driver.id] ?? driver.retirementDate ?? "";
                  if (!date || (driver.startDate && date < driver.startDate)) return setMessage("退職日は勤務開始日以降の日付を入力してください。");
                  void updateDriver(driver, { retirementDate: date });
                }}>退職日を保存</button>
                <button disabled={busy} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50" onClick={() => {
                  if (confirm(`${driver.name}さんを稼働中のドライバーとして復帰させますか？`)) void updateDriver(driver, { status: "稼働", retirementDate: "" });
                }}>復帰する</button>
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
                <div className="text-sm">
                  <p className="mb-1">現在の4桁PIN（管理者のみ）</p>
                  <div className="flex items-center gap-3">
                    <span className="inline-block min-w-20 rounded border bg-slate-50 px-3 py-2 text-center font-mono text-lg font-bold tracking-widest">
                      {visiblePins[driver.id] ?? "••••"}
                    </span>
                    <button type="button" disabled={pinLoadingId !== null} onClick={() => void showPin(driver)} className="rounded border bg-white px-3 py-2 disabled:opacity-50">
                      {pinLoadingId === driver.id ? "確認中…" : visiblePins[driver.id] ? "隠す" : "PINを確認"}
                    </button>
                  </div>
                </div>
                <label className="text-sm">4桁PINを再設定
                  <input type="password" inputMode="numeric" maxLength={4} autoComplete="new-password" placeholder="新しい4桁" className="mt-1 block w-40 rounded border p-2" value={pinEdits[driver.id] ?? ""} onChange={(e) => setPinEdits((old) => ({ ...old, [driver.id]: e.target.value.replace(/\D/g, "").slice(0, 4) }))} />
                </label>
                <button disabled={busy} className="rounded bg-orange-500 px-4 py-2 text-white disabled:opacity-50" onClick={() => void savePin(driver)}>PINを変更</button>
                <span className="text-xs text-gray-500">シフト共有・支払明細と共通のPINです。</span>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
