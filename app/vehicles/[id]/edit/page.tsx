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
  伊勢営業所: [
    "東 真規",
    "勝村 武史",
    "藤原 颯士",
    "西田 勇太",
  ],
  鈴鹿営業所: ["仲村 賢一郎"],
  伊賀営業所: [
    "山崎 雅也",
    "辻本 顕寛",
    "小倉 祐司",
  ],
  浜松営業所: [
    "津嘉山 一君",
    "藤田 祥範",
    "レイネル セバスチャン",
  ],
  京都営業所: [],
};

type VehicleStatus =
  | "貸出中"
  | "代車貸出中"
  | "保管中"
  | "廃車";

type Vehicle = {
  id: number;
  office: string;
  number: string;
  driver: string;

  status: VehicleStatus;
  storageLocation: string;

  inspection: string;
  insurance: string;

  maker: string;
  model: string;
  chassisNumber: string;
  firstRegistration: string;
  userName: string;
  ownerName: string;

  // リース管理
  leaseStartDate?: string;
  monthlyLeaseFee?: number;
  leaseFeeOverrides?: Record<string, number>;
};

type TextField =
  | "office"
  | "number"
  | "driver"
  | "storageLocation"
  | "inspection"
  | "insurance"
  | "maker"
  | "model"
  | "chassisNumber"
  | "firstRegistration"
  | "userName"
  | "ownerName"
  | "leaseStartDate";

const STORAGE_KEY = "unite-fleet-vehicles";
const DEFAULT_LEASE_FEE = 33000;

