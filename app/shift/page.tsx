"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { loadData, saveData } from "../../lib/storage";
import { supabase as maybeSupabase } from "../../lib/supabase";

const supabase = maybeSupabase!;

type Region = "松阪" | "伊勢" | "伊賀";
type CourseStatus = "配車済" | "未配車" | "応援" | "休み";

type Course = {
  id: number;
  course: string;
  driver: string;
  vehicle: string;
  client: string;
  start: string;
  end: string;
  count: string;
  status: CourseStatus;
  memo: string;
  isLocked: boolean;
};

type DriverItem = {
  id: number;
  name: string;
  area: string;
  status: "待機" | "稼働";
  mainArea?: string;
  supportedCourses?: string[];
  fixedCourse?: string;
  assignmentMode?: "通常" | "応援のみ" | "最終候補" | "自動除外";
};

type StoredDriver = {
  id: number;
  name: string;
  office: string;
  subOffice?: string;
  subOffices?: string[];
  status: string;
  supportedCourses?: string[];
  fixedCourse?: string;
  assignmentMode?: "通常" | "応援のみ" | "最終候補" | "自動除外";
};

const sidebarItems = [
  { label: "ダッシュボード", href: "/dashboard" },
  { label: "ドライバー", href: "/drivers" },
  { label: "車両", href: "/vehicles" },
  { label: "配達", href: "/shift" },
  { label: "シフト", href: "/shift" },
  { label: "売上", href: "/shift" },
  { label: "KPI", href: "/shift" },
  { label: "サポート", href: "/shift" },
  { label: "クレーム", href: "/shift" },
  { label: "設定", href: "/shift" },
];

type ShiftsByDate = Record<string, Record<Region, Course[]>>;
type RequestedDaysOff = Record<string, string>;
type FixedDaysOff = Record<string, number[]>;

type CourseSetting = {
  id: string;
  region: Region;
  name: string;
  closedWeekdays: number[];
  fixedDriver: string;
};

const createCourse = (id: number, course: string): Course => ({
  id,
  course,
  driver: "",
  vehicle: "",
  client: "",
  start: "",
  end: "",
  count: "",
  status: "未配車",
  memo: "",
  isLocked: false,
});

const NORMAL_COURSE_NAMES: Record<Region, string[]> = {
  松阪: [
    "Aコース",
    "Bコース",
    "Cコース",
    "Dコース",
    "Eコース",
    "Fコース",
    "Gコース",
    "Hコース",
  ],
  伊勢: ["朝熊コース", "神久コース", "御薗コース", "高向コース"],
  伊賀: ["赤目コース"],
};

const DEFAULT_COURSE_SETTINGS: CourseSetting[] = (
  Object.keys(NORMAL_COURSE_NAMES) as Region[]
).flatMap((region) =>
  NORMAL_COURSE_NAMES[region].map((name) => ({
    id: `${region}-${name}`,
    region,
    name,
    closedWeekdays:
      region === "松阪" && name === "Eコース"
        ? [1]
        : region === "松阪" && name === "Fコース"
          ? [0]
          : region === "伊勢" && name === "朝熊コース"
            ? [1]
            : [],
    fixedDriver:
      region === "松阪" && name === "Hコース"
        ? "中川 昭治"
        : region === "伊勢" && name === "神久コース"
          ? "東 真規"
          : "",
  })),
);

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const createCoursesFromSettings = (
  dateValue: string,
  settings: CourseSetting[],
): Record<Region, Course[]> => {
  const weekday = new Date(`${dateValue}T00:00:00`).getDay();
  const result = { 松阪: [], 伊勢: [], 伊賀: [] } as Record<Region, Course[]>;
  settings
    .filter((setting) => !setting.closedWeekdays.includes(weekday))
    .forEach((setting, index) => {
      result[setting.region].push(
        createCourse(Date.now() + index, setting.name),
      );
    });
  return result;
};

const getCourseNamesForDate = (
  dateValue: string,
  region: Region,
  preset: "normal" | "weekday",
) => {
  if (preset === "normal") return NORMAL_COURSE_NAMES[region];

  const weekday = new Date(`${dateValue}T00:00:00`).getDay();

  if (weekday === 0 && region === "松阪") {
    return [
      "ABコース",
      "BCコース",
      "CDコース",
      "Eコース",
      "Gコース",
      "Hコース",
    ];
  }
  if (weekday === 1 && region === "松阪") {
    return ["ABコース", "CDコース", "Fコース", "Gコース", "Hコース"];
  }
  if (weekday === 1 && region === "伊勢") {
    return ["神久コース", "御薗コース", "高向コース"];
  }

  return NORMAL_COURSE_NAMES[region];
};

const createCoursesForDate = (
  dateValue: string,
  preset: "normal" | "weekday" = "weekday",
): Record<Region, Course[]> => ({
  松阪: getCourseNamesForDate(dateValue, "松阪", preset).map((name, index) =>
    createCourse(100 + index, name),
  ),
  伊勢: getCourseNamesForDate(dateValue, "伊勢", preset).map((name, index) =>
    createCourse(200 + index, name),
  ),
  伊賀: getCourseNamesForDate(dateValue, "伊賀", preset).map((name, index) =>
    createCourse(300 + index, name),
  ),
});

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const initialStandbyDrivers: DriverItem[] = [
  { id: 101, name: "清水 國光", area: "松阪", status: "待機" },
  { id: 102, name: "清水 光真", area: "松阪", status: "待機" },
  { id: 103, name: "徳田 亮太", area: "松阪", status: "待機" },
  { id: 104, name: "横溝 一泰", area: "松阪", status: "待機" },
  { id: 105, name: "中川 昭治", area: "松阪", status: "待機" },
  { id: 106, name: "楠滝 空杜", area: "松阪", status: "待機" },
  { id: 107, name: "真田 拓海", area: "松阪", status: "待機" },
  { id: 108, name: "齋藤 朋樹", area: "松阪", status: "待機" },
  { id: 109, name: "福田 華月", area: "松阪", status: "待機" },
  { id: 110, name: "垣内 連", area: "松阪", status: "待機" },
  { id: 111, name: "伊藤 圭志", area: "松阪", status: "待機" },
  { id: 112, name: "藤原 颯士", area: "松阪", status: "待機" },
  { id: 201, name: "東 真規", area: "伊勢", status: "待機" },
  { id: 202, name: "勝村 武史", area: "伊勢", status: "待機" },
  { id: 203, name: "藤原 颯士", area: "伊勢", status: "待機" },
  { id: 204, name: "西田 勇太", area: "伊勢", status: "待機" },
  { id: 205, name: "清水 國光", area: "伊勢", status: "待機" },
  { id: 206, name: "清水 光真", area: "伊勢", status: "待機" },
  { id: 207, name: "横溝 一泰", area: "伊勢", status: "待機" },
  { id: 208, name: "中川 昭治", area: "伊勢", status: "待機" },
  { id: 209, name: "楠滝 空杜", area: "伊勢", status: "待機" },
  { id: 301, name: "山崎 雅也", area: "伊賀", status: "待機" },
  { id: 302, name: "辻本 顕寛", area: "伊賀", status: "待機" },
  { id: 303, name: "小倉 祐司", area: "伊賀", status: "待機" },
];

