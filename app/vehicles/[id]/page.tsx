"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Vehicle = {
  id: number;
  office: string;
  number: string;
  driver: string;
  status: "貸出中" | "保管中" | "廃車";
  storageLocation: string;
  inspection: string;
  insurance: string;
  maker: string;
  model: string;
  chassisNumber: string;
  firstRegistration: string;
  userName: string;
  ownerName: string;
};

const STORAGE_KEY = "unite-fleet-vehicles";

export default function VehicleDetailPage() {
  const params = useParams<{ id: string }>();

  const [vehicle, setVehicle] = useState<
    Vehicle | null | undefined
  >(undefined);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      setVehicle(null);
      return;
    }

    const vehicles: Vehicle[] = JSON.parse(saved);

    const foundVehicle = vehicles.find(
      (item) => String(item.id) === String(params.id)
    );

    setVehicle(foundVehicle || null);
  }, [params.id]);

  if (vehicle === undefined) {
    return <main className="p-6">読み込み中...</main>;
  }

  if (vehicle === null) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">
          車両が見つかりません
        </h1>

        <Link
          href="/vehicles"
          className="inline-block mt-6 bg-gray-700 text-white rounded px-4 py-2"
        >
          車両管理へ戻る
        </Link>
      </main>
    );
  }

  const status = vehicle.status || "保管中";

  const details = [
    ["営業所", vehicle.office],
    ["車番", vehicle.number],
    ["ドライバー名", vehicle.driver],
    ["貸出状況", status],
    ["保管場所", vehicle.storageLocation],
    ["メーカー", vehicle.maker],
    ["車種", vehicle.model],
    ["車台番号", vehicle.chassisNumber],
    ["初度登録年月", vehicle.firstRegistration],
    ["使用者名", vehicle.userName],
    ["所有者名", vehicle.ownerName],
    ["車検期限", vehicle.inspection],
    ["保険期限", vehicle.insurance],
  ];

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">🚗 車両詳細</h1>
          <p className="mt-2 text-gray-600">
            車番：{vehicle.number}
          </p>
        </div>

        <Link
          href="/vehicles"
          className="bg-gray-700 text-white rounded px-4 py-2"
        >
          車両管理へ戻る
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {details.map(([label, value]) => (
            <div
              key={label}
              className="border rounded-lg p-4"
            >
              <p className="text-sm font-bold text-gray-500">
                {label}
              </p>

              <p className="mt-2 text-lg">
                {value || "未登録"}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <Link
            href={`/vehicles/${vehicle.id}/edit`}
            className="bg-yellow-400 text-black font-bold rounded px-5 py-2"
          >
            修正する
          </Link>
        </div>
      </div>
    </main>
  );
}