export default function VehicleEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [vehicle, setVehicle] = useState<
    Vehicle | null | undefined
  >(undefined);

  const [currentMonthLeaseFee, setCurrentMonthLeaseFee] =
    useState<string>("33000");

  // =========================
  // 今月の年月キー
  // 例：2026-09
  // =========================

  const getCurrentMonthKey = () => {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(
      today.getMonth() + 1
    ).padStart(2, "0");

    return `${year}-${month}`;
  };

  const currentMonthKey = getCurrentMonthKey();

  const getCurrentMonthLabel = () => {
    const today = new Date();

    return `${today.getFullYear()}年${
      today.getMonth() + 1
    }月`;
  };

  const currentMonthLabel =
    getCurrentMonthLabel();

  // =========================
  // 車両データ読込
  // =========================

  useEffect(() => {
    const saved =
      localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      setVehicle(null);
      return;
    }

    try {
      const vehicles: Vehicle[] =
        JSON.parse(saved);

      const foundVehicle = vehicles.find(
        (item) =>
          String(item.id) ===
          String(params.id)
      );

      if (!foundVehicle) {
        setVehicle(null);
        return;
      }

      // 古い車両データでも動くように補完
      const normalizedVehicle: Vehicle = {
        ...foundVehicle,

        status:
          foundVehicle.status ||
          "保管中",

        leaseStartDate:
          foundVehicle.leaseStartDate ||
          "",

        monthlyLeaseFee:
          foundVehicle.monthlyLeaseFee ??
          DEFAULT_LEASE_FEE,

        leaseFeeOverrides:
          foundVehicle.leaseFeeOverrides ||
          {},
      };

      setVehicle(normalizedVehicle);

      // 今月だけ特別料金があるか確認
      const override =
        normalizedVehicle
          .leaseFeeOverrides?.[
          currentMonthKey
        ];

      if (typeof override === "number") {
        setCurrentMonthLeaseFee(
          String(override)
        );
      } else {
        setCurrentMonthLeaseFee(
          String(
            normalizedVehicle.monthlyLeaseFee ??
              DEFAULT_LEASE_FEE
          )
        );
      }
    } catch {
      setVehicle(null);
    }
  }, [params.id, currentMonthKey]);

  // =========================
  // 文字項目更新
  // =========================

  const updateText = (
    field: TextField,
    value: string
  ) => {
    if (!vehicle) return;

    setVehicle({
      ...vehicle,
      [field]: value,
    });
  };

  // =========================
  // 貸出状況変更
  // =========================

  const changeStatus = (
    status: VehicleStatus
  ) => {
    if (!vehicle) return;

    if (status === "貸出中") {
      setVehicle({
        ...vehicle,
        status,
        monthlyLeaseFee:
          vehicle.monthlyLeaseFee ??
          DEFAULT_LEASE_FEE,
        leaseFeeOverrides:
          vehicle.leaseFeeOverrides || {},
      });

      const override =
        vehicle.leaseFeeOverrides?.[
          currentMonthKey
        ];

      if (typeof override === "number") {
        setCurrentMonthLeaseFee(
          String(override)
        );
      } else {
        setCurrentMonthLeaseFee(
          String(
            vehicle.monthlyLeaseFee ??
              DEFAULT_LEASE_FEE
          )
        );
      }

      return;
    }

    if (status === "代車貸出中") {
      setVehicle({
        ...vehicle,
        status,
      });

      return;
    }

    setVehicle({
      ...vehicle,
      status,
    });
  };

  // =========================
  // 保存
  // =========================

  const saveVehicle = () => {
    if (!vehicle) return;

    if (
      !vehicle.office ||
      !vehicle.number
    ) {
      alert(
        "営業所と車番は必須です"
      );
      return;
    }

    let vehicleToSave: Vehicle = {
      ...vehicle,
    };

    // -------------------------
    // 貸出中の場合
    // -------------------------

    if (vehicle.status === "貸出中") {
      const normalFee =
        vehicle.monthlyLeaseFee ??
        DEFAULT_LEASE_FEE;

      const currentFee = Number(
        currentMonthLeaseFee
      );

      if (
        Number.isNaN(currentFee) ||
        currentFee < 0
      ) {
        alert(
          "今月リース料を正しく入力してください"
        );
        return;
      }

      const overrides = {
        ...(vehicle.leaseFeeOverrides ||
          {}),
      };

      // 通常料金と違う場合だけ
      // 今月の特別料金として保存
      if (currentFee !== normalFee) {
        overrides[currentMonthKey] =
          currentFee;
      } else {
        // 33,000円に戻した場合は
        // 今月の特別設定を削除
        delete overrides[
          currentMonthKey
        ];
      }

      vehicleToSave = {
        ...vehicle,
        monthlyLeaseFee: normalFee,
        leaseFeeOverrides: overrides,
      };
    }

    // -------------------------
    // 代車貸出中は売上0円
    // -------------------------

    if (
      vehicle.status ===
      "代車貸出中"
    ) {
      vehicleToSave = {
        ...vehicle,
      };
    }

    const saved =
      localStorage.getItem(STORAGE_KEY);

    const vehicles: Vehicle[] =
      saved ? JSON.parse(saved) : [];

    const updatedVehicles =
      vehicles.map((item) =>
        String(item.id) ===
        String(vehicle.id)
          ? vehicleToSave
          : item
      );

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        updatedVehicles
      )
    );

    alert(
      "修正内容を保存しました"
    );

    router.push(
      `/vehicles/${vehicle.id}`
    );
  };

  // =========================
  // 読み込み中
  // =========================

  if (vehicle === undefined) {
    return (
      <main className="p-6">
        読み込み中...
      </main>
    );
  }

  // =========================
  // 車両なし
  // =========================

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
      {/* タイトル */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            🟡 車両情報の修正
          </h1>

          <p className="mt-2 text-gray-600">
            車番：{vehicle.number}
          </p>
        </div>

        <Link
          href={`/vehicles/${vehicle.id}`}
          className="bg-gray-700 text-white rounded px-4 py-2"
        >
          詳細へ戻る
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        {/* 基本情報 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 営業所 */}
          <label>
            <span className="font-bold">
              営業所
            </span>

            <select
              className="mt-1 border rounded p-2 w-full"
              value={vehicle.office}
              onChange={(e) => {
                setVehicle({
                  ...vehicle,
                  office:
                    e.target.value,
                  driver: "",
                });
              }}
            >
              <option value="">
                営業所選択
              </option>

              {OFFICES.map(
                (office) => (
                  <option
                    key={office}
                    value={office}
                  >
                    {office}
                  </option>
                )
              )}
            </select>
          </label>

          {/* 車番 */}
          <label>
            <span className="font-bold">
              車番
            </span>

            <input
              className="mt-1 border rounded p-2 w-full"
              value={vehicle.number}
              onChange={(e) =>
                updateText(
                  "number",
                  e.target.value
                )
              }
            />
          </label>

          {/* ドライバー */}
          <label>
            <span className="font-bold">
              ドライバー名
            </span>

            <select
              className="mt-1 border rounded p-2 w-full"
              value={
                vehicle.driver || ""
              }
              onChange={(e) =>
                updateText(
                  "driver",
                  e.target.value
                )
              }
            >
              <option value="">
                担当者選択
              </option>

              {(
                DRIVERS_BY_OFFICE[
                  vehicle.office
                ] || []
              ).map((driver) => (
                <option
                  key={driver}
                  value={driver}
                >
                  {driver}
                </option>
              ))}
            </select>
          </label>

          {/* 貸出状況 */}
          <label>
            <span className="font-bold">
              貸出状況
            </span>

            <select
              className="mt-1 border rounded p-2 w-full"
              value={
                vehicle.status ||
                "保管中"
              }
              onChange={(e) =>
                changeStatus(
                  e.target
                    .value as VehicleStatus
                )
              }
            >
              <option value="貸出中">
                貸出中
              </option>

              <option value="代車貸出中">
                代車貸出中
              </option>

              <option value="保管中">
                保管中
              </option>

              <option value="廃車">
                廃車
              </option>
            </select>
          </label>
        </div>

        {/* =========================
            リース設定
        ========================= */}

        {vehicle.status ===
          "貸出中" && (
          <div className="mt-6 rounded-xl border-2 border-green-200 bg-green-50 p-5">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-green-800">
                💰 リース設定
              </h2>

              <p className="mt-1 text-sm text-green-700">
                通常は月額33,000円です。
                初月の日割りなどがある場合だけ
                「今月リース料」を変更してください。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 貸出開始日 */}
              <label>
                <span className="font-bold">
                  貸出開始日
                </span>

                <input
                  type="date"
                  className="mt-1 border rounded p-2 w-full bg-white"
                  value={
                    vehicle.leaseStartDate ||
                    ""
                  }
                  onChange={(e) =>
                    updateText(
                      "leaseStartDate",
                      e.target.value
                    )
                  }
                />
              </label>

              {/* 通常月額 */}
              <label>
                <span className="font-bold">
                  通常月額リース料
                </span>

                <div className="mt-1 flex items-center">
                  <input
                    type="text"
                    readOnly
                    className="border rounded p-2 w-full bg-gray-100 font-bold"
                    value={`¥${(
                      vehicle.monthlyLeaseFee ??
                      DEFAULT_LEASE_FEE
                    ).toLocaleString()}`}
                  />
                </div>

                <p className="mt-1 text-xs text-gray-500">
                  翌月以降は原則この金額になります
                </p>
              </label>

              {/* 今月リース */}
              <label className="md:col-span-2">
                <span className="font-bold">
                  {currentMonthLabel}
                  のリース料
                </span>

                <div className="mt-1 flex items-center gap-2">
                  <span className="text-lg font-bold">
                    ¥
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="border-2 border-green-400 rounded p-3 w-full text-lg font-bold bg-white"
                    value={
                      currentMonthLeaseFee
                    }
                    onChange={(e) =>
                      setCurrentMonthLeaseFee(
                        e.target.value
                      )
                    }
                  />
                </div>

                <p className="mt-2 text-sm text-gray-600">
                  例：月途中から貸し出した場合は、
                  ここだけ日割り金額に変更できます。
                  翌月は通常月額に戻ります。
                </p>
              </label>
            </div>
          </div>
        )}

        {/* 代車 */}
        {vehicle.status ===
          "代車貸出中" && (
          <div className="mt-6 rounded-xl border-2 border-orange-200 bg-orange-50 p-5">
            <h2 className="text-xl font-bold text-orange-800">
              🚗 代車貸出中
            </h2>

            <p className="mt-2 font-semibold text-orange-700">
              この車両は代車扱いのため、
              リース売上は0円です。
            </p>
          </div>
        )}

        {/* その他の車両情報 */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 保管場所 */}
          <label>
            <span className="font-bold">
              保管場所
            </span>

            <input
              className="mt-1 border rounded p-2 w-full"
              value={
                vehicle.storageLocation ||
                ""
              }
              onChange={(e) =>
                updateText(
                  "storageLocation",
                  e.target.value
                )
              }
            />
          </label>

          {/* メーカー */}
          <label>
            <span className="font-bold">
              メーカー
            </span>

            <input
              className="mt-1 border rounded p-2 w-full"
              value={
                vehicle.maker || ""
              }
              onChange={(e) =>
                updateText(
                  "maker",
                  e.target.value
                )
              }
            />
          </label>

          {/* 車種 */}
          <label>
            <span className="font-bold">
              車種
            </span>

            <input
              className="mt-1 border rounded p-2 w-full"
              value={
                vehicle.model || ""
              }
              onChange={(e) =>
                updateText(
                  "model",
                  e.target.value
                )
              }
            />
          </label>

          {/* 車台番号 */}
          <label>
            <span className="font-bold">
              車台番号
            </span>

            <input
              className="mt-1 border rounded p-2 w-full"
              value={
                vehicle.chassisNumber ||
                ""
              }
              onChange={(e) =>
                updateText(
                  "chassisNumber",
                  e.target.value
                )
              }
            />
          </label>

          {/* 初度登録年月 */}
          <label>
            <span className="font-bold">
              初度登録年月
            </span>

            <input
              className="mt-1 border rounded p-2 w-full"
              value={
                vehicle.firstRegistration ||
                ""
              }
              onChange={(e) =>
                updateText(
                  "firstRegistration",
                  e.target.value
                )
              }
            />
          </label>

          {/* 使用者名 */}
          <label>
            <span className="font-bold">
              使用者名
            </span>

            <input
              className="mt-1 border rounded p-2 w-full"
              value={
                vehicle.userName || ""
              }
              onChange={(e) =>
                updateText(
                  "userName",
                  e.target.value
                )
              }
            />
          </label>

          {/* 所有者名 */}
          <label>
            <span className="font-bold">
              所有者名
            </span>

            <input
              className="mt-1 border rounded p-2 w-full"
              value={
                vehicle.ownerName || ""
              }
              onChange={(e) =>
                updateText(
                  "ownerName",
                  e.target.value
                )
              }
            />
          </label>

          {/* 車検期限 */}
          <label>
            <span className="font-bold">
              車検期限
            </span>

            <input
              type="date"
              className="mt-1 border rounded p-2 w-full"
              value={
                vehicle.inspection ||
                ""
              }
              onChange={(e) =>
                updateText(
                  "inspection",
                  e.target.value
                )
              }
            />
          </label>

          {/* 保険期限 */}
          <label>
            <span className="font-bold">
              保険期限
            </span>

            <input
              type="date"
              className="mt-1 border rounded p-2 w-full"
              value={
                vehicle.insurance ||
                ""
              }
              onChange={(e) =>
                updateText(
                  "insurance",
                  e.target.value
                )
              }
            />
          </label>
        </div>

        {/* 保存 */}
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