const statusStyles: Record<CourseStatus, string> = {
  配車済: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30",
  未配車: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30",
  応援: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30",
  休み: "bg-slate-500/15 text-slate-300 ring-1 ring-slate-400/30",
};

export default function ShiftPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [cloudMessage, setCloudMessage] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [monthStatus, setMonthStatus] = useState<"draft" | "published">(
    "draft",
  );
  const [localDataReady, setLocalDataReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Region>("松阪");
  const [selectedDate, setSelectedDate] = useState(() =>
    formatDateKey(new Date()),
  );
  const [autoMonth, setAutoMonth] = useState(() =>
    formatDateKey(new Date()).slice(0, 7),
  );
  const [requestedDaysOff, setRequestedDaysOff] = useState<RequestedDaysOff>(
    {},
  );
  const [fixedDaysOff, setFixedDaysOff] = useState<FixedDaysOff>({});
  const [autoMessage, setAutoMessage] = useState("");
  const [shiftsByDate, setShiftsByDate] = useState<ShiftsByDate>({});
  const [courseSettings, setCourseSettings] = useState<CourseSetting[]>(
    DEFAULT_COURSE_SETTINGS,
  );
  const [newCourseName, setNewCourseName] = useState("");

  const defaultCoursesForDate = useMemo(
    () => createCoursesFromSettings(selectedDate, courseSettings),
    [selectedDate, courseSettings],
  );
  const coursesByRegion = shiftsByDate[selectedDate] ?? defaultCoursesForDate;

  const setCoursesByRegion = (
    update: (previous: Record<Region, Course[]>) => Record<Region, Course[]>,
  ) => {
    setShiftsByDate((previous) => ({
      ...previous,
      [selectedDate]: update(previous[selectedDate] ?? defaultCoursesForDate),
    }));
  };

  const [standbyDrivers, setStandbyDrivers] = useState<DriverItem[]>(
    initialStandbyDrivers,
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const loadMaster = async () => {
      const { data } = await supabase
        .from("fleet_master")
        .select("offices,drivers,course_settings,fixed_days_off")
        .eq("id", "default")
        .maybeSingle();
      if (!data) return;
      const cloudDrivers = data.drivers as StoredDriver[];
      const cloudCourses = data.course_settings as CourseSetting[];
      const cloudOffices = data.offices as string[];
      const cloudFixedDaysOff = data.fixed_days_off as FixedDaysOff;
      if (cloudCourses?.length) {
        setCourseSettings(cloudCourses);
        saveData("unite-fleet-course-settings", cloudCourses);
      }
      if (cloudOffices?.length) saveData("unite-fleet-offices", cloudOffices);
      if (cloudFixedDaysOff) {
        setFixedDaysOff(cloudFixedDaysOff);
        saveData("unite-fleet-fixed-days-off", cloudFixedDaysOff);
      }
      if (cloudDrivers?.length) {
        saveData("unite-fleet-drivers", cloudDrivers);
        setStandbyDrivers(
          cloudDrivers.flatMap((driver) => {
            const offices = [
              driver.office,
              ...(driver.subOffices ?? []),
              driver.subOffice,
            ]
              .filter((office): office is string => Boolean(office))
              .filter((office, index, all) => all.indexOf(office) === index);
            return offices.map((office, index) => ({
              id: driver.id * 10 + index,
              name: driver.name,
              area: office,
              status: "待機" as const,
              mainArea: driver.office.replace("営業所", ""),
              supportedCourses: driver.supportedCourses ?? [],
              fixedCourse: driver.fixedCourse ?? "",
              assignmentMode: driver.assignmentMode ?? "通常",
            }));
          }),
        );
      }
    };
    void loadMaster();
  }, [session]);

  const saveMasterSettings = async () => {
    if (!session) return setCloudMessage("先に管理者ログインしてください。");
    const localDrivers = loadData<StoredDriver[]>("unite-fleet-drivers", []);
    const localOffices = loadData<string[]>("unite-fleet-offices", []);
    const { error } = await supabase.from("fleet_master").upsert({
      id: "default",
      offices: localOffices,
      drivers: localDrivers,
      course_settings: courseSettings,
      fixed_days_off: fixedDaysOff,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    });
    setCloudMessage(
      error
        ? `設定保存エラー：${error.message}`
        : "コース設定をクラウド保存しました。",
    );
  };

  useEffect(() => {
    setRequestedDaysOff(
      loadData<RequestedDaysOff>("unite-fleet-requested-days-off", {}),
    );
    setFixedDaysOff(loadData<FixedDaysOff>("unite-fleet-fixed-days-off", {}));
    setShiftsByDate(loadData<ShiftsByDate>("unite-fleet-shifts-by-date", {}));
    const savedCourseSettings = loadData<CourseSetting[]>(
      "unite-fleet-course-settings",
      DEFAULT_COURSE_SETTINGS,
    );
    const settingsVersion = loadData<number>(
      "unite-fleet-course-settings-version",
      0,
    );
    setCourseSettings(
      settingsVersion < 2
        ? savedCourseSettings.map((setting) => {
            if (setting.region === "松阪" && setting.name === "Eコース") {
              return { ...setting, closedWeekdays: [1] };
            }
            if (setting.region === "松阪" && setting.name === "Fコース") {
              return { ...setting, closedWeekdays: [0] };
            }
            return setting;
          })
        : savedCourseSettings,
    );
    if (settingsVersion < 2) {
      saveData("unite-fleet-course-settings-version", 2);
    }
    setLocalDataReady(true);
  }, []);

  useEffect(() => {
    if (!localDataReady) return;
    saveData("unite-fleet-shifts-by-date", shiftsByDate);
  }, [localDataReady, shiftsByDate]);

  useEffect(() => {
    if (!localDataReady) return;
    saveData("unite-fleet-requested-days-off", requestedDaysOff);
  }, [localDataReady, requestedDaysOff]);

  useEffect(() => {
    if (!localDataReady) return;
    saveData("unite-fleet-fixed-days-off", fixedDaysOff);
  }, [fixedDaysOff, localDataReady]);

  useEffect(() => {
    if (!localDataReady) return;
    saveData("unite-fleet-course-settings", courseSettings);
  }, [courseSettings, localDataReady]);

  const updateCourseSetting = (id: string, patch: Partial<CourseSetting>) => {
    setCourseSettings((previous) =>
      previous.map((setting) =>
        setting.id === id ? { ...setting, ...patch } : setting,
      ),
    );
  };

  const addCourseSetting = () => {
    const name = newCourseName.trim();
    if (!name) return alert("コース名を入力してください");
    if (
      courseSettings.some(
        (setting) => setting.region === activeTab && setting.name === name,
      )
    ) {
      return alert("同じコース名がすでにあります");
    }
    setCourseSettings((previous) => [
      ...previous,
      {
        id: `${activeTab}-${Date.now()}`,
        region: activeTab,
        name,
        closedWeekdays: [],
        fixedDriver: "",
      },
    ]);
    setNewCourseName("");
  };

  const deleteCourseSetting = (id: string) => {
    if (!confirm("このコース設定を削除しますか？")) return;
    setCourseSettings((previous) =>
      previous.filter((setting) => setting.id !== id),
    );
  };

  useEffect(() => {
    const savedDrivers = loadData<StoredDriver[]>("unite-fleet-drivers", []);

    if (savedDrivers.length === 0) return;

    setStandbyDrivers(
      savedDrivers.flatMap((driver) => {
        const offices = [
          driver.office,
          ...(driver.subOffices ?? []),
          driver.subOffice,
        ]
          .filter((office): office is string => Boolean(office))
          .filter((office, index, all) => all.indexOf(office) === index);

        return offices.map((office, index) => ({
          id: driver.id * 10 + index,
          name: driver.name,
          area: office,
          status: "待機" as const,
          mainArea: driver.office.replace("営業所", ""),
          supportedCourses: driver.supportedCourses ?? [],
          fixedCourse: driver.fixedCourse ?? "",
          assignmentMode: driver.assignmentMode ?? "通常",
        }));
      }),
    );
  }, []);

  const today = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
    "ja-JP",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    },
  );

  const summary = useMemo(() => {
    const allCourses = Object.values(coursesByRegion).flat();
    const unassigned = allCourses.filter(
      (course) => course.status === "未配車",
    ).length;
    const support = allCourses.filter(
      (course) => course.status === "応援",
    ).length;
    const off = allCourses.filter((course) => course.status === "休み").length;
    const active = allCourses.filter(
      (course) => course.status === "配車済",
    ).length;

    return { unassigned, support, off, active };
  }, [coursesByRegion]);

  const assignedDriverNames = new Set(
    Object.values(coursesByRegion)
      .flat()
      .map((course) => course.driver)
      .filter(Boolean),
  );
  const availableDrivers = standbyDrivers.filter(
    (driver) => !assignedDriverNames.has(driver.name),
  );

  const addCourse = () => {
    const nextId = Date.now();
    const newCourse: Course = {
      id: nextId,
      course: `${activeTab}-${String(Object.values(coursesByRegion[activeTab]).length + 1).padStart(2, "0")}`,
      driver: "",
      vehicle: "",
      client: "新規荷主",
      start: "09:00",
      end: "13:00",
      count: "0",
      status: "未配車",
      memo: "要確認",
      isLocked: false,
    };

    setCoursesByRegion((prev) => ({
      ...prev,
      [activeTab]: [...prev[activeTab], newCourse],
    }));
  };

  const applyCoursePreset = (preset: "normal" | "weekday") => {
    const names = getCourseNamesForDate(selectedDate, activeTab, preset);

    setCoursesByRegion((previous) => ({
      ...previous,
      [activeTab]: names.map((name, index) => {
        const existing = previous[activeTab].find(
          (course) => course.course === name,
        );
        return existing ?? createCourse(Date.now() + index, name);
      }),
    }));
  };

  const generateMonthlyShifts = () => {
    const [year, month] = autoMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const uniqueDrivers = Array.from(
      new Map(standbyDrivers.map((driver) => [driver.name, driver])).values(),
    );
    const eligibleRegions = new Map<string, Set<Region>>();

    standbyDrivers.forEach((driver) => {
      const region = driver.area.replace("営業所", "") as Region;
      const regions = eligibleRegions.get(driver.name) ?? new Set<Region>();
      regions.add(region);
      eligibleRegions.set(driver.name, regions);
    });

    const workCounts = new Map<string, number>();
    const streaks = new Map<string, number>();
    const generated: ShiftsByDate = {};
    let unassignedCount = 0;

    const normalizeDriverName = (value: string) => value.replace(/[\s　]/g, "");
    const firstDayOfMonth = new Date(year, month - 1, 1);

    uniqueDrivers.forEach((driver) => {
      let previousMonthStreak = 0;

      for (let daysBack = 1; daysBack <= 6; daysBack += 1) {
        const previousDate = new Date(firstDayOfMonth);
        previousDate.setDate(firstDayOfMonth.getDate() - daysBack);
        const previousCourses = Object.values(
          shiftsByDate[formatDateKey(previousDate)] ?? {},
        ).flat();
        const worked = previousCourses.some(
          (course) =>
            course.driver &&
            normalizeDriverName(course.driver) ===
              normalizeDriverName(driver.name),
        );

        if (!worked) break;
        previousMonthStreak += 1;
      }

      streaks.set(driver.name, previousMonthStreak);
    });

    const weekdayNumbers: Record<string, number> = {
      日: 0,
      月: 1,
      火: 2,
      水: 3,
      木: 4,
      金: 5,
      土: 6,
    };

    const parseDriverCondition = (name: string) => {
      const original = requestedDaysOff[name] ?? "";
      const compact = original
        .replace(/[０-９]/g, (digit) =>
          String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
        )
        .replace(/[，、]/g, ",")
        .replace(/\s/g, "");
      const monthlyMatch = compact.match(/月(?:に)?(\d+)日(?:間)?休(?:み|日)/);
      const monthlyDaysOff = monthlyMatch ? Number(monthlyMatch[1]) : undefined;
      const withoutMonthly = compact.replace(
        /月(?:に)?\d+日(?:間)?休(?:み|日)/g,
        "",
      );
      const specificDays = new Set(
        (withoutMonthly.match(/\d+/g) ?? [])
          .map(Number)
          .filter((day) => day >= 1 && day <= lastDay),
      );
      const weeklyDaysOff = new Set<number>();

      for (const match of compact.matchAll(
        /(?:毎週)?([日月火水木金土])曜(?:日)?(?:は)?休/g,
      )) {
        weeklyDaysOff.add(weekdayNumbers[match[1]]);
      }

      if (/土日休/.test(compact)) {
        weeklyDaysOff.add(0);
        weeklyDaysOff.add(6);
      }

      return { monthlyDaysOff, specificDays, weeklyDaysOff };
    };

    const parsedConditions = new Map(
      uniqueDrivers.map((driver) => [
        driver.name,
        parseDriverCondition(driver.name),
      ]),
    );

    const requestedOff = (name: string, day: number, weekday: number) => {
      const condition = parsedConditions.get(name);
      return Boolean(
        condition?.specificDays.has(day) ||
        condition?.weeklyDaysOff.has(weekday) ||
        (fixedDaysOff[name] ?? []).includes(weekday),
      );
    };

    for (let day = 1; day <= lastDay; day += 1) {
      const date = `${autoMonth}-${String(day).padStart(2, "0")}`;
      const weekday = new Date(`${date}T00:00:00`).getDay();
      const courses = createCoursesFromSettings(date, courseSettings);
      const assignedToday = new Set<string>();

      (Object.keys(courses) as Region[]).forEach((region) => {
        courses[region] = courses[region].map((course) => {
          const locked = shiftsByDate[date]?.[region]?.find(
            (existing) =>
              existing.course === course.course && existing.isLocked,
          );
          if (locked?.driver) assignedToday.add(locked.driver);
          return locked ?? course;
        });
      });

      // 専属人数が少ない営業所から先に確保する。
      // 松阪を先にすると、複数営業所対応者を使い切って伊勢が空くため。
      (["伊勢", "伊賀", "松阪"] as Region[]).forEach((region) => {
        const originalCourseOrder = new Map(
          courses[region].map((course, index) => [course.course, index]),
        );
        const availableDriverCount = (course: Course) =>
          uniqueDrivers.filter((driver) => {
            if (!eligibleRegions.get(driver.name)?.has(region)) return false;
            if (driver.assignmentMode === "自動除外") return false;
            if (
              driver.assignmentMode === "応援のみ" &&
              driver.mainArea === region
            )
              return false;
            if (
              driver.supportedCourses?.length &&
              !driver.supportedCourses.includes(course.course)
            )
              return false;
            if (driver.fixedCourse && driver.fixedCourse !== course.course)
              return false;
            if (assignedToday.has(driver.name)) return false;
            if (requestedOff(driver.name, day, weekday)) return false;
            const monthlyDaysOff = parsedConditions.get(
              driver.name,
            )?.monthlyDaysOff;
            if (monthlyDaysOff !== undefined) {
              const maximumWorkDays = Math.max(0, lastDay - monthlyDaysOff);
              if ((workCounts.get(driver.name) ?? 0) >= maximumWorkDays)
                return false;
            }
            if ((streaks.get(driver.name) ?? 0) >= 6) return false;
            if (driver.name === "東 真規")
              return weekday !== 1 && course.course === "神久コース";
            if (driver.name === "中川 昭治")
              return weekday !== 4 && course.course === "Hコース";
            return true;
          }).length;

        const assignmentPriority = (course: Course) =>
          region === "松阪" &&
          (course.course === "Eコース" || course.course === "Fコース")
            ? 0
            : 1;

        courses[region] = [...courses[region]]
          .sort((a, b) => {
            const scarcityDifference =
              availableDriverCount(a) - availableDriverCount(b);
            if (scarcityDifference !== 0) return scarcityDifference;
            return assignmentPriority(a) - assignmentPriority(b);
          })
          .map((course) => {
            if (course.isLocked) return course;
            const courseSetting = courseSettings.find(
              (setting) =>
                setting.region === region && setting.name === course.course,
            );
            const regionalDrivers = uniqueDrivers.filter((driver) =>
              eligibleRegions.get(driver.name)?.has(region),
            );
            const unavailableReasons = (driver: DriverItem) => {
              const reasons: string[] = [];
              if (driver.assignmentMode === "自動除外")
                reasons.push("自動除外");
              if (
                driver.assignmentMode === "応援のみ" &&
                driver.mainArea === region
              )
                reasons.push("応援先限定");
              if (
                driver.supportedCourses?.length &&
                !driver.supportedCourses.includes(course.course)
              )
                reasons.push("対応コース外");
              if (driver.fixedCourse && driver.fixedCourse !== course.course)
                reasons.push("別コース固定");
              if (assignedToday.has(driver.name))
                reasons.push("別コース配置済み");
              if (requestedOff(driver.name, day, weekday))
                reasons.push("希望・固定休");
              const monthlyDaysOff = parsedConditions.get(
                driver.name,
              )?.monthlyDaysOff;
              if (monthlyDaysOff !== undefined) {
                const maximumWorkDays = Math.max(0, lastDay - monthlyDaysOff);
                if ((workCounts.get(driver.name) ?? 0) >= maximumWorkDays)
                  reasons.push("月間休日日数");
              }
              if ((streaks.get(driver.name) ?? 0) >= 6)
                reasons.push("7連勤防止");
              if (driver.name === "東 真規" && weekday === 1)
                reasons.push("月曜固定休");
              if (driver.name === "中川 昭治" && weekday === 4)
                reasons.push("木曜固定休");
              if (driver.name === "東 真規" && course.course !== "神久コース")
                reasons.push("神久固定");
              if (driver.name === "中川 昭治" && course.course !== "Hコース")
                reasons.push("H固定");
              return reasons;
            };

            const candidates = regionalDrivers
              .filter((driver) => unavailableReasons(driver).length === 0)
              .sort((a, b) => {
                const score = (driver: DriverItem) => {
                  const fixedPriority =
                    (courseSetting?.fixedDriver &&
                      normalizeDriverName(driver.name) ===
                        normalizeDriverName(courseSetting.fixedDriver)) ||
                    (driver.name === "東 真規" &&
                      course.course === "神久コース") ||
                    (driver.name === "中川 昭治" && course.course === "Hコース")
                      ? -1000
                      : 0;
                  const reservePenalty =
                    driver.name === "清水 國光" ? 10000 : 0;
                  const assignmentPenalty =
                    driver.assignmentMode === "最終候補"
                      ? 5000
                      : driver.assignmentMode === "応援のみ"
                        ? 250
                        : 0;
                  const driverFixedPriority =
                    driver.fixedCourse === course.course ? -2000 : 0;
                  return (
                    fixedPriority +
                    driverFixedPriority +
                    reservePenalty +
                    assignmentPenalty +
                    (workCounts.get(driver.name) ?? 0)
                  );
                };
                return score(a) - score(b);
              });

            const selected = candidates[0];
            if (!selected) {
              unassignedCount += 1;
              const reasonCounts = new Map<string, number>();
              regionalDrivers.forEach((driver) =>
                unavailableReasons(driver).forEach((reason) =>
                  reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1),
                ),
              );
              const reasonText =
                regionalDrivers.length === 0
                  ? "対象営業所の対応者なし"
                  : Array.from(reasonCounts.entries())
                      .map(([reason, count]) => `${reason}${count}人`)
                      .join("、");
              return {
                ...course,
                memo: `未配置理由：対応候補${regionalDrivers.length}人／${reasonText}`,
              };
            }

            assignedToday.add(selected.name);
            workCounts.set(
              selected.name,
              (workCounts.get(selected.name) ?? 0) + 1,
            );
            return {
              ...course,
              driver: selected.name,
              status: "配車済" as const,
              memo: "自動作成",
            };
          })
          .sort(
            (a, b) =>
              (originalCourseOrder.get(a.course) ?? 999) -
              (originalCourseOrder.get(b.course) ?? 999),
          );
      });

      uniqueDrivers.forEach((driver) => {
        streaks.set(
          driver.name,
          assignedToday.has(driver.name)
            ? (streaks.get(driver.name) ?? 0) + 1
            : 0,
        );
      });
      generated[date] = courses;
    }

    setShiftsByDate((previous) => ({ ...previous, ...generated }));
    setSelectedDate(`${autoMonth}-01`);
    setAutoMessage(
      unassignedCount === 0
        ? `${autoMonth}のシフトを自動作成しました。`
        : `${autoMonth}を作成しました。未配置が${unassignedCount}件あります。`,
    );
  };

  const changeCourseDriver = (courseId: number, driverName: string) => {
    const selectedDriver = standbyDrivers.find(
      (driver) =>
        driver.name === driverName &&
        driver.area.replace("営業所", "") === activeTab,
    );

    setCoursesByRegion((previous) => ({
      ...previous,
      [activeTab]: previous[activeTab].map((course) =>
        course.id === courseId
          ? {
              ...course,
              driver: driverName,
              status: driverName ? "配車済" : "未配車",
              memo: selectedDriver
                ? `${selectedDriver.area.replace("営業所", "")}エリア`
                : "",
              isLocked: true,
            }
          : course,
      ),
    }));
  };

  const signIn = async () => {
    setCloudBusy(true);
    setCloudMessage("");
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    setCloudBusy(false);
    setCloudMessage(
      error
        ? `ログインできません：${error.message}`
        : "管理者としてログインしました。",
    );
    if (!error) setAuthPassword("");
  };

  const loadCloudMonth = async () => {
    if (!session) return setCloudMessage("先に管理者ログインしてください。");
    setCloudBusy(true);
    setCloudMessage("");
    const { data: monthRow, error: monthError } = await supabase
      .from("shift_months")
      .select("id,status")
      .eq("month_key", autoMonth)
      .maybeSingle();
    if (monthError || !monthRow) {
      setCloudBusy(false);
      setMonthStatus("draft");
      setCloudMessage(
        monthError
          ? `読込エラー：${monthError.message}`
          : `${autoMonth}のクラウドデータはまだありません。`,
      );
      return;
    }
    const [
      { data: assignments, error: assignmentError },
      { data: conditions, error: conditionError },
    ] = await Promise.all([
      supabase
        .from("shift_assignments")
        .select("work_date,area,course,driver_name,status,memo,is_locked")
        .eq("shift_month_id", monthRow.id)
        .order("work_date"),
      supabase
        .from("shift_conditions")
        .select("driver_name,condition_text")
        .eq("shift_month_id", monthRow.id),
    ]);
    if (assignmentError || conditionError) {
      setCloudBusy(false);
      setCloudMessage(
        `読込エラー：${assignmentError?.message ?? conditionError?.message}`,
      );
      return;
    }
    const loaded: ShiftsByDate = {};
    (assignments ?? []).forEach((row, index) => {
      const date = String(row.work_date);
      const region = row.area as Region;
      if (!loaded[date]) {
        loaded[date] = createCoursesFromSettings(date, courseSettings);
      }
      const nextCourse: Course = {
        ...createCourse(Date.now() + index, row.course),
        driver: row.driver_name ?? "",
        status: row.status as CourseStatus,
        memo: row.memo ?? "",
        isLocked: Boolean(row.is_locked),
      };
      const existing = loaded[date][region].findIndex(
        (item) => item.course === row.course,
      );
      if (existing >= 0) loaded[date][region][existing] = nextCourse;
      else loaded[date][region].push(nextCourse);
    });
    const loadedConditions: RequestedDaysOff = {};
    (conditions ?? []).forEach((row) => {
      loadedConditions[row.driver_name] = row.condition_text;
    });
    setShiftsByDate((previous) => ({ ...previous, ...loaded }));
    setRequestedDaysOff((previous) => ({ ...previous, ...loadedConditions }));
    setMonthStatus(monthRow.status as "draft" | "published");
    setSelectedDate(`${autoMonth}-01`);
    setCloudBusy(false);
    setCloudMessage(`${autoMonth}をクラウドから読み込みました。`);
  };

  const finalChecks = useMemo(() => {
    const issues: string[] = [];
    const monthDates = Object.keys(shiftsByDate)
      .filter((date) => date.startsWith(`${autoMonth}-`))
      .sort();
    const workedDates = new Map<string, Set<string>>();

    monthDates.forEach((date) => {
      const seen = new Map<string, string>();
      const expectedCourses = createCoursesFromSettings(date, courseSettings);
      (Object.keys(shiftsByDate[date]) as Region[]).forEach((region) => {
        expectedCourses[region].forEach((expected) => {
          const exists = shiftsByDate[date][region].some(
            (course) => course.course === expected.course,
          );
          if (!exists) {
            issues.push(
              `${date} ${region} ${expected.course}：コース不足・未配置`,
            );
          }
        });
        shiftsByDate[date][region].forEach((course) => {
          if (!course.driver || course.status === "未配車") {
            issues.push(
              `${date} ${region} ${course.course}：未配置${course.memo ? `（${course.memo}）` : ""}`,
            );
            return;
          }
          const previous = seen.get(course.driver);
          if (previous) {
            issues.push(
              `${date} ${course.driver}：重複配置（${previous}／${region} ${course.course}）`,
            );
          } else {
            seen.set(course.driver, `${region} ${course.course}`);
          }
          const dates = workedDates.get(course.driver) ?? new Set<string>();
          dates.add(date);
          workedDates.set(course.driver, dates);
        });
      });
    });

    workedDates.forEach((dates, driver) => {
      let streak = 0;
      monthDates.forEach((date) => {
        streak = dates.has(date) ? streak + 1 : 0;
        if (streak === 7) issues.push(`${date} ${driver}：7連勤`);
      });
    });
    return issues;
  }, [autoMonth, courseSettings, shiftsByDate]);

  const saveCloudMonth = async (publish: boolean) => {
    if (!session) return setCloudMessage("先に管理者ログインしてください。");
    if (publish && finalChecks.length > 0) {
      setCloudMessage(
        `公開できません。公開前チェックの${finalChecks.length}件を直してください。`,
      );
      return;
    }
    setCloudBusy(true);
    setCloudMessage("");
    const nextStatus = publish ? "published" : "draft";
    const { data: monthRow, error: monthError } = await supabase
      .from("shift_months")
      .upsert(
        {
          month_key: autoMonth,
          status: nextStatus,
          published_at: publish ? new Date().toISOString() : null,
          created_by: session.user.id,
        },
        { onConflict: "month_key" },
      )
      .select("id")
      .single();
    if (monthError || !monthRow) {
      setCloudBusy(false);
      setCloudMessage(
        `保存エラー：${monthError?.message ?? "月データを作成できません"}`,
      );
      return;
    }
    const rows = Object.keys(shiftsByDate)
      .filter((date) => date.startsWith(`${autoMonth}-`))
      .flatMap((date) =>
        (Object.keys(shiftsByDate[date]) as Region[]).flatMap((region) =>
          shiftsByDate[date][region].map((course) => ({
            shift_month_id: monthRow.id,
            work_date: date,
            area: region,
            course: course.course,
            driver_name: course.driver,
            status: course.status,
            memo: course.memo,
            is_locked: course.isLocked,
          })),
        ),
      );
    const conditionRows = Object.entries(requestedDaysOff)
      .filter(([, text]) => text.trim())
      .map(([driverName, text]) => ({
        shift_month_id: monthRow.id,
        driver_name: driverName,
        condition_text: text,
      }));
    const { error: deleteAssignmentError } = await supabase
      .from("shift_assignments")
      .delete()
      .eq("shift_month_id", monthRow.id);
    const { error: deleteConditionError } = await supabase
      .from("shift_conditions")
      .delete()
      .eq("shift_month_id", monthRow.id);
    const { error: assignmentError } = rows.length
      ? await supabase.from("shift_assignments").insert(rows)
      : { error: null };
    const { error: conditionError } = conditionRows.length
      ? await supabase.from("shift_conditions").insert(conditionRows)
      : { error: null };
    const error =
      deleteAssignmentError ||
      deleteConditionError ||
      assignmentError ||
      conditionError;
    if (!error)
      await supabase.from("shift_history").insert({
        shift_month_id: monthRow.id,
        action: publish ? "published" : "saved_draft",
        changed_by: session.user.id,
      });
    setCloudBusy(false);
    if (error) return setCloudMessage(`保存エラー：${error.message}`);
    setMonthStatus(nextStatus);
    setCloudMessage(
      publish
        ? `${autoMonth}を公開しました。スマホ共有画面へ反映されます。`
        : `${autoMonth}を下書き保存しました。`,
    );
  };

  const toggleCourseLock = (courseId: number) => {
    setCoursesByRegion((previous) => ({
      ...previous,
      [activeTab]: previous[activeTab].map((course) =>
        course.id === courseId
          ? { ...course, isLocked: !course.isLocked }
          : course,
      ),
    }));
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#111827,_#030712_70%)] text-slate-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <section className="flex-1 p-3 sm:p-4 lg:p-5 xl:p-6">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:p-5">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-sky-300">
                  Operations Planning
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  シフト管理
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
                />
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300">
                  {today}
                </div>
                <button
                  type="button"
                  onClick={() => applyCoursePreset("normal")}
                  className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  通常版
                </button>
                <button
                  type="button"
                  onClick={() => applyCoursePreset("weekday")}
                  className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/20"
                >
                  曜日版
                </button>
                <button
                  type="button"
                  onClick={addCourse}
                  className="rounded-xl bg-sky-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
                >
                  + コース追加
                </button>

                <Link
                  href="/shift/share"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-sky-400 px-3.5 py-2 text-sm font-semibold text-sky-300 transition hover:bg-sky-400/10"
                >
                  🔗 ドライバー共有画面 ↗
                </Link>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4">
              {session ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-300">
                    管理者ログイン中
                  </span>
                  <span
                    className={`rounded-full px-3 py-2 text-sm font-semibold ${monthStatus === "published" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"}`}
                  >
                    {monthStatus === "published" ? "公開済み" : "下書き"}
                  </span>
                  <button
                    type="button"
                    disabled={cloudBusy}
                    onClick={loadCloudMonth}
                    className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
                  >
                    クラウドから読込
                  </button>
                  <button
                    type="button"
                    disabled={cloudBusy}
                    onClick={() => saveCloudMonth(false)}
                    className="rounded-xl bg-slate-600 px-3.5 py-2 text-sm font-semibold hover:bg-slate-500 disabled:opacity-50"
                  >
                    下書き保存
                  </button>
                  <button
                    type="button"
                    disabled={cloudBusy || finalChecks.length > 0}
                    onClick={() => saveCloudMonth(true)}
                    className="rounded-xl bg-emerald-500 px-3.5 py-2 text-sm font-semibold hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    確定・公開
                  </button>
                  <button
                    type="button"
                    onClick={() => supabase.auth.signOut()}
                    className="rounded-xl border border-rose-400/30 px-3.5 py-2 text-sm font-semibold text-rose-200"
                  >
                    ログアウト
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-sm text-slate-300">
                    管理者メール
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(event) => setAuthEmail(event.target.value)}
                      className="mt-1 block rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    パスワード
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(event) => setAuthPassword(event.target.value)}
                      className="mt-1 block rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={cloudBusy || !authEmail || !authPassword}
                    onClick={signIn}
                    className="rounded-xl bg-sky-500 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
                  >
                    管理者ログイン
                  </button>
                </div>
              )}
              {cloudMessage && (
                <p className="mt-3 text-sm font-semibold text-sky-200">
                  {cloudMessage}
                </p>
              )}
            </div>

            <details
              className={`mt-4 rounded-2xl border p-4 ${finalChecks.length ? "border-rose-400/30 bg-rose-500/10" : "border-emerald-400/30 bg-emerald-500/10"}`}
            >
              <summary className="cursor-pointer font-semibold text-white">
                {finalChecks.length
                  ? `⚠️ 公開前チェック：${finalChecks.length}件`
                  : "✅ 公開前チェック：問題なし"}
              </summary>
              {finalChecks.length > 0 && (
                <ul className="mt-3 max-h-52 list-disc overflow-y-auto pl-5 text-sm text-rose-100">
                  {finalChecks.map((issue, index) => (
                    <li key={`${issue}-${index}`} className="py-0.5">
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
            </details>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  未配車件数
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {summary.unassigned}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  応援件数
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {summary.support}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  休み人数
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {summary.off}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  稼働人数
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {summary.active}
                </p>
              </div>
            </div>

            <details className="mt-5 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4">
              <summary className="cursor-pointer text-lg font-semibold text-white">
                🛠 コース設定
              </summary>
              <p className="mt-2 text-sm text-slate-300">
                コース名・固定休・固定担当者を変更できます。設定は次回の自動作成から反映されます。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["松阪", "伊勢", "伊賀"] as Region[]).map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => setActiveTab(region)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === region ? "bg-violet-500 text-white" : "bg-white/5 text-slate-300"}`}
                  >
                    {region}
                  </button>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                {courseSettings
                  .filter((setting) => setting.region === activeTab)
                  .map((setting) => (
                    <div
                      key={setting.id}
                      className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 lg:grid-cols-[180px_1fr_220px_70px] lg:items-center"
                    >
                      <input
                        value={setting.name}
                        onChange={(event) =>
                          updateCourseSetting(setting.id, {
                            name: event.target.value,
                          })
                        }
                        className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white"
                      />
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAYS.map((label, weekday) => (
                          <label
                            key={label}
                            className="flex items-center gap-1 text-xs text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={setting.closedWeekdays.includes(weekday)}
                              onChange={(event) =>
                                updateCourseSetting(setting.id, {
                                  closedWeekdays: event.target.checked
                                    ? [...setting.closedWeekdays, weekday]
                                    : setting.closedWeekdays.filter(
                                        (day) => day !== weekday,
                                      ),
                                })
                              }
                            />
                            {label}休
                          </label>
                        ))}
                      </div>
                      <select
                        value={setting.fixedDriver}
                        onChange={(event) =>
                          updateCourseSetting(setting.id, {
                            fixedDriver: event.target.value,
                          })
                        }
                        className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white"
                      >
                        <option value="">固定担当者なし</option>
                        {Array.from(
                          new Set(
                            standbyDrivers
                              .filter(
                                (driver) =>
                                  driver.area.replace("営業所", "") ===
                                  activeTab,
                              )
                              .map((driver) => driver.name),
                          ),
                        ).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => deleteCourseSetting(setting.id)}
                        className="rounded-lg bg-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-200"
                      >
                        削除
                      </button>
                    </div>
                  ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={newCourseName}
                  onChange={(event) => setNewCourseName(event.target.value)}
                  placeholder="新しいコース名"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white"
                />
                <button
                  type="button"
                  onClick={addCourseSetting}
                  className="rounded-lg bg-violet-500 px-4 py-2 font-semibold text-white"
                >
                  コース追加
                </button>
              </div>

              <div className="mt-6 border-t border-white/10 pt-4">
                <h3 className="font-semibold text-white">
                  ドライバーの毎週固定休
                </h3>
                <p className="mt-1 text-sm text-slate-300">
                  ここで選んだ曜日は毎月引き継がれ、希望休より先に反映されます。
                </p>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from(
                    new Map(
                      standbyDrivers.map((driver) => [driver.name, driver]),
                    ).values(),
                  ).map((driver) => (
                    <div
                      key={driver.name}
                      className="rounded-lg bg-white/5 px-3 py-2"
                    >
                      <div className="mb-2 text-sm font-semibold">
                        {driver.name}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAYS.map((label, weekday) => (
                          <label
                            key={label}
                            className="flex cursor-pointer items-center gap-1 text-xs text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={(
                                fixedDaysOff[driver.name] ?? []
                              ).includes(weekday)}
                              onChange={(event) => {
                                const current = fixedDaysOff[driver.name] ?? [];
                                setFixedDaysOff((previous) => ({
                                  ...previous,
                                  [driver.name]: event.target.checked
                                    ? [...current, weekday]
                                    : current.filter((day) => day !== weekday),
                                }));
                              }}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={saveMasterSettings}
                className="mt-4 w-full rounded-xl bg-violet-500 px-4 py-2.5 font-semibold text-white hover:bg-violet-400"
              >
                コース・固定休をクラウド保存
              </button>
              {cloudMessage && (
                <p className="mt-3 rounded-xl border border-violet-400/20 bg-violet-400/10 px-4 py-3 text-sm text-violet-100">
                  {cloudMessage}
                </p>
              )}
            </details>

            <details className="mt-5 rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4">
              <summary className="cursor-pointer text-lg font-semibold text-white">
                ⚙️ 1か月分のシフトを自動作成
              </summary>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-sm text-slate-300">
                  対象月
                  <input
                    type="month"
                    value={autoMonth}
                    onChange={(event) => setAutoMonth(event.target.value)}
                    className="mt-1 block rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white"
                  />
                </label>
                <button
                  type="button"
                  onClick={generateMonthlyShifts}
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-white hover:bg-emerald-400"
                >
                  1か月分を自動作成
                </button>
              </div>

              <p className="mt-4 text-sm text-slate-300">
                条件は「月8日休み」「毎週水曜休み」「5日、12日希望休」のように入力できます。複数条件は読点で続けてください。
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {Array.from(
                  new Map(
                    standbyDrivers.map((driver) => [driver.name, driver]),
                  ).values(),
                ).map((driver) => (
                  <label
                    key={driver.name}
                    className="grid grid-cols-[1fr_130px] items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
                  >
                    <span>{driver.name}</span>
                    <input
                      value={requestedDaysOff[driver.name] ?? ""}
                      onChange={(event) =>
                        setRequestedDaysOff((previous) => ({
                          ...previous,
                          [driver.name]: event.target.value,
                        }))
                      }
                      placeholder="例：月8日休み、毎週水曜休み"
                      className="rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-white"
                    />
                  </label>
                ))}
              </div>
              {autoMessage && (
                <p className="mt-4 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-sky-200">
                  {autoMessage}
                </p>
              )}
            </details>

            <div className="mt-5 flex flex-wrap gap-2">
              {(["松阪", "伊勢", "伊賀"] as Region[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab
                      ? "bg-sky-500 text-white"
                      : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/70 p-2">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="px-2 py-2 font-semibold">コース</th>
                    <th className="px-2 py-2 font-semibold">担当ドライバー</th>
                    <th className="px-2 py-2 font-semibold">車両</th>
                    <th className="px-2 py-2 font-semibold">荷主</th>
                    <th className="px-2 py-2 font-semibold">開始</th>
                    <th className="px-2 py-2 font-semibold">終了予定</th>
                    <th className="px-2 py-2 font-semibold">配送個数</th>
                    <th className="px-2 py-2 font-semibold">状態</th>
                    <th className="px-2 py-2 font-semibold">メモ</th>
                    <th className="px-2 py-2 font-semibold">固定</th>
                  </tr>
                </thead>
                <tbody>
                  {coursesByRegion[activeTab].map((course) => (
                    <tr
                      key={course.id}
                      className="border-b border-white/5 text-slate-200 last:border-b-0"
                    >
                      <td className="px-2 py-2 font-medium">{course.course}</td>
                      <td className="px-2 py-2">
                        <select
                          value={course.driver}
                          onChange={(event) =>
                            changeCourseDriver(course.id, event.target.value)
                          }
                          className="min-w-36 rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 text-slate-100"
                        >
                          <option value="">未割当</option>
                          {course.driver && (
                            <option value={course.driver}>
                              {course.driver}
                            </option>
                          )}
                          {availableDrivers
                            .filter(
                              (driver) =>
                                driver.area.replace("営業所", "") === activeTab,
                            )
                            .map((driver) => (
                              <option key={driver.id} value={driver.name}>
                                {driver.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">{course.vehicle}</td>
                      <td className="px-2 py-2">{course.client}</td>
                      <td className="px-2 py-2">{course.start}</td>
                      <td className="px-2 py-2">{course.end}</td>
                      <td className="px-2 py-2">{course.count}</td>
                      <td className="px-2 py-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[course.status]}`}
                        >
                          {course.status}
                        </span>
                      </td>
                      <td className="px-2 py-2">{course.memo}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => toggleCourseLock(course.id)}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${course.isLocked ? "bg-amber-400 text-slate-950" : "border border-white/15 bg-white/5 text-slate-300"}`}
                        >
                          {course.isLocked ? "🔒 固定中" : "🔓 固定"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}