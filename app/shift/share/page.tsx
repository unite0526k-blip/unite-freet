"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase as maybeSupabase } from "../../../lib/supabase";

const supabase = maybeSupabase!;

type OfficeName = "松阪営業所" | "伊勢営業所" | "伊賀営業所";
type ViewMode = "personal" | "all";

type Driver = {
  name: string;
  course?: string;
  fixedHoliday?: number;
};

type Region = "松阪" | "伊勢" | "伊賀";
type SavedCourse = {
  id: number;
  course: string;
  driver: string;
  status: "配車済" | "未配車" | "応援" | "休み";
};
type ShiftsByDate = Record<string, Record<Region, SavedCourse[]>>;

const normalizeName = (value: string) => value.replace(/[\s　]/g, "");
const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const OFFICE_DATA: Record<
  OfficeName,
  {
    courses: string[];
    drivers: Driver[];
  }
> = {
  松阪営業所: {
    courses: [
      "Aコース",
      "Bコース",
      "Cコース",
      "Dコース",
      "Eコース",
      "Fコース",
      "Gコース",
      "Hコース",
    ],
    drivers: [
      { name: "清水 國光" },
      { name: "横溝 一泰" },
      { name: "徳田 亮太" },
      { name: "楠滝 空杜" },
      { name: "福田 華月" },
      { name: "清水 光真" },
      { name: "中川 昭治", fixedHoliday: 4 },
      { name: "真田 拓海" },
      { name: "垣内 連" },
      { name: "伊藤 圭志" },
      { name: "牛袋 雄斗" },
      { name: "藤原 颯士" },
    ],
  },

  伊勢営業所: {
    courses: ["朝熊コース", "神久コース", "御薗コース", "高向コース"],
    drivers: [
      { name: "東 真規", course: "神久コース", fixedHoliday: 1 },
      { name: "勝村 武史" },
      { name: "西田 勇太" },
      { name: "藤原 颯士" },
      { name: "清水 國光" },
      { name: "清水 光真" },
      { name: "横溝 一泰" },
      { name: "楠滝 空杜" },
      { name: "中川 昭治" },
    ],
  },

  伊賀営業所: {
    courses: ["赤目コース"],
    drivers: [
      { name: "山崎　雅也" },
      { name: "辻本　顕寛" },
      { name: "小倉　祐司" },
      { name: "吉田　健人" },
    ],
  },
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function getAssignment(
  driver: Driver,
  date: Date,
  region: Region,
  shiftsByDate: ShiftsByDate,
) {
  const weekday = date.getDay();

  const savedCourses = shiftsByDate[dateKey(date)]?.[region] ?? [];
  const savedCourse = savedCourses.find(
    (course) =>
      course.driver &&
      normalizeName(course.driver) === normalizeName(driver.name),
  );

  if (savedCourse) return savedCourse.course;

  if (driver.fixedHoliday === weekday) {
    return "休み";
  }

  if (
    weekday === 1 &&
    (driver.course === "Eコース" || driver.course === "朝熊コース")
  ) {
    return "休み";
  }

  if (weekday === 0 && driver.course === "Fコース") {
    return "休み";
  }

  return "休み";
}

function getDayColor(weekday: number) {
  if (weekday === 0) return "text-red-600";
  if (weekday === 6) return "text-blue-600";
  return "text-slate-900";
}

export default function ShiftSharePage() {
  const [office, setOffice] = useState<OfficeName>("松阪営業所");
  const [month, setMonth] = useState("2026-08");
  const [driverName, setDriverName] = useState(
    OFFICE_DATA["松阪営業所"].drivers[0].name,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("personal");
  const [selectedDay, setSelectedDay] = useState(12);
  const [shiftsByDate, setShiftsByDate] = useState<ShiftsByDate>({});
  const [cloudLoading, setCloudLoading] = useState(true);
  const [cloudMessage, setCloudMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      setCloudLoading(true);
      setCloudMessage("");
      const { data: monthRow, error: monthError } = await supabase
        .from("shift_months")
        .select("id")
        .eq("month_key", month)
        .eq("status", "published")
        .maybeSingle();
      if (cancelled) return;
      if (monthError || !monthRow) {
        setShiftsByDate({});
        setCloudLoading(false);
        setCloudMessage(
          monthError
            ? "シフトを読み込めませんでした。"
            : `${month}はまだ公開されていません。`,
        );
        return;
      }
      const { data: assignments, error } = await supabase
        .from("shift_assignments")
        .select("work_date,area,course,driver_name,status")
        .eq("shift_month_id", monthRow.id)
        .order("work_date");
      if (cancelled) return;
      if (error) {
        setShiftsByDate({});
        setCloudMessage("シフトを読み込めませんでした。");
        setCloudLoading(false);
        return;
      }
      const loaded: ShiftsByDate = {};
      (assignments ?? []).forEach((row, index) => {
        const workDate = String(row.work_date);
        const region = row.area as Region;
        if (!loaded[workDate])
          loaded[workDate] = { 松阪: [], 伊勢: [], 伊賀: [] };
        loaded[workDate][region].push({
          id: index + 1,
          course: row.course,
          driver: row.driver_name ?? "",
          status: row.status,
        });
      });
      setShiftsByDate(loaded);
      setCloudLoading(false);
    };
    refresh();
    return () => {
      cancelled = true;
    };
  }, [month]);

  const [year, monthNumber] = month.split("-").map(Number);

  const officeData = OFFICE_DATA[office];
  const region = office.replace("営業所", "") as Region;

  const displayDrivers = useMemo(() => {
    const byName = new Map<string, Driver>();
    officeData.drivers.forEach((driver) =>
      byName.set(normalizeName(driver.name), driver),
    );
    Object.entries(shiftsByDate)
      .filter(([date]) => date.startsWith(`${month}-`))
      .forEach(([, regions]) => {
        (regions[region] ?? []).forEach((course) => {
          if (!course.driver) return;
          const key = normalizeName(course.driver);
          if (!byName.has(key)) byName.set(key, { name: course.driver });
        });
      });
    return Array.from(byName.values());
  }, [month, officeData.drivers, region, shiftsByDate]);

  const selectedDriver =
    displayDrivers.find(
      (driver) => normalizeName(driver.name) === normalizeName(driverName),
    ) ?? displayDrivers[0];

  const days = useMemo(() => {
    const lastDay = new Date(year, monthNumber, 0).getDate();

    return Array.from({ length: lastDay }, (_, index) => {
      const day = index + 1;
      const date = new Date(year, monthNumber - 1, day);

      return {
        day,
        date,
        weekday: date.getDay(),
      };
    });
  }, [year, monthNumber]);

  const personalSchedule = days.map((item) => ({
    ...item,
    assignment: getAssignment(selectedDriver, item.date, region, shiftsByDate),
  }));

  const workingDays = personalSchedule.filter(
    (item) => item.assignment !== "休み" && item.assignment !== "未配置",
  ).length;
  const holidays = personalSchedule.filter(
    (item) => item.assignment === "休み",
  ).length;

  const selectedDate = new Date(year, monthNumber - 1, selectedDay);

  const selectedDateCourses =
    shiftsByDate[dateKey(selectedDate)]?.[region] ?? [];
  const selectedCourseNames =
    selectedDateCourses.length > 0
      ? selectedDateCourses.map((course) => course.course)
      : officeData.courses;

  const dailyAssignments = selectedCourseNames.map((course) => {
    const savedCourse = selectedDateCourses.find(
      (item) => item.course === course,
    );

    return {
      course,
      driver: savedCourse?.driver || "未配置",
    };
  });

  const changeOffice = (value: OfficeName) => {
    setOffice(value);
    setDriverName(OFFICE_DATA[value].drivers[0].name);
  };

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-950 text-xl text-white">
              ▲
            </div>

            <div>
              <h1 className="text-2xl font-bold text-blue-950">UNITE Fleet</h1>
              <p className="text-sm text-slate-500">ドライバー共有シフト</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={office}
              onChange={(event) =>
                changeOffice(event.target.value as OfficeName)
              }
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-medium"
            >
              {Object.keys(OFFICE_DATA).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>

            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-medium"
            />
          </div>
        </header>

        {(cloudLoading || cloudMessage) && (
          <div
            className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${cloudMessage ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-700"}`}
          >
            {cloudLoading ? "公開シフトを読み込んでいます…" : cloudMessage}
          </div>
        )}

        <section className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-5 sm:p-7">
          <p className="font-semibold text-blue-600">{office}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={selectedDriver.name}
              onChange={(event) => setDriverName(event.target.value)}
              className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xl font-bold text-blue-950"
            >
              {displayDrivers.map((driver) => (
                <option key={driver.name} value={driver.name}>
                  {driver.name}
                </option>
              ))}
            </select>

            <h2 className="text-2xl font-bold text-blue-950">さんの予定</h2>
          </div>

          <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-blue-200 bg-white">
            <div className="p-5 text-center">
              <p className="font-bold text-blue-600">今月の稼働</p>
              <p className="mt-1 text-4xl font-bold text-blue-950">
                {workingDays}日
              </p>
            </div>

            <div className="border-l border-blue-200 p-5 text-center">
              <p className="font-bold text-purple-600">休み</p>
              <p className="mt-1 text-4xl font-bold text-purple-700">
                {holidays}日
              </p>
            </div>
          </div>
        </section>

        <div className="mt-6 grid grid-cols-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode("personal")}
            className={`border-b-4 px-4 py-4 text-lg font-bold ${
              viewMode === "personal"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500"
            }`}
          >
            自分の予定
          </button>

          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={`border-b-4 px-4 py-4 text-lg font-bold ${
              viewMode === "all"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500"
            }`}
          >
            全員の予定
          </button>
        </div>

        {viewMode === "personal" ? (
          <section className="mt-5 space-y-3">
            {personalSchedule.map((item) => {
              const isHoliday = item.assignment === "休み";
              const isUnassigned = item.assignment === "未配置";

              return (
                <details
                  key={item.day}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <summary className="grid cursor-pointer list-none grid-cols-[85px_1fr_auto] items-center gap-3 p-4">
                    <div
                      className={`text-center font-bold ${getDayColor(
                        item.weekday,
                      )}`}
                    >
                      <div>
                        {monthNumber}月{item.day}日
                      </div>
                      <div>（{WEEKDAYS[item.weekday]}）</div>
                    </div>

                    <div
                      className={`rounded-xl p-4 text-xl font-bold ${
                        isHoliday
                          ? "bg-purple-50 text-purple-700"
                          : isUnassigned
                            ? "bg-red-50 text-red-700"
                            : "bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      {item.assignment}
                    </div>

                    <span
                      className={`rounded-full px-3 py-2 text-sm font-bold ${
                        isHoliday
                          ? "bg-purple-100 text-purple-700"
                          : isUnassigned
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                      }`}
                    >
                      {isHoliday
                        ? "休み"
                        : item.assignment === "未配置"
                          ? "未配置"
                          : "配車"}{" "}
                    </span>
                  </summary>

                  <div className="border-t border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-bold text-blue-950">
                      この日の全コース配置
                    </h3>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {(shiftsByDate[dateKey(item.date)]?.[region]?.length
                        ? shiftsByDate[dateKey(item.date)][region].map(
                            (course) => course.course,
                          )
                        : officeData.courses
                      ).map((course) => {
                        const savedCourse = shiftsByDate[dateKey(item.date)]?.[
                          region
                        ]?.find((candidate) => candidate.course === course);

                        return (
                          <div
                            key={course}
                            className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                              savedCourse?.driver
                                ? "border-emerald-200 bg-emerald-50"
                                : "border-red-200 bg-red-50"
                            }`}
                          >
                            <span className="font-bold">{course}</span>
                            <span
                              className={
                                savedCourse?.driver
                                  ? "text-slate-700"
                                  : "font-bold text-red-600"
                              }
                            >
                              {savedCourse?.driver || "未配置"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </details>
              );
            })}
          </section>
        ) : (
          <section className="mt-6">
            <h2 className="text-2xl font-bold text-blue-950">全員のシフト表</h2>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[1150px] border-collapse bg-white">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-white p-3 text-left">
                      ドライバー
                    </th>

                    {days.map((item) => (
                      <th
                        key={item.day}
                        onClick={() => setSelectedDay(item.day)}
                        className={`cursor-pointer border-b border-r border-slate-200 p-2 text-center ${getDayColor(
                          item.weekday,
                        )}`}
                      >
                        <div>{item.day}</div>
                        <div className="text-xs">
                          （{WEEKDAYS[item.weekday]}）
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {displayDrivers.map((driver) => (
                    <tr key={driver.name}>
                      <th className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-slate-200 bg-white p-3 text-left">
                        {driver.name}
                      </th>

                      {days.map((item) => {
                        const assignment = getAssignment(
                          driver,
                          item.date,
                          region,
                          shiftsByDate,
                        );
                        const isHoliday = assignment === "休み";
                        const isUnassigned = assignment === "未配置";

                        return (
                          <td
                            key={item.day}
                            onClick={() => setSelectedDay(item.day)}
                            className={`cursor-pointer border-b border-r border-slate-200 p-2 text-center font-semibold ${
                              isHoliday
                                ? "bg-purple-50 text-purple-700"
                                : isUnassigned
                                  ? "bg-red-50 text-red-700"
                                  : "bg-emerald-50 text-emerald-800"
                            }`}
                          >
                            {isHoliday
                              ? "休"
                              : (assignment?.replace("コース", "") ??
                                "未配置")}{" "}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details
              open
              className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <summary className="cursor-pointer list-none p-5 text-xl font-bold text-blue-950">
                📅 {monthNumber}月{selectedDay}日の全コース配置
              </summary>

              <div className="border-t border-slate-200">
                {dailyAssignments.map((item) => (
                  <div
                    key={item.course}
                    className="grid grid-cols-[1fr_1.5fr] border-b border-slate-200 last:border-b-0"
                  >
                    <div className="p-4 text-center font-bold">
                      {item.course}
                    </div>

                    <div
                      className={`border-l border-slate-200 p-4 text-center ${
                        item.driver === "未配置"
                          ? "bg-red-50 font-bold text-red-600"
                          : "bg-emerald-50 font-semibold text-emerald-800"
                      }`}
                    >
                      {item.driver}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </section>
        )}

        <p className="mt-6 text-right text-xs text-slate-500">
          最終更新：2026年8月14日
        </p>
      </div>
    </main>
  );
}