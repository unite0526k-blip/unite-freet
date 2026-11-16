
"use client";

import { useMemo, useState } from "react";

export type ShiftEntry = {
  date: string;
  office: string;
  course: string;
};

type Props = {
  driverName: string;
  mainOffice: string;
  month: string;
  entries: ShiftEntry[];
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export default function DriverCalendar({
  driverName,
  mainOffice,
  month,
  entries,
}: Props) {
  const [filter, setFilter] = useState<"all" | "main" | "sub">(
    "all"
  );

  const { days, summary } = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);

    if (
      !year ||
      !monthNumber ||
      monthNumber < 1 ||
      monthNumber > 12
    ) {
      return {
        days: [],
        summary: { main: 0, sub: 0, work: 0, off: 0 },
      };
    }

    const daysInMonth = new Date(year, monthNumber, 0).getDate();

    const monthEntries = entries.filter((entry) =>
      entry.date.startsWith(`${month}-`)
    );

    const byDate = new Map<string, ShiftEntry[]>();

    monthEntries.forEach((entry) => {
      const current = byDate.get(entry.date) ?? [];
      current.push(entry);
      byDate.set(entry.date, current);
    });

    const dates = Array.from(
      { length: daysInMonth },
      (_, index) => {
        const day = index + 1;
        const date = `${month}-${String(day).padStart(2, "0")}`;

        return {
          day,
          date,
          weekday: new Date(
            year,
            monthNumber - 1,
            day
          ).getDay(),
          shifts: byDate.get(date) ?? [],
        };
      }
    );

    const main = dates.filter((date) =>
      date.shifts.some((shift) => shift.office === mainOffice)
    ).length;

    const sub = dates.filter((date) =>
      date.shifts.some((shift) => shift.office !== mainOffice)
    ).length;

    const work = dates.filter(
      (date) => date.shifts.length > 0
    ).length;

    return {
      days: dates,
      summary: {
        main,
        sub,
        work,
        off: daysInMonth - work,
      },
    };
  }, [entries, mainOffice, month]);

  const firstWeekday = days[0]?.weekday ?? 0;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-white">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{driverName}</h3>
          <p className="text-sm text-slate-400">
            {month} ／ メイン営業所：{mainOffice}
          </p>
        </div>

        <select
          value={filter}
          onChange={(event) =>
            setFilter(
              event.target.value as "all" | "main" | "sub"
            )
          }
          className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
        >
          <option value="all">すべて表示</option>
          <option value="main">メインのみ</option>
          <option value="sub">サブのみ</option>
        </select>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "総出勤日数", value: summary.work },
          { label: "メイン", value: summary.main },
          { label: "サブ", value: summary.sub },
          { label: "休み", value: summary.off },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl bg-slate-800 p-3 text-center"
          >
            <p className="text-xs text-slate-400">
              {item.label}
            </p>
            <p className="mt-1 text-xl font-bold">
              {item.value}日
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday, index) => (
          <div
            key={weekday}
            className={`py-2 text-center text-xs font-bold ${
              index === 0
                ? "text-rose-400"
                : index === 6
                ? "text-sky-400"
                : "text-slate-300"
            }`}
          >
            {weekday}
          </div>
        ))}

        {Array.from(
          { length: firstWeekday },
          (_, index) => (
            <div key={`empty-${index}`} />
          )
        )}

        {days.map((date) => {
          const visibleShifts = date.shifts.filter(
            (shift) =>
              filter === "all" ||
              (filter === "main" &&
                shift.office === mainOffice) ||
              (filter === "sub" &&
                shift.office !== mainOffice)
          );

          const duplicate = date.shifts.length > 1;

          return (
            <div
              key={date.date}
              className={`min-h-24 rounded-lg border p-1.5 ${
                duplicate
                  ? "border-rose-500 bg-rose-500/10"
                  : date.shifts.length > 0
                  ? "border-cyan-500/30 bg-cyan-500/5"
                  : "border-white/10 bg-slate-800/50"
              }`}
            >
              <div
                className={`mb-1 text-xs font-semibold ${
                  date.weekday === 0
                    ? "text-rose-400"
                    : date.weekday === 6
                    ? "text-sky-400"
                    : "text-slate-200"
                }`}
              >
                {date.day}
              </div>

              {visibleShifts.length === 0 &&
                date.shifts.length === 0 && (
                  <span className="text-xs text-slate-500">
                    休
                  </span>
                )}

              {visibleShifts.map((shift, index) => (
                <div
                  key={`${shift.office}-${shift.course}-${index}`}
                  className={`mb-1 rounded px-1 py-1 text-[10px] leading-tight ${
                    shift.office === mainOffice
                      ? "bg-cyan-500/20 text-cyan-200"
                      : "bg-amber-500/20 text-amber-200"
                  }`}
                >
                  <div className="font-bold">
                    {shift.office}
                  </div>
                  <div className="break-words">
                    {shift.course}
                  </div>
                </div>
              ))}

              {duplicate && (
                <div className="text-[10px] font-bold text-rose-400">
                  重複注意
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        水色：メイン営業所 ／ 黄色：サブ営業所 ／
        赤枠：同日複数配置
      </p>
    </section>
  );
}
