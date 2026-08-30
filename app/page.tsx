"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase as maybeSupabase } from "../lib/supabase";

const supabase = maybeSupabase!;

const VEHICLES_STORAGE_KEY = "unite-fleet-vehicles";
const DRIVERS_STORAGE_KEY = "unite-fleet-drivers";

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

export default function Home() {
  const [vehicleCount, setVehicleCount] = useState(0);
  const [driverCount, setDriverCount] = useState(0);

  useEffect(() => {
    const loadCounts = async () => {
      // まず端末内のデータを表示
      setVehicleCount(getSavedCount(VEHICLES_STORAGE_KEY));
      setDriverCount(getSavedCount(DRIVERS_STORAGE_KEY));

      // ドライバー数はクラウドのマスターを正として取得
      try {
        const { data, error } = await supabase
          .from("fleet_master")
          .select("drivers")
          .eq("id", "default")
          .maybeSingle();

        if (!error && data && Array.isArray(data.drivers)) {
          // 退職者を除いた現在のドライバー数
          const activeDrivers = data.drivers.filter(
            (driver: any) => driver?.status !== "退職"
          );

          setDriverCount(activeDrivers.length);

          // この端末にも同期
          localStorage.setItem(
            DRIVERS_STORAGE_KEY,
            JSON.stringify(data.drivers)
          );
        }
      } catch (error) {
        console.error("ドライバー数の取得に失敗しました", error);
      }
    };

    void loadCounts();
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-blue-600">
        UNITE Fleet
      </h1>

      <p className="mt-4 text-gray-600">
        車両管理システム Ver1
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Link
          href="/vehicles"
          className="block bg-white rounded-xl shadow p-6 hover:shadow-lg transition"
        >
          <h2 className="text-xl font-bold">🚗 車両管理</h2>
          <p className="mt-2">{vehicleCount}台登録</p>
        </Link>

        <Link
          href="/drivers"
          className="block bg-white rounded-xl shadow p-6 hover:shadow-lg transition"
        >
          <h2 className="text-xl font-bold">👤 ドライバー</h2>
          <p className="mt-2">{driverCount}名登録</p>
        </Link>

        <Link
          href="/notices"
          className="block bg-white rounded-xl shadow p-6 hover:shadow-lg transition cursor-pointer"
        >
          <h2 className="text-xl font-bold">🔔 通知</h2>
          <p className="mt-2">車検・保険期限</p>
        </Link>
      </div>
    </main>
  );
}