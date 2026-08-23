"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const OFFICES = [
  "松阪営業所",
  "伊勢営業所",
  "鈴鹿営業所",
  "伊賀営業所",
  "浜松営業所",
  "京都営業所",
];

const DRIVERS_BY_OFFICE: Record<string, string[]> = {
  松阪営業所: [
    "吉田　健人",
    "清水　國光",
    "清水　光真",
    "徳田　亮太",
    "横溝　一泰",
    "中川 昭治",
    "楠滝 空杜",
    "真田 拓海",
    "齋藤 朋樹",
    "福田 華月",
    "垣内 連",
    "伊藤 圭志",
  ],
  伊勢営業所: ["東 真規", "勝村 武史", "藤原 颯士", "西田 勇太"],
  鈴鹿営業所: ["仲村 賢一郎"],
  伊賀営業所: ["山崎 雅也", "辻本 顕寛", "小倉 祐司"],
  浜松営業所: [
    "津嘉山 一君",
    "藤田 祥範",
    "レイネル セバスチャン",
  ],
  京都営業所: [],
};

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

type TextField = Exclude<keyof Vehicle, "id" | "status">;

const STORAGE_KEY = "unite-fleet-vehicles";

export default function VehicleEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

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

  const updateText = (field: TextField, value: string) => {
    if (!vehicle) return;

    setVehicle({
      ...vehicle,
      [field]: value,
    });
  };

  const saveVehicle = () => {
    if (!vehicle) return;

    if (!vehicle.office || !vehicle.number) {
      alert("営業所と車番は必須です");
      return;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    const vehicles: Vehicle[] = saved ? JSON.parse(saved) : [];

    const updatedVehicles = vehicles.map((item) =>
      String(item.id) === String(vehicle.id)
        ? vehicle
        : item
    );

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updatedVehicles)
    );

    alert("修正内容を保存しました");

    router.push(`/vehicles/${vehicle.id}`);
  };

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

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">🟡 車両情報の修正</h1>

        <Link
          href={`/vehicles/${vehicle.id}`}
          className="bg-gray-700 text-white rounded px-4 py-2"
        >
          詳細へ戻る
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label>
            <span className="font-bold">営業所</span>
            <select
              className="mt-1 border rounded p-2 w-full"
              value={vehicle.office}
              onChange={(e) => {
                setVehicle({
                  ...vehicle,
                  office: e.target.value,
                  driver: "",
                });
              }}
            >
              <option value="">営業所選択</option>

              {OFFICES.map((office) => (
                <option key={office} value={office}>
                  {office}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="font-bold">車番</span>
            <input
              className="mt-1 border rounded p-2 w-full"
              value={vehicle.number}
              onChange={(e) =>
                updateText("number", e.target.value)
              }
            />
          </label>

          <label>
            <span className="font-bold">ドライバー名</span>
            <select
              className="mt-1 border rounded p-2 w-full"
              value={vehicle.driver}
              onChange={(e) =>
                updateText("driver", e.target.value)
              }
            >
              <option value="">担当者選択</option>

              {(DRIVERS_BY_OFFICE[vehicle.office] || []).map(
                (driver) => (
                  <option key={driver} value={driver}>
                    {driver}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <span className="font-bold">貸出状況</span>
            <select
              className="mt-1 border rounded p-2 w-full"
              value={vehicle.status || "保管中"}
              onChange={(e) =>
                setVehicle({
                  ...vehicle,
                  status: e.target.value as Vehicle["status"],
                })
              }
            >
              <option value="貸出中">貸出中</option>
              <option value="保管中">保管中</option>
              <option value="廃車">廃車</option>
            </select>
          </label>

          <label>
            <span className="font-bold">保管場所</span>
            <input
              className="mt-1 border rounded p-2 w-full"
              value={vehicle.storageLocation || ""}
              onChange={(e) =>
                updateText("storageLocation", e.target.value)
              }
            />
          </label>

          <label>
            <span className="font-bold">メーカー</span>
            <input
              className="mt-1 border rounded p-2 w-full"
              value={vehicle.maker || ""}
              onChange={(e) =>
                updateText("maker", e.target.value)
              }
            />
          </label>

          <label>
            <span className="font-bold">車種</span>
            <input
              className="mt-1 border rounded p-2 w-full"
              value={vehicle.model || ""}
              onChange={(e) =>
                updateText("model", e.target.value)
              }
            />
          </label>

          <label>
            <span className="font-bold">車台番号</span>
            <input
              className="mt-1 border rounded p-2 w-full"
              value={vehicle.chassisNumber || ""}
              onChange={(e) =>
                updateText("chassisNumber", e.target.value)
              }
            />
          </label>

          <label>
            <span className="font-bold">初度登録年月</span>
            <input
              className="mt-1 border rounded p-2 w-full"
              value={vehicle.firstRegistration || ""}
              onChange={(e) =>
                updateText("firstRegistration", e.target.value)
              }
            />
          </label>

          <label>
            <span className="font-bold">使用者名</span>
            <input
              className="mt-1 border rounded p-2 w-full"
              value={vehicle.userName || ""}
              onChange={(e) =>
                updateText("userName", e.target.value)
              }
            />
          </label>

          <label>
            <span className="font-bold">所有者名</span>
            <input
              className="mt-1 border rounded p-2 w-full"
              value={vehicle.ownerName || ""}
              onChange={(e) =>
                updateText("ownerName", e.target.value)
              }
            />
          </label>

          <label>
            <span className="font-bold">車検期限</span>
            <input
              type="date"
              className="mt-1 border rounded p-2 w-full"
              value={vehicle.inspection || ""}
              onChange={(e) =>
                updateText("inspection", e.target.value)
              }
            />
          </label>

          <label>
            <span className="font-bold">保険期限</span>
            <input
              type="date"
              className="mt-1 border rounded p-2 w-full"
              value={vehicle.insurance || ""}
              onChange={(e) =>
                updateText("insurance", e.target.value)
              }
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Link
            href={`/vehicles/${vehicle.id}`}
            className="bg-gray-500 text-white rounded px-5 py-2"
          >
            キャンセル
          </Link>

          <button
            type="button"
            onClick={saveVehicle}
            className="bg-yellow-400 text-black font-bold rounded px-5 py-2"
          >
            修正内容を保存
          </button>
        </div>
      </div>
    </main>
  );
}