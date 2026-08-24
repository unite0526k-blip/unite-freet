"use client";

import { useEffect, useState } from "react";
import { supabase as maybeSupabase } from "../../lib/supabase";

const supabase = maybeSupabase!;

type DriverSetting = {
  id: string;
  driver_name: string;
  office: string;
  pin_code: string;
  fixed_days_off: string[];
  available_courses: string[];
  auto_assign: boolean;
};

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

const OFFICE_COURSES: Record<string, string[]> = {
  松阪営業所: ["A", "B", "C", "D", "E", "F", "G", "H"],
  伊勢営業所: ["神久", "朝熊", "御薗", "高向"],
  鈴鹿営業所: [],
  伊賀営業所: [],
  浜松営業所: [],
  京都営業所: [],
};

export default function SettingsPage() {
  const [drivers, setDrivers] = useState<DriverSetting[]>([]);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [targetMonth, setTargetMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [loading, setLoading] = useState(true);
  const [selectedOffice, setSelectedOffice] = useState("松阪営業所");
  const [message, setMessage] = useState("");

  const loadSettings = async () => {
    setLoading(true);
    setMessage("");

    const [driverResult, limitResult] = await Promise.all([
      supabase
        .from("shift_driver_settings")
        .select("*")
        .order("office")
        .order("driver_name"),

      supabase
        .from("shift_monthly_limits")
        .select("driver_name, day_limit")
        .eq("target_month", targetMonth),
    ]);

    if (driverResult.error) {
      setMessage(`読込エラー：${driverResult.error.message}`);
      setLoading(false);
      return;
    }

    const monthlyLimits: Record<string, number> = {};

    for (const item of limitResult.data ?? []) {
      monthlyLimits[item.driver_name] = item.day_limit;
    }

    setDrivers((driverResult.data ?? []) as DriverSetting[]);
    setLimits(monthlyLimits);
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, [targetMonth]);

  const updateDriver = (
    id: string,
    changes: Partial<DriverSetting>
  ) => {
    setDrivers((current) =>
      current.map((driver) =>
        driver.id === id ? { ...driver, ...changes } : driver
      )
    );
  };

  const toggleFixedDay = (driver: DriverSetting, day: string) => {
    const current = driver.fixed_days_off ?? [];
    const next = current.includes(day)
      ? current.filter((item) => item !== day)
      : [...current, day];

    updateDriver(driver.id, { fixed_days_off: next });
  };

  const toggleCourse = (driver: DriverSetting, course: string) => {
    const current = driver.available_courses ?? [];
    const next = current.includes(course)
      ? current.filter((item) => item !== course)
      : [...current, course];

    updateDriver(driver.id, { available_courses: next });
  };

  const saveDriver = async (driver: DriverSetting) => {
    setMessage("");

    if (!/^\d{4}$/.test(driver.pin_code)) {
      setMessage(`${driver.driver_name}のPINは4桁の数字にしてください。`);
      return;
    }

    const { error } = await supabase
      .from("shift_driver_settings")
      .update({
        driver_name: driver.driver_name,
office: driver.office,
        pin_code: driver.pin_code,
        fixed_days_off: driver.fixed_days_off ?? [],
        available_courses: driver.available_courses ?? [],
        auto_assign: driver.auto_assign,
        updated_at: new Date().toISOString(),
      })
      .eq("id", driver.id);

    if (error) {
      setMessage(`保存エラー：${error.message}`);
      return;
    }

    const dayLimit = limits[driver.driver_name] ?? 4;

    const { error: limitError } = await supabase
      .from("shift_monthly_limits")
      .upsert(
        {
          driver_name: driver.driver_name,
          target_month: targetMonth,
          day_limit: dayLimit,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "driver_name,target_month",
        }
      );

    if (limitError) {
      setMessage(`上限保存エラー：${limitError.message}`);
      return;
    }

    setMessage(`${driver.driver_name}の設定を保存しました。`);
  };
  const addDriver = async () => {
  const driverName = window.prompt("追加するドライバー名を入力してください。");

  if (!driverName?.trim()) return;

  const { error } = await supabase
    .from("shift_driver_settings")
    .insert({
      driver_name: driverName.trim(),
      office: selectedOffice,
      pin_code: "0000",
      fixed_days_off: [],
      available_courses: [],
      auto_assign: true,
    });

  if (error) {
    setMessage(`追加エラー：${error.message}`);
    return;
  }

  setMessage(`${driverName.trim()}を追加しました。仮PINは0000です。`);
  await loadSettings();
};

const deleteDriver = async (driver: DriverSetting) => {
  const confirmed = window.confirm(
    `${driver.driver_name}を削除しますか？\n希望休などの設定も削除されます。`
  );

  if (!confirmed) return;

  const [requestResult, limitResult, driverResult] = await Promise.all([
    supabase
      .from("shift_day_off_requests")
      .delete()
      .eq("driver_name", driver.driver_name),

    supabase
      .from("shift_monthly_limits")
      .delete()
      .eq("driver_name", driver.driver_name),

    supabase
      .from("shift_driver_settings")
      .delete()
      .eq("id", driver.id),
  ]);

  const error =
    requestResult.error ||
    limitResult.error ||
    driverResult.error;

  if (error) {
    setMessage(`削除エラー：${error.message}`);
    return;
  }

  setMessage(`${driver.driver_name}を削除しました。`);
  await loadSettings();
};

  if (loading) {
    return <p className="p-6">設定を読み込み中...</p>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">シフト設定</h1>

        <p className="mt-2 text-sm text-gray-600">
          PIN・希望休上限・固定休・担当可能コース・自動振り分けを設定します。
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="font-bold">対象月</label>

          <input
            type="month"
            value={targetMonth}
            onChange={(event) => setTargetMonth(event.target.value)}
            className="rounded border px-3 py-2"
          />

          <span className="rounded bg-blue-100 px-3 py-2 text-sm text-blue-800">
            希望休の基本上限：月4日
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
  {[
    "松阪営業所",
    "伊勢営業所",
    "鈴鹿営業所",
    "伊賀営業所",
    "浜松営業所",
    "京都営業所",
  ].map((office) => (
    <button
      key={office}
      type="button"
      onClick={() => setSelectedOffice(office)}
      className={`rounded px-4 py-2 font-bold ${
        selectedOffice === office
          ? "bg-blue-600 text-white"
          : "border bg-white text-gray-700"
      }`}
    >
      {office}
    </button>
  ))}
</div>
<button
  type="button"
  onClick={addDriver}
  className="mt-4 rounded bg-green-600 px-5 py-2 font-bold text-white"
>
  ＋ {selectedOffice}にドライバー追加
</button>
        {message && (
          <p className="mt-4 rounded bg-yellow-100 p-3 text-sm">
            {message}
          </p>
        )}
      </div>

      <div className="space-y-4">
{drivers
  .filter((driver) => driver.office === selectedOffice)
  .map((driver) => {          const courses = OFFICE_COURSES[driver.office] ?? [];

          return (
            <section
              key={driver.id}
              className="rounded-xl bg-white p-5 shadow"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-3">
  <div>
    <label className="block text-xs font-bold text-gray-500">
      ドライバー名
    </label>

    <input
      type="text"
      value={driver.driver_name}
      onChange={(event) =>
        updateDriver(driver.id, {
          driver_name: event.target.value,
        })
      }
      className="mt-1 rounded border px-3 py-2 font-bold"
    />
  </div>

  <div>
    <label className="block text-xs font-bold text-gray-500">
      所属営業所
    </label>

    <select
      value={driver.office}
      onChange={(event) =>
        updateDriver(driver.id, {
          office: event.target.value,
          available_courses: [],
        })
      }
      className="mt-1 rounded border px-3 py-2"
    >
      <option value="松阪営業所">松阪営業所</option>
      <option value="伊勢営業所">伊勢営業所</option>
      <option value="鈴鹿営業所">鈴鹿営業所</option>
      <option value="伊賀営業所">伊賀営業所</option>
      <option value="浜松営業所">浜松営業所</option>
      <option value="京都営業所">京都営業所</option>
      <option value="営業所なし">営業所なし</option>
    </select>
  </div>
</div>

<div className="flex gap-2">
  <button
    type="button"
    onClick={() => saveDriver(driver)}
    className="rounded bg-blue-600 px-5 py-2 font-bold text-white"
  >
    保存
  </button>

  <button
    type="button"
    onClick={() => deleteDriver(driver)}
    className="rounded bg-red-600 px-5 py-2 font-bold text-white"
  >
    削除
  </button>
</div>              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-bold">
                    4桁PIN
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={driver.pin_code}
                    onChange={(event) =>
                      updateDriver(driver.id, {
                        pin_code: event.target.value.replace(/\D/g, ""),
                      })
                    }
                    className="mt-2 w-32 rounded border px-3 py-2 text-center text-lg tracking-widest"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold">
                    {targetMonth}の希望休上限
                  </label>

                  <input
                    type="number"
                    min={0}
                    max={31}
                    value={limits[driver.driver_name] ?? 4}
                    onChange={(event) =>
                      setLimits((current) => ({
                        ...current,
                        [driver.driver_name]: Number(event.target.value),
                      }))
                    }
                    className="mt-2 w-24 rounded border px-3 py-2 text-center"
                  />

                  <span className="ml-2 text-sm text-gray-500">日</span>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-sm font-bold">固定休</p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => {
                    const selected =
                      driver.fixed_days_off?.includes(day);

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleFixedDay(driver, day)}
                        className={`rounded border px-4 py-2 ${
                          selected
                            ? "border-red-600 bg-red-600 text-white"
                            : "bg-white text-gray-700"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5">
                <p className="text-sm font-bold">担当可能コース</p>

                {courses.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">
                    この営業所のコースは後から設定できます。
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {courses.map((course) => {
                      const selected =
                        driver.available_courses?.includes(course);

                      return (
                        <button
                          key={course}
                          type="button"
                          onClick={() => toggleCourse(driver, course)}
                          className={`rounded border px-4 py-2 ${
                            selected
                              ? "border-green-600 bg-green-600 text-white"
                              : "bg-white text-gray-700"
                          }`}
                        >
                          {course}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <label className="mt-5 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={driver.auto_assign}
                  onChange={(event) =>
                    updateDriver(driver.id, {
                      auto_assign: event.target.checked,
                    })
                  }
                  className="h-5 w-5"
                />

                <span className="font-bold">
                  自動振り分けの対象にする
                </span>
              </label>
            </section>
          );
        })}
      </div>
    </div>
  );
}