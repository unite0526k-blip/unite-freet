"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabase as maybeSupabase } from "../../lib/supabase";

const supabase = maybeSupabase!;
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
  浜松営業所: ["津嘉山 一君", "藤田 祥範", "レイネル セバスチャン"],
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

const STORAGE_KEY = "unite-fleet-vehicles";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMessage, setCloudMessage] = useState("");
const [sortOrder, setSortOrder] = useState("registered");
 const [form, setForm] = useState({
  office: "",
  number: "",
  driver: "",
  status: "保管中" as Vehicle["status"],
  storageLocation: "",
  inspection: "",
  insurance: "",

  maker: "",
  model: "",
  chassisNumber: "",
  firstRegistration: "",
  userName: "",
  ownerName: "",
});

  const [isLoaded, setIsLoaded] = useState(false);

useEffect(() => {
  supabase.auth.getSession().then(({ data }) => setSession(data.session));

  const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
    setSession(nextSession);
  });

  return () => data.subscription.unsubscribe();
}, []);

useEffect(() => {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    setVehicles(JSON.parse(saved));
  }

  setIsLoaded(true);
}, []);

useEffect(() => {
  if (!isLoaded) return;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(vehicles)
  );
}, [vehicles, isLoaded]);
useEffect(() => {
  if (!isLoaded || vehicles.length === 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysLeft = (date: string) => {
    if (!date) return null;

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    return Math.ceil(
      (targetDate.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24)
    );
  };

  const warnings: string[] = [];

  vehicles.forEach((vehicle) => {
    const inspectionDays = getDaysLeft(vehicle.inspection);
    const insuranceDays = getDaysLeft(vehicle.insurance);

    if (inspectionDays !== null && inspectionDays <= 30) {
      warnings.push(
        `車番 ${vehicle.number}：車検まであと${inspectionDays}日`
      );
    }

    if (insuranceDays !== null && insuranceDays <= 30) {
      warnings.push(
        `車番 ${vehicle.number}：保険期限まであと${insuranceDays}日`
      );
    }
  });

  if (warnings.length > 0) {
  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = "square";
    oscillator.frequency.value = 880;
    gainNode.gain.value = 0.15;

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.4);
  } catch {
    // 音が禁止されても警告表示は続ける
  }

  setTimeout(() => {
    alert(`⚠️ 期限が近い車両があります\n\n${warnings.join("\n")}`);
  }, 500);
}
}, [isLoaded]);

const loadVehiclesFromCloud = async () => {
  if (!session) {
    setCloudMessage("管理者ログイン後にクラウドから読み込めます。");
    return;
  }

  setCloudBusy(true);
  setCloudMessage("クラウドから読み込み中...");

  const { data, error } = await supabase
    .from("fleet_vehicle_master")
    .select("vehicles")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    setCloudMessage(`読込エラー：${error.message}`);
  } else if (!data) {
    setCloudMessage("クラウドにはまだ車両データが保存されていません。");
  } else {
    const cloudVehicles = Array.isArray(data.vehicles)
      ? (data.vehicles as Vehicle[])
      : [];

    setVehicles(cloudVehicles);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudVehicles));
    setCloudMessage(`クラウドから車両${cloudVehicles.length}台を読み込みました。`);
  }

  setCloudBusy(false);
};

