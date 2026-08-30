"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase as maybeSupabase } from "../../../lib/supabase";

const supabase = maybeSupabase!;

type Driver = {
  id: number;
  office: string;
  subOffice?: string;
  subOffices?: string[];
  name: string;
  phone: string;
  startDate?: string;
  retirementDate?: string;
  status: "稼働" | "休み" | "応援" | "退職";
  supportedCourses?: string[];
  fixedCourse?: string;
  assignmentMode?: "通常" | "応援のみ" | "最終候補" | "自動除外";
};

const STORAGE_KEY = "unite-fleet-drivers";
const DRIVERS_INITIALIZED_KEY = "unite-fleet-drivers-initialized";

export default function RetiredDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [editingRetirementId, setEditingRetirementId] = useState<number | null>(null);
  const [retirementDateInput, setRetirementDateInput] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const load = async () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try { setDrivers(JSON.parse(saved)); } catch {}
      }
      const { data } = await supabase
        .from("fleet_master")
        .select("drivers")
        .eq("id", "default")
        .maybeSingle();
      if (data && Array.isArray(data.drivers)) {
        const next = data.drivers as Driver[];
        setDrivers(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        localStorage.setItem(DRIVERS_INITIALIZED_KEY, "true");
      }
    };
    load();
  }, []);

  const getTenure = (startDate?: string, retirementDate?: string) => {
    if (!startDate) return "未登録";
    const start = new Date(`${startDate}T00:00:00`);
    const end = retirementDate ? new Date(`${retirementDate}T00:00:00`) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return "日付確認";
    let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
    if (end.getDate() < start.getDate()) months -= 1;
    months = Math.max(0, months);
    const years = Math.floor(months / 12);
    const rest = months % 12;
    if (years && rest) return `${years}年${rest}ヶ月`;
    if (years) return `${years}年`;
    return `${months}ヶ月`;
  };

  const retiredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drivers
      .filter((d) => d.status === "退職")
      .filter((d) => [d.name, d.office, d.phone, d.startDate ?? "", d.retirementDate ?? ""]
        .join(" ").toLowerCase().includes(q))
      .sort((a, b) => (b.retirementDate ?? "").localeCompare(a.retirementDate ?? ""));
  }, [drivers, search]);

  const saveRetirementDate = async (id: number) => {
    const target = drivers.find((d) => d.id === id);
    if (!target) return;
    if (!retirementDateInput) {
      alert("退職日を入力してください");
      return;
    }
    if (target.startDate && retirementDateInput < target.startDate) {
      alert("退職日は勤務開始日以降の日付にしてください");
      return;
    }

    const next = drivers.map((d) =>
      d.id === id ? { ...d, retirementDate: retirementDateInput } : d
    );

    setDrivers(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(DRIVERS_INITIALIZED_KEY, "true");

    if (session) {
      const { data: master } = await supabase
        .from("fleet_master")
        .select("offices,course_settings")
        .eq("id", "default")
        .maybeSingle();

      const { error } = await supabase.from("fleet_master").upsert({
        id: "default",
        offices: master?.offices ?? [],
        drivers: next,
        course_settings: master?.course_settings ?? [],
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        setMessage(`退職日の保存エラー：${error.message}`);
        return;
      }
    }

    setEditingRetirementId(null);
    setRetirementDateInput("");
    setMessage(`${target.name}の退職日を保存しました`);
  };

  const restoreDriver = async (id: number) => {
    const target = drivers.find((d) => d.id === id);
    if (!target || !confirm(`${target.name}を稼働ドライバーへ復帰させますか？`)) return;

    const next = drivers.map((d) =>
      d.id === id ? { ...d, status: "稼働" as const, retirementDate: "" } : d
    );
    setDrivers(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(DRIVERS_INITIALIZED_KEY, "true");

    if (!session) {
      setMessage("ローカルで復帰しました。クラウド反映には管理者ログインが必要です");
      return;
    }

    const { data: master } = await supabase
      .from("fleet_master")
      .select("offices,course_settings")
      .eq("id", "default")
      .maybeSingle();

    const { error } = await supabase.from("fleet_master").upsert({
      id: "default",
      offices: master?.offices ?? [],
      drivers: next,
      course_settings: master?.course_settings ?? [],
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    });

    setMessage(error ? `復帰エラー：${error.message}` : `${target.name}を復帰しました`);
  };

  return (
    <main className="p-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">退職者リスト</h1>
        <Link href="/drivers" className="ml-auto rounded bg-blue-600 px-4 py-2 font-semibold text-white">
          ← ドライバー管理へ戻る
        </Link>
      </div>

      <div className="mb-5 rounded-xl border bg-gray-50 p-3 text-sm">
        退職者は通常のドライバー一覧には表示されません。復帰するとドライバー管理へ戻ります。
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="氏名・営業所・日付を検索"
        className="mb-4 w-full rounded border p-2"
      />

      {message && <div className="mb-4 font-semibold text-blue-700">{message}</div>}

      <div className="overflow-x-auto">
        <table className="min-w-[850px] w-full border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">営業所</th>
              <th className="border p-2">氏名</th>
              <th className="border p-2">電話番号</th>
              <th className="border p-2">勤務開始日</th>
              <th className="border p-2">退職日</th>
              <th className="border p-2">在籍期間</th>
              <th className="border p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {retiredDrivers.map((driver) => (
              <tr key={driver.id}>
                <td className="border p-2">{driver.office}</td>
                <td className="border p-2 font-semibold">{driver.name}</td>
                <td className="border p-2">{driver.phone}</td>
                <td className="border p-2 text-center">{driver.startDate?.replaceAll("-", "/") || "未登録"}</td>
                <td className="border p-2 text-center">
                  {editingRetirementId === driver.id ? (
                    <div className="flex min-w-[190px] items-center gap-2">
                      <input
                        type="date"
                        value={retirementDateInput}
                        min={driver.startDate || undefined}
                        onChange={(e) => setRetirementDateInput(e.target.value)}
                        className="min-w-0 flex-1 rounded border p-1.5"
                      />
                      <button
                        type="button"
                        onClick={() => saveRetirementDate(driver.id)}
                        className="rounded bg-blue-600 px-2 py-1.5 font-semibold text-white"
                      >
                        保存
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>{driver.retirementDate?.replaceAll("-", "/") || "未登録"}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRetirementId(driver.id);
                          setRetirementDateInput(driver.retirementDate ?? "");
                        }}
                        className="rounded bg-orange-500 px-2 py-1 text-xs font-semibold text-white"
                      >
                        {driver.retirementDate ? "変更" : "登録"}
                      </button>
                    </div>
                  )}
                </td>
                <td className="border p-2 text-center font-semibold">{getTenure(driver.startDate, driver.retirementDate)}</td>
                <td className="border p-2 text-center">
                  <div className="flex justify-center gap-2">
                    {editingRetirementId === driver.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRetirementId(null);
                          setRetirementDateInput("");
                        }}
                        className="rounded border px-3 py-1 font-semibold"
                      >
                        キャンセル
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => restoreDriver(driver.id)}
                      className="rounded bg-green-600 px-3 py-1 font-semibold text-white"
                    >
                      復帰
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {retiredDrivers.length === 0 && (
              <tr><td colSpan={7} className="border p-5 text-center text-gray-500">退職者はいません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
