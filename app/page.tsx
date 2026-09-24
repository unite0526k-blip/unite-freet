"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase as maybeSupabase } from "../lib/supabase";

const supabase = maybeSupabase!;

const VEHICLES_STORAGE_KEY = "unite-fleet-vehicles";
const DRIVERS_STORAGE_KEY = "unite-fleet-drivers";
const FINANCE_STORAGE_KEY = "unite-fleet-finance-transactions";

function getSavedCount(key: string) {
  try {
    const saved = localStorage.getItem(key);

    if (!saved) return 0;

    const data = JSON.parse(saved);

    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

function getCurrentMonth() {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

export default function Home() {
  const [vehicleCount, setVehicleCount] = useState(0);
  const [driverCount, setDriverCount] = useState(0);

  const [financeIncome, setFinanceIncome] = useState(0);
  const [financeExpense, setFinanceExpense] = useState(0);

  useEffect(() => {
    const loadCounts = async () => {
      // =========================
      // 車両
      // =========================
      setVehicleCount(getSavedCount(VEHICLES_STORAGE_KEY));

      // =========================
      // ドライバー
      // =========================
      setDriverCount(getSavedCount(DRIVERS_STORAGE_KEY));

      // =========================
      // 資金・損益
      // =========================
      try {
        const savedFinance = localStorage.getItem(
          FINANCE_STORAGE_KEY
        );

        if (savedFinance) {
          const transactions = JSON.parse(savedFinance);

          if (Array.isArray(transactions)) {
            const currentMonth = getCurrentMonth();

            const thisMonth = transactions.filter(
              (item: any) =>
                typeof item?.date === "string" &&
                item.date.startsWith(currentMonth)
            );

            const income = thisMonth
              .filter((item: any) => item.type === "入金")
              .reduce(
                (sum: number, item: any) =>
                  sum + Number(item.amount || 0),
                0
              );

            const expense = thisMonth
              .filter((item: any) => item.type === "出金")
              .reduce(
                (sum: number, item: any) =>
                  sum + Number(item.amount || 0),
                0
              );

            setFinanceIncome(income);
            setFinanceExpense(expense);
          }
        }
      } catch (error) {
        console.error(
          "資金データの取得に失敗しました",
          error
        );
      }

      // =========================
      // Supabaseからドライバー取得
      // =========================
      try {
        const { data, error } = await supabase
          .from("fleet_master")
          .select("drivers")
          .eq("id", "default")
          .maybeSingle();

        if (
          !error &&
          data &&
          Array.isArray(data.drivers)
        ) {
          const activeDrivers = data.drivers.filter(
            (driver: any) =>
              driver?.status !== "退職"
          );

          setDriverCount(activeDrivers.length);

          localStorage.setItem(
            DRIVERS_STORAGE_KEY,
            JSON.stringify(data.drivers)
          );
        }
      } catch (error) {
        console.error(
          "ドライバー数の取得に失敗しました",
          error
        );
      }
    };

    void loadCounts();
  }, []);

  const financeBalance =
    financeIncome - financeExpense;

  const currentMonth = getCurrentMonth();

  const [year, month] = currentMonth.split("-");

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-blue-600">
        UNITE Fleet
      </h1>

      <p className="mt-4 text-gray-600">
        車両・ドライバー・資金管理システム
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">

        {/* 車両管理 */}
        <Link
          href="/vehicles"
          className="block bg-white rounded-xl shadow p-6 hover:shadow-lg transition"
        >
          <h2 className="text-xl font-bold">
            🚗 車両管理
          </h2>

          <p className="mt-2">
            {vehicleCount}台登録
          </p>
        </Link>

        {/* ドライバー管理 */}
        <Link
          href="/drivers"
          className="block bg-white rounded-xl shadow p-6 hover:shadow-lg transition"
        >
          <h2 className="text-xl font-bold">
            👤 ドライバー
          </h2>

          <p className="mt-2">
            {driverCount}名登録
          </p>
        </Link>

        {/* 通知 */}
        <Link
          href="/notices"
          className="block bg-white rounded-xl shadow p-6 hover:shadow-lg transition cursor-pointer"
        >
          <h2 className="text-xl font-bold">
            🔔 通知
          </h2>

          <p className="mt-2">
            車検・保険期限
          </p>
        </Link>

        {/* 資金・損益管理 */}
        <Link
          href="/finance"
          className="block bg-white rounded-xl shadow p-6 hover:shadow-lg transition cursor-pointer md:col-span-2"
        >
          <div className="flex items-start justify-between gap-4">

            <div>
              <h2 className="text-xl font-bold">
                💰 資金・損益管理
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {year}年{Number(month)}月
              </p>
            </div>

            <span className="text-sm text-gray-400">
              詳細を見る →
            </span>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">

            {/* 入金 */}
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">
                入金
              </p>

              <p className="mt-1 text-xl font-bold text-green-600">
                ¥{financeIncome.toLocaleString()}
              </p>
            </div>

            {/* 出金 */}
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">
                出金
              </p>

              <p className="mt-1 text-xl font-bold text-red-600">
                ¥{financeExpense.toLocaleString()}
              </p>
            </div>

            {/* 収支 */}
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">
                収支
              </p>

              <p
                className={`mt-1 text-xl font-bold ${
                  financeBalance < 0
                    ? "text-red-600"
                    : "text-blue-600"
                }`}
              >
                {financeBalance >= 0 ? "+" : ""}
                ¥{financeBalance.toLocaleString()}
              </p>
            </div>

          </div>
        </Link>

        {/* シフト管理 */}
        <Link
          href="/shift"
          className="block bg-white rounded-xl shadow p-6 hover:shadow-lg transition"
        >
          <h2 className="text-xl font-bold">
            📅 シフト管理
          </h2>

          <p className="mt-2">
            月間シフト・配置管理
          </p>
        </Link>

      </div>
    </main>
  );
}