const saveVehiclesToCloud = async () => {
  if (!session) {
    setCloudMessage("管理者ログイン後にクラウドへ保存できます。");
    return;
  }

  setCloudBusy(true);
  setCloudMessage("クラウドへ保存中...");

  const { error } = await supabase.from("fleet_vehicle_master").upsert({
    id: "default",
    vehicles,
    updated_by: session.user.id,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    setCloudMessage(`保存エラー：${error.message}`);
  } else {
    setCloudMessage(`車両${vehicles.length}台をクラウド保存しました。`);
  }

  setCloudBusy(false);
};

 const addVehicle = () => {
  alert("登録ボタンが押されました");

  if (!form.office || !form.number) {
    alert("営業所と車番は必須です");
    return;
  }

 const newVehicle: Vehicle = {
  id: Date.now(),
  office: form.office,
  number: form.number,
  driver: form.driver,
  status: form.status,
  storageLocation: form.storageLocation,
  inspection: form.inspection,
  insurance: form.insurance,
  maker: form.maker,
  model: form.model,
  chassisNumber: form.chassisNumber,
  firstRegistration: form.firstRegistration,
  userName: form.userName,
  ownerName: form.ownerName,
};
  setVehicles([...vehicles, newVehicle]);

  setForm({
  office: "",
  number: "",
  driver: "",
  status: "保管中",
  storageLocation: "",
  inspection: "",
  insurance: "",
  maker: "",
  model: "",
  chassisNumber: "",
  firstRegistration: "",
  userName: "",
  ownerName: "",
});
};

const deleteVehicle = (id: number) => {
    if (!confirm("削除しますか？")) return;

    setVehicles(vehicles.filter((v) => v.id !== id));
  };
const dateValue = (date: string) => {
  const value = Date.parse(date);
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
};

const sortedVehicles = [...vehicles].sort((a, b) => {
  if (sortOrder === "inspection") {
    return dateValue(a.inspection) - dateValue(b.inspection);
  }

  if (sortOrder === "insurance") {
    return dateValue(a.insurance) - dateValue(b.insurance);
  }

  if (sortOrder === "office") {
    return a.office.localeCompare(b.office, "ja");
  }

  return 0;
});
const getDateColor = (date: string) => {
  if (!date) return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const daysLeft = Math.ceil(
    (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysLeft <= 7) return "bg-red-200 text-red-800 font-bold";
  if (daysLeft <= 14) return "bg-orange-200 text-orange-800 font-bold";
  if (daysLeft <= 30) return "bg-yellow-200 text-yellow-800 font-bold";

  return "";
};
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">車両管理</h1>

      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold">
            ☁️ 車両クラウド
          </span>

          <button
            type="button"
            onClick={loadVehiclesFromCloud}
            disabled={cloudBusy}
            className="rounded border bg-white px-4 py-2 font-bold disabled:opacity-50"
          >
            クラウドから読込
          </button>

          <button
            type="button"
            onClick={saveVehiclesToCloud}
            disabled={cloudBusy}
            className="rounded bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-50"
          >
            クラウドへ保存
          </button>

          <span className="text-sm font-semibold text-blue-800">
            {session ? "管理者ログイン中" : "管理者ログインが必要です"}
          </span>
        </div>

        {cloudMessage && (
          <p className="mt-3 text-sm font-semibold text-blue-800">
            {cloudMessage}
          </p>
        )}
      </div>

      <div
  className="grid gap-3 mb-6"
  style={{
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
  }}
>
<select
  className="border p-2 rounded"
  value={form.office}
  onChange={(e) =>
    setForm({
      ...form,
      office: e.target.value,
      driver: "",
    })
  }
>
  <option value="">営業所選択</option>

  {OFFICES.map((office) => (
    <option key={office} value={office}>
      {office}
    </option>
  ))}
</select>

<input
  className="border p-2 rounded"
  placeholder="車番"
  value={form.number}
  onChange={(e) =>
    setForm({
      ...form,
      number: e.target.value,
    })
  }
/>
       <select
  className="border p-2 rounded"
  value={form.status}
  onChange={(e) =>
    setForm({
      ...form,
      status: e.target.value as Vehicle["status"],
    })
  }
>
  <option value="貸出中">貸出中</option>
  <option value="保管中">保管中</option>
  <option value="廃車">廃車</option>
</select>


<select
  className="border p-2 rounded"
  value={form.driver}
  onChange={(e) =>
    setForm({
      ...form,
      driver: e.target.value,
    })
  }
>
  <option value="">担当者選択</option>

  {(DRIVERS_BY_OFFICE[form.office] || []).map((driver) => (
    <option key={driver} value={driver}>
      {driver}
    </option>
  ))}
</select>
<div>
  <label className="text-sm font-semibold">🚗 車検日</label>

  <input
    type="date"
    className="border p-2 rounded w-full"
    value={form.inspection}
    onChange={(e) =>
      setForm({
        ...form,
        inspection: e.target.value,
      })
    }
  />
</div>
        <div>
  <label className="text-sm font-semibold">🛡️ 保険期限</label>
  <input
    type="date"
    className="border p-2 rounded w-full"
    value={form.insurance}
    onChange={(e) =>
      setForm({
        ...form,
        insurance: e.target.value,
      })
    }
  />
</div>

       

        <button
  type="button"
  onClick={addVehicle}
  className="col-span-2 md:col-span-4 bg-blue-600 text-white rounded px-4 py-3 cursor-pointer"
>
  登録
</button>

      </div>
<div className="mb-4 flex justify-end">
  <select
    value={sortOrder}
    onChange={(e) => setSortOrder(e.target.value)}
    className="border rounded p-2"
  >
    <option value="registered">登録順</option>
    <option value="inspection">車検が近い順</option>
    <option value="insurance">保険期限が近い順</option>
    <option value="office">営業所順</option>
  </select>
</div>
      <table className="w-full table-fixed border-collapse border">
       <colgroup>
  <col className="w-[11%]" />
  <col className="w-[18%]" />
  <col className="w-[12%]" />
  <col className="w-[11%]" />
  <col className="w-[13%]" />
  <col className="w-[13%]" />
  <col className="w-[22%]" />
</colgroup>
  <thead>
    <tr className="bg-gray-100">
      <th className="border p-2">営業所</th>
      <th className="border p-2">車番</th>
      <th className="border p-2">ドライバー名</th>
      <th className="border p-2">貸出状況</th>
      
      <th className="border p-2">車検</th>
      <th className="border p-2">保険期限</th>
      <th className="border p-2">操作</th>
    </tr>
  </thead>

  <tbody>
    {sortedVehicles.map((v) => {
      const vehicleStatus = v.status || "保管中";

      return (
        <tr
          key={v.id}
          className={
            vehicleStatus === "廃車"
              ? "bg-gray-300 text-gray-600"
              : ""
          }
        >
          <td className="border p-2 text-center">
  {v.office.replace("営業所", "")}
</td>
          <td className="border p-2">{v.number}</td>
          <td className="border p-2 text-center">
  {v.driver}
</td>

          <td className="border p-2 text-center">
            <span
              className={`inline-block rounded px-3 py-1 text-white font-bold ${
                vehicleStatus === "貸出中"
                  ? "bg-green-500"
                  : vehicleStatus === "保管中"
                    ? "bg-blue-500"
                    : "bg-gray-500"
              }`}
            >
              {vehicleStatus}
            </span>
          </td>

          <td
            className={`border p-2 text-center ${
              vehicleStatus === "廃車"
                ? ""
                : getDateColor(v.inspection)
            }`}
          >
            {v.inspection}
          </td>

          <td
            className={`border p-2 text-center ${
              vehicleStatus === "廃車"
                ? ""
                : getDateColor(v.insurance)
            }`}
          >
            {v.insurance}
          </td>

          <td className="border p-2">
            <div className="flex justify-center gap-2 whitespace-nowrap">
              <Link
                href={`/vehicles/${v.id}`}
                className="bg-blue-500 text-white rounded px-3 py-1"
              >
                詳細
              </Link>

              <Link
                href={`/vehicles/${v.id}/edit`}
                className="bg-yellow-400 text-black rounded px-3 py-1"
              >
                修正
              </Link>

              <button
                type="button"
                onClick={() => deleteVehicle(v.id)}
                className="bg-red-500 text-white rounded px-3 py-1"
              >
                削除
              </button>
            </div>
          </td>
        </tr>
      );
    })}
  </tbody>
</table>
</main>
  );
}