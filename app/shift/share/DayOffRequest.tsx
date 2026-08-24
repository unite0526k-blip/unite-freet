"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase as maybeSupabase } from "../../../lib/supabase";

const supabase = maybeSupabase!;

type DriverOption = {
  driver_name: string;
  office: string;
};

type DayOffState = {
  success: boolean;
  message?: string;
  day_limit?: number;
  requested_dates?: string[];
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export default function DayOffRequest() {
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [driverName, setDriverName] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [targetMonth, setTargetMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [dayLimit, setDayLimit] = useState(4);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showPinChange, setShowPinChange] = useState(false);
const [newPinCode, setNewPinCode] = useState("");
const [confirmNewPinCode, setConfirmNewPinCode] = useState("");

  useEffect(() => {
    const loadDrivers = async () => {
      const { data, error } = await supabase.rpc(
        "get_shift_driver_options"
      );

      if (error) {
        setMessage(`ドライバー読込エラー：${error.message}`);
        return;
      }

      setDrivers((data ?? []) as DriverOption[]);
    };

    loadDrivers();
  }, []);

  useEffect(() => {
    setVerified(false);
    setSelectedDates([]);
    setMessage("");
  }, [driverName, targetMonth]);

  const offices = useMemo(() => {
    return Array.from(new Set(drivers.map((driver) => driver.office)));
  }, [drivers]);

  const calendarDays = useMemo(() => {
    const [year, month] = targetMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const firstWeekday = new Date(year, month - 1, 1).getDay();

    const blanks = Array.from(
      { length: firstWeekday },
      (_, index) => `blank-${index}`
    );

    const days = Array.from({ length: lastDay }, (_, index) => {
      const day = index + 1;

      return `${targetMonth}-${String(day).padStart(2, "0")}`;
    });

    return [...blanks, ...days];
  }, [targetMonth]);

  const verifyPin = async () => {
    if (!driverName) {
      setMessage("名前を選択してください。");
      return;
    }

    if (!/^\d{4}$/.test(pinCode)) {
      setMessage("PINは4桁の数字で入力してください。");
      return;
    }

    setBusy(true);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "get_shift_day_off_state",
      {
        p_driver_name: driverName,
        p_pin_code: pinCode,
        p_target_month: targetMonth,
      }
    );

    setBusy(false);

    if (error) {
      setMessage(`確認エラー：${error.message}`);
      return;
    }

    const result = data as DayOffState;

    if (!result.success) {
      setVerified(false);
      setMessage(result.message ?? "本人確認に失敗しました。");
      return;
    }

    setDayLimit(result.day_limit ?? 4);
    setSelectedDates(result.requested_dates ?? []);
    setVerified(true);
    setMessage("本人確認できました。希望日を選択してください。");
  };

  const toggleDate = (date: string) => {
    if (!verified || date.startsWith("blank-")) return;

    if (selectedDates.includes(date)) {
      setSelectedDates((current) =>
        current.filter((item) => item !== date)
      );
      return;
    }

    if (selectedDates.length >= dayLimit) {
      setMessage(`希望休はこの月は${dayLimit}日までです。`);
      return;
    }

    setSelectedDates((current) => [...current, date].sort());
    setMessage("");
  };

  const saveRequests = async () => {
    if (!verified) {
      setMessage("先にPINで本人確認してください。");
      return;
    }

    setBusy(true);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "save_shift_day_off_requests",
      {
        p_driver_name: driverName,
        p_pin_code: pinCode,
        p_target_month: targetMonth,
        p_requested_dates: selectedDates,
      }
    );

    setBusy(false);

    if (error) {
      setMessage(`登録エラー：${error.message}`);
      return;
    }

    const result = data as DayOffState;

    if (!result.success) {
      setMessage(result.message ?? "希望休を登録できませんでした。");
      return;
    }

    setMessage("希望休を登録しました。");
  };
  const changePin = async () => {
    if (!verified) {
      setMessage("先に現在のPINで本人確認してください。");
      return;
    }

    if (!/^\d{4}$/.test(newPinCode)) {
      setMessage("新しいPINは4桁の数字で入力してください。");
      return;
    }

    if (newPinCode !== confirmNewPinCode) {
      setMessage("新しいPINが一致していません。");
      return;
    }

    setBusy(true);
    setMessage("");

    const { error } = await supabase.rpc(
      "change_shift_driver_pin",
      {
        p_driver_name: driverName,
        p_current_pin: pinCode,
        p_new_pin: newPinCode,
      }
    );

    setBusy(false);

    if (error) {
      setMessage(`PIN変更エラー：${error.message}`);
      return;
    }

    setPinCode(newPinCode);
    setNewPinCode("");
    setConfirmNewPinCode("");
    setShowPinChange(false);
    setMessage("PINを変更しました。次回から新しいPINを使用してください。");
  };
  return (
    <section className="mx-auto mt-6 max-w-3xl rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold">希望休の申請</h2>

      <p className="mt-1 text-sm text-gray-600">
        名前と4桁PINで本人確認後、希望日を選択してください。
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-bold">対象月</label>

          <input
            type="month"
            value={targetMonth}
            onChange={(event) => setTargetMonth(event.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-3"
          />
        </div>

        <div>
          <label className="block text-sm font-bold">名前</label>

          <select
            value={driverName}
            onChange={(event) => setDriverName(event.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-3"
          >
            <option value="">選択してください</option>

            {offices.map((office) => (
              <optgroup key={office} label={office}>
                {drivers
                  .filter((driver) => driver.office === office)
                  .map((driver) => (
                    <option
                      key={driver.driver_name}
                      value={driver.driver_name}
                    >
                      {driver.driver_name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold">4桁PIN</label>

          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pinCode}
            onChange={(event) =>
              setPinCode(event.target.value.replace(/\D/g, ""))
            }
            placeholder="4桁"
            className="mt-1 w-full rounded-lg border px-3 py-3 text-center text-lg tracking-widest"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={verifyPin}
        disabled={busy}
        className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50"
      >
        {busy ? "確認中..." : "PINで本人確認"}
      </button>

      {message && (
        <p className="mt-4 rounded-lg bg-yellow-100 p-3 text-sm">
          {message}
        </p>
      )}

      {verified && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="font-bold">
              希望日を選択
            </p>

            <p className="text-sm font-bold text-blue-700">
              {selectedDates.length} / {dayLimit}日
            </p>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="py-2 text-xs font-bold text-gray-500"
              >
                {weekday}
              </div>
            ))}

            {calendarDays.map((date) => {
              if (date.startsWith("blank-")) {
                return <div key={date} />;
              }

              const selected = selectedDates.includes(date);
              const day = Number(date.slice(-2));
              const weekday = new Date(`${date}T00:00:00`).getDay();

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => toggleDate(date)}
                  className={`min-h-12 rounded-lg border text-sm font-bold ${
                    selected
                      ? "border-red-600 bg-red-600 text-white"
                      : weekday === 0
                        ? "bg-red-50 text-red-600"
                        : weekday === 6
                          ? "bg-blue-50 text-blue-600"
                          : "bg-white text-gray-800"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg bg-gray-50 p-3">
            <p className="text-sm font-bold">選択中の希望休</p>

            <p className="mt-1 text-sm text-gray-700">
              {selectedDates.length === 0
                ? "なし"
                : selectedDates.join("、")}
            </p>
          </div>

          <button
            type="button"
            onClick={saveRequests}
            disabled={busy}
            className="mt-4 w-full rounded-lg bg-green-600 px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {busy ? "登録中..." : "この内容で希望休を登録"}
          </button>
                    <div className="mt-6 border-t pt-5">
            <button
              type="button"
              onClick={() => setShowPinChange((current) => !current)}
              className="w-full rounded-lg border border-blue-600 px-4 py-3 font-bold text-blue-700"
            >
              {showPinChange ? "PIN変更を閉じる" : "自分のPINを変更する"}
            </button>

            {showPinChange && (
              <div className="mt-4 rounded-xl bg-blue-50 p-4">
                <p className="font-bold">新しい4桁PIN</p>

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPinCode}
                  onChange={(event) =>
                    setNewPinCode(
                      event.target.value.replace(/\D/g, "")
                    )
                  }
                  placeholder="新しいPIN"
                  className="mt-3 w-full rounded-lg border bg-white px-3 py-3 text-center text-lg tracking-widest"
                />

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmNewPinCode}
                  onChange={(event) =>
                    setConfirmNewPinCode(
                      event.target.value.replace(/\D/g, "")
                    )
                  }
                  placeholder="新しいPINをもう一度"
                  className="mt-3 w-full rounded-lg border bg-white px-3 py-3 text-center text-lg tracking-widest"
                />

                <button
                  type="button"
                  onClick={changePin}
                  disabled={busy}
                  className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50"
                >
                  {busy ? "変更中..." : "新しいPINへ変更"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}