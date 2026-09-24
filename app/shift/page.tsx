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
  supportedCourses?: string[]; // 旧データ互換
  supportedCoursesByOffice?: Partial<Record<Region, string[]>>;
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
  supportedCourses?: string[]; // 旧データ互換
  supportedCoursesByOffice?: Partial<Record<Region, string[]>>;
  fixedCourse?: string;
  assignmentMode?: "通常" | "応援のみ" | "最終候補" | "自動除外";
};

type ShiftDriverSettingRow = {
  driver_name: string;
  office: string;
  available_courses?: string[];
  auto_assign?: boolean;
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
  { label: "設定", href: "/settings" },
];

type ShiftsByDate = Record<string, Record<Region, Course[]>>;
type DailyCourseOverrides = Record<
  string,
  Partial<Record<Region, string[]>>
>;
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
  if (weekday === 0 && region === "伊勢") {
    return ["神久・朝熊コース", "御薗コース", "高向コース"];
  }
  if (weekday === 1 && region === "伊勢") {
    return ["神久コース", "御薗・高向コース"];
  }

  return NORMAL_COURSE_NAMES[region];
};

const resolveCourseNamesForDate = (
  dateValue: string,
  region: Region,
  preset: "normal" | "weekday",
  override?: string[],
) => {
  const presetNames = getCourseNamesForDate(dateValue, region, preset);
  if (!override) return presetNames;

  const otherPreset = preset === "normal" ? "weekday" : "normal";
  const oldPresetNames = getCourseNamesForDate(
    dateValue,
    region,
    otherPreset,
  );
  const isOldAutomaticPattern =
    override.join("|") === oldPresetNames.join("|") &&
    override.join("|") !== presetNames.join("|");

  return isOldAutomaticPattern ? presetNames : override;
};

const normalizeCourseName = (value: string) =>
  String(value ?? "")
    .trim()
    .replace(/コース$/, "");

const sameCourseName = (left: string, right: string) =>
  normalizeCourseName(left) === normalizeCourseName(right);

const uniqueCourseNames = (names: string[]) => {
  const result: string[] = [];
  for (const name of names) {
    if (!result.some((current) => sameCourseName(current, name))) {
      result.push(name);
    }
  }
  return result;
};

const canDriveCourse = (
  supportedCourses: string[] | undefined,
  courseName: string,
) => {
  // 担当可能コースが0件なら配置不可。
  if (!supportedCourses?.length) return false;

  // 「G」と「Gコース」、「高町」と「高町コース」を同じコースとして判定する。
  const normalizedSupported = new Set(
    supportedCourses
      .map((course) => normalizeCourseName(course))
      .filter(Boolean),
  );
  const normalizedCourse = normalizeCourseName(courseName);

  // AB / BC / CD などの統合コース。
  const mergedCourse = normalizedCourse.match(/^([A-H]{2,})$/);
  if (mergedCourse) {
    return mergedCourse[1]
      .split("")
      .every((letter) => normalizedSupported.has(letter));
  }

  if (normalizedCourse === "御薗・高向") {
    return ["御薗", "高向"].every((name) => normalizedSupported.has(name));
  }

  if (normalizedCourse === "神久・朝熊") {
    return ["神久", "朝熊"].every((name) => normalizedSupported.has(name));
  }

  return normalizedSupported.has(normalizedCourse);
};
const normalizeRegion = (office: string): Region | null => {
  const region = office.replace("営業所", "");
  return region === "松阪" || region === "伊勢" || region === "伊賀"
    ? region
    : null;
};

const getSupportedCoursesForRegion = (
  driver: Pick<
    DriverItem,
    "mainArea" | "supportedCourses" | "supportedCoursesByOffice"
  >,
  region: Region,
) => {
  // 営業所別の登録があれば、それだけを正として使う。
  const byOffice = driver.supportedCoursesByOffice?.[region];
  if (byOffice !== undefined) return byOffice;

  // 旧データ互換は「メイン営業所だけ」。
  // サブ営業所に登録されているだけでは配置可能にしない。
  if (driver.mainArea === region) return driver.supportedCourses ?? [];

  return [];
};

const canDriverDriveCourse = (
  driver: Pick<
    DriverItem,
    "mainArea" | "supportedCourses" | "supportedCoursesByOffice"
  >,
  region: Region,
  courseName: string,
) => canDriveCourse(getSupportedCoursesForRegion(driver, region), courseName);

const fixedCourseMatches = (
  fixedCourse: string | undefined,
  courseName: string,
) => {
  if (!fixedCourse) return true;
  if (fixedCourse === courseName) return true;

  // 伊勢の日曜「神久・朝熊コース」は、神久固定の東さんを配置可能にする。
  if (
    fixedCourse === "神久コース" &&
    courseName === "神久・朝熊コース"
  ) {
    return true;
  }

  return false;
};

const canDriverHandleCourse = (
  driver: DriverItem,
  region: Region,
  courseName: string,
) => {
  // 神久固定の東さんは、日曜の統合コースも神久の延長として担当可能。
  if (
    driver.name.replace(/[\s　]/g, "") === "東真規" &&
    region === "伊勢" &&
    courseName === "神久・朝熊コース" &&
    getSupportedCoursesForRegion(driver, region).includes("神久コース")
  ) {
    return true;
  }

  return canDriverDriveCourse(driver, region, courseName);
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

// ドライバー名比較用：半角・全角スペースを無視する
const normalizeDriverName = (value: string) => value.replace(/[\s　]/g, "");

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
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [coursePreset, setCoursePreset] = useState<"normal" | "weekday">(
    "normal",
  );
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
  // 「ダーツ301方式」用：月・営業所・ドライバーごとの目標出勤日数
  // Hydration対策：初回レンダーではサーバーとブラウザで同じ値を使う
  const [targetWorkDays, setTargetWorkDays] = useState<
    Record<string, number | "">
  >({});
  const [dayOffRequestRows, setDayOffRequestRows] = useState<
    Array<{ driver_name: string; requested_date: string }>
  >([]);
  // 希望休一覧の表示月。自動作成の対象月とは別に切り替えられる。
  const [dayOffListMonth, setDayOffListMonth] = useState(() =>
    formatDateKey(new Date()).slice(0, 7),
  );
  const [dayOffRequestMessage, setDayOffRequestMessage] = useState("");
  const [dayOffRequestRefreshKey, setDayOffRequestRefreshKey] = useState(0);
  const [shiftsByDate, setShiftsByDate] = useState<ShiftsByDate>({});
  const [dailyCourseOverrides, setDailyCourseOverrides] =
    useState<DailyCourseOverrides>({});
  const [courseChangeOpen, setCourseChangeOpen] = useState(false);
  const [courseChangeSelection, setCourseChangeSelection] = useState<string[]>(
    [],
  );
  const [courseSettings, setCourseSettings] = useState<CourseSetting[]>(
    DEFAULT_COURSE_SETTINGS,
  );
  const [newCourseName, setNewCourseName] = useState("");
  const [driverCourseOffice, setDriverCourseOffice] = useState<
    Record<string, Region>
  >({});

  useEffect(() => {
    const savedTargetWorkDays = loadData<Record<string, number | "">>(
      "unite-fleet-target-work-days",
      {},
    );
    setTargetWorkDays(savedTargetWorkDays);
  }, []);

  useEffect(() => {
    if (!localDataReady) return;
    saveData("unite-fleet-target-work-days", targetWorkDays);
  }, [localDataReady, targetWorkDays]);

  const targetKey = (monthKey: string, region: Region, driverName: string) =>
    `${monthKey}|${region}|${driverName}`;

  const getTargetWorkDays = (
    monthKey: string,
    region: Region,
    driverName: string,
  ) => {
    const value = targetWorkDays[targetKey(monthKey, region, driverName)];
    return typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.floor(value))
      : undefined;
  };

  const getMonthlyRequiredCourseCount = (region: Region) => {
    const [year, month] = autoMonth.split("-").map(Number);
    if (!year || !month) return 0;
    const lastDay = new Date(year, month, 0).getDate();

    let total = 0;
    for (let day = 1; day <= lastDay; day += 1) {
      const date = `${autoMonth}-${String(day).padStart(2, "0")}`;
      total += resolveCourseNamesForDate(
        date,
        region,
        coursePreset,
        dailyCourseOverrides[date]?.[region],
      ).length;
    }
    return total;
  };

  const driversForTargetRegion = (region: Region) =>
    Array.from(
      new Map(
        standbyDrivers
          .filter(
            (driver) =>
              driver.area.replace("営業所", "") === region ||
              driver.mainArea === region,
          )
          .map((driver) => [driver.name, driver]),
      ).values(),
    );

  const getUniqueDrivers = () =>
    Array.from(
      new Map(standbyDrivers.map((driver) => [driver.name, driver])).values(),
    );

  const getDriverOfficeTabs = (driver: DriverItem): Region[] => {
    const main = driver.mainArea as Region | undefined;
    const areas = standbyDrivers
      .filter((item) => item.name === driver.name)
      .map((item) => normalizeRegion(item.area))
      .filter((item): item is Region => Boolean(item));
    return Array.from(
      new Set([...(main ? [main] : []), ...areas]),
    );
  };

  // 担当可能コースは /settings の shift_driver_settings を正本とする。
  // シフト管理では読み込み・表示・配置判定だけを行い、ここからは編集しない。


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
    if (!session) {
      setDayOffRequestRows([]);
      return;
    }

    const loadDayOffRequests = async () => {
      setDayOffRequestMessage("希望休を読み込み中...");
      const { data, error } = await supabase
        .from("shift_day_off_requests")
        .select("driver_name,requested_date")
        .eq("target_month", dayOffListMonth)
        .order("requested_date", { ascending: true });

      if (error) {
        setDayOffRequestRows([]);
        setDayOffRequestMessage(`希望休の読込エラー：${error.message}`);
        return;
      }

      setDayOffRequestRows(
        (data ?? []).map((row) => ({
          driver_name: String(row.driver_name),
          requested_date: String(row.requested_date).slice(0, 10),
        })),
      );
      setDayOffRequestMessage("");
    };

    void loadDayOffRequests();
  }, [session, dayOffListMonth, dayOffRequestRefreshKey]);

  useEffect(() => {
    if (!session) return;
    const loadMaster = async () => {
      const [{ data }, { data: shiftSettingRows }] = await Promise.all([
        supabase
          .from("fleet_master")
          .select("offices,drivers,course_settings,fixed_days_off")
          .eq("id", "default")
          .maybeSingle(),
        supabase
          .from("shift_driver_settings")
          .select("driver_name,office,available_courses,auto_assign"),
      ]);
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
      // ドライバーの母体は「ドライバー管理（fleet_master）」だけにする。
      // shift_driver_settings に古い名前が残っていても、新しいドライバーとして追加しない。
      const normalizeName = (value: string) => value.replace(/[\s　]/g, "");
      const mergedDrivers = [...(cloudDrivers ?? [])];

      ((shiftSettingRows ?? []) as ShiftDriverSettingRow[]).forEach((setting) => {
        const existingIndex = mergedDrivers.findIndex(
          (driver) =>
            normalizeName(driver.name) === normalizeName(setting.driver_name),
        );

        // ドライバー管理に存在しない旧シフト設定は無視する。
        if (existingIndex < 0) return;

        const settingOffice = normalizeRegion(setting.office);
        const supportedCourses = (setting.available_courses ?? [])
          .filter((course) => !course.includes("|||"))
          .map((course) => normalizeCourseName(course))
          .filter(Boolean);

        const qualifiedByOffice = (setting.available_courses ?? []).reduce(
          (acc, value) => {
            const [office, course] = String(value).split("|||");
            const region = normalizeRegion(office);
            if (!region || !course) return acc;
            const normalizedCourse = normalizeCourseName(course);
            acc[region] = Array.from(
              new Set([...(acc[region] ?? []), normalizedCourse]),
            );
            return acc;
          },
          {} as Partial<Record<Region, string[]>>,
        );

        mergedDrivers[existingIndex] = {
          ...mergedDrivers[existingIndex],
          supportedCourses:
            supportedCourses.length > 0
              ? supportedCourses
              : mergedDrivers[existingIndex].supportedCourses,
          supportedCoursesByOffice: {
            ...(mergedDrivers[existingIndex].supportedCoursesByOffice ?? {}),
            // shift_driver_settings の office がサブ営業所でも、
            // その行の available_courses はその営業所の担当可能コースとして反映する。
            // 以前はメイン営業所と一致する行しか反映していなかったため、
            // 横溝・楠滝・徳田などの伊勢コース登録が生成側で空扱いになっていた。
            ...(settingOffice && supportedCourses.length > 0
              ? { [settingOffice]: supportedCourses }
              : {}),
            ...qualifiedByOffice,
          },
          assignmentMode:
            setting.auto_assign === false
              ? "自動除外"
              : mergedDrivers[existingIndex].assignmentMode ?? "通常",
        };
      });

      // ローカルにもドライバー管理の正式名簿を同期する。
      if (cloudDrivers?.length) {
        saveData("unite-fleet-drivers", cloudDrivers);
      }

      if (mergedDrivers.length) {
        setStandbyDrivers(
          mergedDrivers
            .filter((driver) => driver.status !== "退職")
            .flatMap((driver) => {
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
              supportedCoursesByOffice:
                driver.supportedCoursesByOffice ??
                (normalizeRegion(driver.office)
                  ? {
                      [normalizeRegion(driver.office)!]:
                        driver.supportedCourses ?? [],
                    }
                  : {}),
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
    setDailyCourseOverrides(
      loadData<DailyCourseOverrides>("unite-fleet-daily-course-overrides", {}),
    );
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
    saveData("unite-fleet-daily-course-overrides", dailyCourseOverrides);
  }, [dailyCourseOverrides, localDataReady]);

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

  const applyCoursePreset = (preset: "normal" | "weekday") => {
    // 通常版／曜日版は「月全体の基本パターン」。
    // 「コース変更」で保存した dailyCourseOverrides は絶対に消さず、
    // その日・その営業所だけ個別変更を優先する。
    setCoursePreset(preset);

    const [year, month] = autoMonth.split("-").map(Number);
    if (!year || !month) return;
    const lastDay = new Date(year, month, 0).getDate();

    setShiftsByDate((previous) => {
      const next = { ...previous };

      for (let day = 1; day <= lastDay; day += 1) {
        const date = `${autoMonth}-${String(day).padStart(2, "0")}`;
        const currentDay =
          next[date] ?? ({ 松阪: [], 伊勢: [], 伊賀: [] } as Record<Region, Course[]>);

        const rebuilt = { ...currentDay };

        (["松阪", "伊勢", "伊賀"] as Region[]).forEach((region) => {
          // 手動の「その日だけコース変更」があれば最優先。
          // 無ければ、今回選んだ通常版／曜日版を使う。
          const names = resolveCourseNamesForDate(
            date,
            region,
            preset,
            dailyCourseOverrides[date]?.[region],
          );

          rebuilt[region] = names.map((name, index) => {
            const existing = currentDay[region]?.find(
              (course) => course.course === name,
            );
            // 同じコースが残る場合は、手動配置済みドライバー等も保持。
            return existing ?? createCourse(Date.now() + day * 100 + index, name);
          });
        });

        next[date] = rebuilt;
      }

      return next;
    });

    setAutoMessage(
      preset === "normal"
        ? "通常版を月全体に反映しました。個別に変更した日のコースは保持しています。"
        : "曜日版を月全体に反映しました。個別に変更した日のコースは保持しています。",
    );
  };

  const selectableCourseNames = Array.from(
    new Set([
      ...NORMAL_COURSE_NAMES[activeTab],
      ...courseSettings
        .filter((setting) => setting.region === activeTab)
        .map((setting) => setting.name),
      ...(activeTab === "松阪"
        ? ["ABコース", "BCコース", "CDコース"]
        : []),
      ...(activeTab === "伊勢"
        ? ["神久・朝熊コース", "御薗・高向コース"]
        : []),
    ]),
  );

  const openCourseChange = () => {
    setCourseChangeSelection(
      coursesByRegion[activeTab].map((course) => course.course),
    );
    setCourseChangeOpen(true);
  };

  const applyDailyCourseChange = () => {
    if (courseChangeSelection.length === 0) {
      setAutoMessage("必要なコースを1つ以上選択してください。");
      return;
    }

    const orderedNames = selectableCourseNames.filter((name) =>
      courseChangeSelection.includes(name),
    );
    setDailyCourseOverrides((previous) => ({
      ...previous,
      [selectedDate]: {
        ...(previous[selectedDate] ?? {}),
        [activeTab]: orderedNames,
      },
    }));
    setCoursesByRegion((previous) => ({
      ...previous,
      [activeTab]: orderedNames.map((name, index) => {
        const existing = previous[activeTab].find(
          (course) => course.course === name,
        );
        return existing ?? createCourse(Date.now() + index, name);
      }),
    }));
    setCourseChangeOpen(false);
    setAutoMessage(
      `${selectedDate} ${activeTab}のコースを変更しました。この日だけに適用されます。`,
    );
  };

  const generateMonthlyShifts = async () => {
    const [year, month] = autoMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
        setAutoMessage("登録済みの希望休を読み込み中...");

    const { data: dayOffRows, error: dayOffError } = await supabase
      .from("shift_day_off_requests")
      .select("driver_name,requested_date")
      .eq("target_month", autoMonth);

    if (dayOffError) {
          const { data: priorityRows, error: priorityError } = await supabase
      .from("shift_driver_settings")
      .select("driver_name,course_priorities");

    if (priorityError) {
      setAutoMessage(
        `コース優先順位の読込エラー：${priorityError.message}`
      );
      return;
    }
      setAutoMessage(`希望休の読込エラー：${dayOffError.message}`);
      return;
    }
    const { data: priorityRows, error: priorityError } =
  await supabase
    .from("shift_driver_settings")
    .select("driver_name, course_priorities");

if (priorityError) {
  setAutoMessage(
    `コース優先順位の読込エラー：${priorityError.message}`
  );
  return;
}
    const coursePriorityMap = new Map<
  string,
  Array<{ office: string; course: string }>
>();

(priorityRows ?? []).forEach(
  (row: {
    driver_name: string;
    course_priorities: unknown;
  }) => {
    const priorities = (
      Array.isArray(row.course_priorities)
        ? row.course_priorities
        : []
    ) as Array<{ office: string; course: string }>;

    coursePriorityMap.set(
      normalizeDriverName(row.driver_name),
      priorities
    );
  }
);
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
coursePriorityMap.forEach((priorities, normalizedName) => {
  const driver = uniqueDrivers.find(
    (item) =>
      normalizeDriverName(item.name) === normalizedName
  );

  if (!driver) return;

  const regions =
    eligibleRegions.get(driver.name) ?? new Set<Region>();

  priorities.forEach((priority) => {
    const region = priority.office.replace(
      "営業所",
      ""
    ) as Region;

    if (
      region === "松阪" ||
      region === "伊勢" ||
      region === "伊賀"
    ) {
      regions.add(region);
    }
  });

  eligibleRegions.set(driver.name, regions);
});
    const configuredCoursesForRegion = (
      driverName: string,
      region: Region,
    ) =>
      (coursePriorityMap.get(normalizeDriverName(driverName)) ?? []).filter(
        (priority) => priority.office.replace("営業所", "") === region,
      );

    const isConfiguredCourse = (
      driverName: string,
      region: Region,
      courseName: string,
    ) => {
      const driver = uniqueDrivers.find(
        (item) =>
          normalizeDriverName(item.name) === normalizeDriverName(driverName),
      );
      if (!driver || driver.mainArea === region) return true;

      const configuredCourses = configuredCoursesForRegion(driverName, region);
      if (configuredCourses.length === 0) return true;
      return canDriveCourse(
        configuredCourses.map((priority) => priority.course),
        courseName,
      );
    };
    const requiredCourseCountByRegion = new Map<Region, number>(
      (["松阪", "伊勢", "伊賀"] as Region[]).map((region) => [
        region,
        (() => {
          let total = 0;
          for (let day = 1; day <= lastDay; day += 1) {
            const date = `${autoMonth}-${String(day).padStart(2, "0")}`;
            total += resolveCourseNamesForDate(
              date,
              region,
              coursePreset,
              dailyCourseOverrides[date]?.[region],
            ).length;
          }
          return total;
        })(),
      ]),
    );

    // ===== 301自動バランス =====
    // 301で入力したメイン営業所の日数は減らさない。
    // 営業所の必要コース数に不足がある場合だけ、サブ営業所へ「追加」して埋める。
    // その際、全営業所合計が24日前後になる人を最優先にして応援を満遍なく散らす。
    const generationTargetWorkDays = new Map<string, number>();
    const generationTargetKey = (region: Region, driverName: string) =>
      `${region}|${normalizeDriverName(driverName)}`;

    const regionsForGeneration: Region[] = ["松阪", "伊勢", "伊賀"];

    uniqueDrivers.forEach((driver) => {
      regionsForGeneration.forEach((region) => {
        generationTargetWorkDays.set(
          generationTargetKey(region, driver.name),
          getTargetWorkDays(autoMonth, region, driver.name) ?? 0,
        );
      });
    });

    const getGenerationTargetWorkDays = (
      region: Region,
      driverName: string,
    ) =>
      generationTargetWorkDays.get(
        generationTargetKey(region, driverName),
      ) ?? 0;

    const getGenerationTotalTarget = (driverName: string) =>
      regionsForGeneration.reduce(
        (sum, region) =>
          sum + getGenerationTargetWorkDays(region, driverName),
        0,
      );

    const autoSupportMoves: Array<{
      driverName: string;
      region: Region;
      addedDays: number;
    }> = [];

    regionsForGeneration.forEach((targetRegion) => {
      const required = requiredCourseCountByRegion.get(targetRegion) ?? 0;
      let specified = uniqueDrivers.reduce(
        (sum, driver) =>
          sum + getGenerationTargetWorkDays(targetRegion, driver.name),
        0,
      );
      let deficit = Math.max(0, required - specified);
      if (deficit <= 0) return;

      // その営業所で実際に必要になるコース一覧。
      const monthlyCourses = new Set<string>();
      for (let day = 1; day <= lastDay; day += 1) {
        const date = `${autoMonth}-${String(day).padStart(2, "0")}`;
        resolveCourseNamesForDate(
          date,
          targetRegion,
          coursePreset,
          dailyCourseOverrides[date]?.[targetRegion],
        ).forEach((courseName) => monthlyCourses.add(courseName));
      }

      // まず24日まで。足りなければ25日、それでも不足なら26日まで使う。
      // メイン営業所の日数は一切減らさず、応援日だけ追加する。
      for (const softCap of [24, 25, 26]) {
        while (deficit > 0) {
          const candidates = uniqueDrivers
            .filter((driver) => {
              const rawMain =
                driver.mainArea ?? driver.area.replace("営業所", "");
              const mainRegion: Region =
                rawMain === "伊勢" || rawMain === "伊賀"
                  ? rawMain
                  : "松阪";

              if (mainRegion === targetRegion) return false;
              if (!getDriverOfficeTabs(driver).includes(targetRegion))
                return false;
              if (driver.assignmentMode === "自動除外") return false;
              if (getGenerationTotalTarget(driver.name) >= softCap)
                return false;

              // 登録されている担当可能コースで、実際の月間コースを
              // 1つ以上担当できる人だけ応援候補にする。
              return Array.from(monthlyCourses).some((courseName) =>
                canDriverHandleCourse(driver, targetRegion, courseName),
              );
            })
            .sort((a, b) => {
              // 合計出勤日数が少ない人から24日前後へ近づける。
              const totalDiff =
                getGenerationTotalTarget(a.name) -
                getGenerationTotalTarget(b.name);
              if (totalDiff !== 0) return totalDiff;

              // 対応できるコースが多い人を優先。
              const coverage = (driver: DriverItem) =>
                Array.from(monthlyCourses).filter((courseName) =>
                  canDriverHandleCourse(driver, targetRegion, courseName),
                ).length;
              const coverageDiff = coverage(b) - coverage(a);
              if (coverageDiff !== 0) return coverageDiff;

              // 既に応援を多く付けた人へ偏らせない。
              const aSupport = regionsForGeneration
                .filter((region) => region !== a.mainArea)
                .reduce(
                  (sum, region) =>
                    sum + getGenerationTargetWorkDays(region, a.name),
                  0,
                );
              const bSupport = regionsForGeneration
                .filter((region) => region !== b.mainArea)
                .reduce(
                  (sum, region) =>
                    sum + getGenerationTargetWorkDays(region, b.name),
                  0,
                );
              return aSupport - bSupport;
            });

          const selected = candidates[0];
          if (!selected) break;

          generationTargetWorkDays.set(
            generationTargetKey(targetRegion, selected.name),
            getGenerationTargetWorkDays(targetRegion, selected.name) + 1,
          );

          const existingMove = autoSupportMoves.find(
            (move) =>
              normalizeDriverName(move.driverName) ===
                normalizeDriverName(selected.name) &&
              move.region === targetRegion,
          );
          if (existingMove) existingMove.addedDays += 1;
          else
            autoSupportMoves.push({
              driverName: selected.name,
              region: targetRegion,
              addedDays: 1,
            });

          deficit -= 1;
          specified += 1;
        }
        if (deficit <= 0) break;
      }
    });

    // 自動応援追加後に必要コース数まで301が埋まった営業所は、
    // その日数を月間目標として厳格に使う。
    const targetPlanCompleteByRegion = new Map<Region, boolean>(
      regionsForGeneration.map((region) => {
        const targetTotal = uniqueDrivers.reduce(
          (sum, driver) =>
            sum + getGenerationTargetWorkDays(region, driver.name),
          0,
        );
        return [
          region,
          targetTotal > 0 &&
            targetTotal === (requiredCourseCountByRegion.get(region) ?? 0),
        ];
      }),
    );

    const searchSeed = Date.now();
    const trialCount = 200;
    let bestGenerated: ShiftsByDate | null = null;
    let bestUnassignedCount = Number.POSITIVE_INFINITY;
    let bestDuplicateCount = Number.POSITIVE_INFINITY;
    let bestSevenDayStreakCount = Number.POSITIVE_INFINITY;
    let bestScore = Number.POSITIVE_INFINITY;
    let bestTrial = 1;

    const variationScore = (
      driverName: string,
      date: string,
      courseName: string,
      trial: number,
    ) => {
      // 1回目は基準どおり、2回目以降は候補順を十分に入れ替えて
      // 月末まで含めた別パターンを実際に探索する。
      if (trial === 0) return 0;
      const value = `${searchSeed}-${trial}-${date}-${courseName}-${driverName}`;
      let hash = 0;
      for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
      }
      return hash % 2001;
    };

    for (let trial = 0; trial < trialCount; trial += 1) {
      const workCounts = new Map<string, number>();
      const regionalWorkCounts = new Map<string, number>();
      const regionalCountKey = (region: Region, driverName: string) =>
        `${region}|${normalizeDriverName(driverName)}`;
      const streaks = new Map<string, number>();
      const generated: ShiftsByDate = {};
      let unassignedCount = 0;

      // サブ営業所の未配置を防ぐための例外判定。
      // 営業所別301目標に到達していても、全営業所合算の実稼働がまだ目標未満なら
      // 担当可能なサブ営業所へ応援として配置できるようにする。
      // 例: 横溝20日 / 楠滝17日 / 徳田22日なら、伊勢の担当可能コースへ優先的に回せる。
      const canAddSupportBeyondRegionalTarget = (
        driver: DriverItem,
        region: Region,
      ) => {
        if (driver.mainArea === region) return false;

        const configuredMaximum =
          parsedConditions.get(driver.name)?.maximumWorkDays;
        const desiredTotal =
          configuredMaximum ?? Math.max(24, getGenerationTotalTarget(driver.name));
        const actualTotal = workCounts.get(driver.name) ?? 0;

        return actualTotal < desiredTotal;
      };

        const registeredDaysOff = new Map<string, Set<string>>();

    (dayOffRows ?? []).forEach((row) => {
      const name = normalizeDriverName(String(row.driver_name));
      const dates = registeredDaysOff.get(name) ?? new Set<string>();

      dates.add(String(row.requested_date).slice(0, 10));
      registeredDaysOff.set(name, dates);
    });
    const firstDayOfMonth = new Date(year, month - 1, 1);

    getUniqueDrivers().forEach((driver) => {
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
      const monthlyMatch = compact.match(
        /月(?:に)?(\d+)(?:日|日間)?休(?:み|日)?/,
      );
      const weeklyCountMatch = compact.match(
        /週(?:に)?(\d+)(?:日|日間)?休(?:み|日)?/,
      );
      const maximumWorkMatch = compact.match(
        /月(?:間)?(?:に)?(\d+)(?:日)?以下(?:出勤|稼働)/,
      );
      const monthlyDaysOff = monthlyMatch
        ? Number(monthlyMatch[1])
        : weeklyCountMatch
          ? Number(weeklyCountMatch[1]) * 4
          : undefined;
      const maximumWorkDays = maximumWorkMatch
        ? Number(maximumWorkMatch[1])
        : monthlyDaysOff !== undefined
          ? Math.max(0, lastDay - monthlyDaysOff)
          : undefined;
            const specificDays = new Set<number>();
      const weeklyDaysOff = new Set<number>();
      const requiredWorkDays = new Set<number>();

      // 例：「月曜日以外出勤」＝ 月曜を休み、火〜日を原則出勤必須として扱う。
      for (const match of compact.matchAll(
        /([日月火水木金土])曜(?:日)?以外(?:は)?(?:出勤|稼働)/g,
      )) {
        const offWeekday = weekdayNumbers[match[1]];
        weeklyDaysOff.add(offWeekday);
        for (let weekday = 0; weekday <= 6; weekday += 1) {
          if (weekday !== offWeekday) requiredWorkDays.add(weekday);
        }
      }

      for (const match of compact.matchAll(
        /(?:毎週)?([日月火水木金土])曜(?:日)?(?:は)?休/g,
      )) {
        weeklyDaysOff.add(weekdayNumbers[match[1]]);
      }

      if (/土日休/.test(compact)) {
        weeklyDaysOff.add(0);
        weeklyDaysOff.add(6);
      }

      return {
        monthlyDaysOff,
        maximumWorkDays,
        specificDays,
        weeklyDaysOff,
        requiredWorkDays,
      };
    };

    const parsedConditions = new Map(
      uniqueDrivers.map((driver) => [
        driver.name,
        parseDriverCondition(driver.name),
      ]),
    );

    const shouldBalanceDriver = (driver: DriverItem) => {
      if (
        driver.assignmentMode === "自動除外" ||
        driver.assignmentMode === "最終候補"
      ) {
        return false;
      }
      const condition = parsedConditions.get(driver.name);
      const hasFixedDayOff =
        (fixedDaysOff[driver.name] ?? []).length > 0 ||
        (condition?.weeklyDaysOff.size ?? 0) > 0;
      const hasRequestedDaysCount =
        condition?.maximumWorkDays !== undefined;
      const hasRequiredWorkDays =
        (condition?.requiredWorkDays.size ?? 0) > 0;

      return !hasFixedDayOff && !hasRequestedDaysCount && !hasRequiredWorkDays;
    };

    const requestedOff = (name: string, day: number, weekday: number) => {
      const condition = parsedConditions.get(name);
      return Boolean(
                registeredDaysOff
          .get(normalizeDriverName(name))
          ?.has(`${autoMonth}-${String(day).padStart(2, "0")}`) ||
        condition?.specificDays.has(day) ||
        condition?.weeklyDaysOff.has(weekday) ||
        (fixedDaysOff[name] ?? []).includes(weekday),
      );
    };

    const requiredToWork = (
      name: string,
      day: number,
      weekday: number,
    ) => {
      // 個別の希望休・固定休がある日は「出勤必須」より休みを優先。
      if (requestedOff(name, day, weekday)) return false;
      return Boolean(
        parsedConditions.get(name)?.requiredWorkDays.has(weekday),
      );
    };

    for (let day = 1; day <= lastDay; day += 1) {
      const date = `${autoMonth}-${String(day).padStart(2, "0")}`;
      const weekday = new Date(`${date}T00:00:00`).getDay();
      const courses = createCoursesFromSettings(date, courseSettings);

      (Object.keys(courses) as Region[]).forEach((region, regionIndex) => {
        const courseNames = resolveCourseNamesForDate(
          date,
          region,
          coursePreset,
          dailyCourseOverrides[date]?.[region],
        );

        courses[region] = courseNames.map((courseName, courseIndex) => {
          const existingCourse = courses[region].find(
            (course) => course.course === courseName,
          );

          return (
            existingCourse ??
            createCourse(
              Date.now() + day * 100 + regionIndex * 10 + courseIndex,
              courseName,
            )
          );
        });
      });
      const assignedToday = new Set<string>();

      (Object.keys(courses) as Region[]).forEach((region) => {
        courses[region] = courses[region].map((course) => {
          const locked = shiftsByDate[date]?.[region]?.find(
            (existing) =>
              existing.course === course.course && existing.isLocked,
          );
          if (locked?.driver) {
            assignedToday.add(locked.driver);
            return locked;
          }
          return course;
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
            if (
              driver.assignmentMode === "自動除外" &&
              normalizeDriverName(driver.name) !==
                normalizeDriverName("清水 國光")
            )
              return false;
            if (
              driver.assignmentMode === "応援のみ" &&
              driver.mainArea === region
            )
              return false;
            // メイン/サブ営業所に属しているだけでは不可。
            // この営業所の「このコース」が担当可能として登録済みの人だけ候補にする。
            if (!canDriverHandleCourse(driver, region, course.course))
              return false;
            if (!isConfiguredCourse(driver.name, region, course.course))
              return false;
            if (!fixedCourseMatches(driver.fixedCourse, course.course))
              return false;
            if (assignedToday.has(driver.name)) return false;
            if (requestedOff(driver.name, day, weekday)) return false;
            if (targetPlanCompleteByRegion.get(region)) {
              const target = getGenerationTargetWorkDays(
                region,
                driver.name,
              ) ?? 0;
              const currentRegionalCount =
                regionalWorkCounts.get(
                  regionalCountKey(region, driver.name),
                ) ?? 0;
              if (
                currentRegionalCount >= target &&
                !canAddSupportBeyondRegionalTarget(driver, region)
              )
                return false;
            }
            const maximumWorkDays = parsedConditions.get(
              driver.name,
            )?.maximumWorkDays;
            if (maximumWorkDays !== undefined) {
              if ((workCounts.get(driver.name) ?? 0) >= maximumWorkDays)
                return false;
            }
            if ((streaks.get(driver.name) ?? 0) >= 6) return false;
            if (driver.name === "東 真規")
              return (
                weekday !== 1 &&
                (course.course === "神久コース" ||
                  course.course === "神久・朝熊コース")
              );
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
            if (course.isLocked && course.driver) return course;
            const courseSetting = courseSettings.find(
              (setting) =>
                setting.region === region && setting.name === course.course,
            );
            const regionalDrivers = uniqueDrivers.filter((driver) =>
              eligibleRegions.get(driver.name)?.has(region),
            );
            const unavailableReasons = (driver: DriverItem) => {
              const reasons: string[] = [];
              if (
                driver.assignmentMode === "自動除外" &&
                normalizeDriverName(driver.name) !==
                  normalizeDriverName("清水 國光")
              )
                reasons.push("自動除外");
              if (
                driver.assignmentMode === "応援のみ" &&
                driver.mainArea === region
              )
                reasons.push("応援先限定");
              if (!canDriverHandleCourse(driver, region, course.course))
                reasons.push("対応コース外");
              if (!isConfiguredCourse(driver.name, region, course.course))
                reasons.push("優先コース外");
              if (!fixedCourseMatches(driver.fixedCourse, course.course))
                reasons.push("別コース固定");
              if (assignedToday.has(driver.name))
                reasons.push("別コース配置済み");
              if (requestedOff(driver.name, day, weekday))
                reasons.push("希望・固定休");
              if (targetPlanCompleteByRegion.get(region)) {
                const target = getGenerationTargetWorkDays(
                              region,
                              driver.name,
                            ) ?? 0;
                const currentRegionalCount =
                  regionalWorkCounts.get(
                    regionalCountKey(region, driver.name),
                  ) ?? 0;
                if (
                  currentRegionalCount >= target &&
                  !canAddSupportBeyondRegionalTarget(driver, region)
                )
                  reasons.push("指定出勤日数到達");
              }
              const maximumWorkDays = parsedConditions.get(
                driver.name,
              )?.maximumWorkDays;
              if (maximumWorkDays !== undefined) {
                if ((workCounts.get(driver.name) ?? 0) >= maximumWorkDays)
                  reasons.push("月間出勤上限");
              }
              if ((streaks.get(driver.name) ?? 0) >= 6)
                reasons.push("7連勤防止");
              if (driver.name === "東 真規" && weekday === 1)
                reasons.push("月曜固定休");
              if (driver.name === "中川 昭治" && weekday === 4)
                reasons.push("木曜固定休");
              if (
                driver.name === "東 真規" &&
                course.course !== "神久コース" &&
                course.course !== "神久・朝熊コース"
              )
                reasons.push("神久固定");
              if (driver.name === "中川 昭治" && course.course !== "Hコース")
                reasons.push("H固定");
              return reasons;
            };

            const eligibleCandidates = regionalDrivers.filter(
              (driver) => unavailableReasons(driver).length === 0,
            );
            const regularCandidates = eligibleCandidates.filter(
              (driver) =>
                normalizeDriverName(driver.name) !==
                normalizeDriverName("清水 國光"),
            );

            // 通常ドライバーは「全営業所合算の実稼働」が目標未満の人を最優先。
            // 特にサブ営業所では、横溝・楠滝・徳田などに余裕がある間は
            // 清水國光さんを候補へ入れない。
            const underTargetRegularCandidates = regularCandidates.filter((driver) => {
              const configuredMaximum =
                parsedConditions.get(driver.name)?.maximumWorkDays;
              const desiredTotal =
                configuredMaximum ?? Math.max(24, getGenerationTotalTarget(driver.name));
              return (workCounts.get(driver.name) ?? 0) < desiredTotal;
            });

            // 候補の段階を明確に分離する。
            // 1) 24日前後へ届いていない通常ドライバー
            // 2) その他の通常ドライバー
            // 3) それでも誰もいない時だけ清水國光
            const candidatePool =
              underTargetRegularCandidates.length > 0
                ? underTargetRegularCandidates
                : regularCandidates.length > 0
                  ? regularCandidates
                  : eligibleCandidates;

            const candidates = candidatePool
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
                      const priorityIndex = (
  coursePriorityMap.get(
    normalizeDriverName(driver.name)
  ) ?? []
).findIndex(
  (priority) =>
    priority.office === `${region}営業所` &&
    priority.course.replace(/コース$/, "") ===
      course.course.replace(/コース$/, "")
);

const coursePriorityPenalty =
  priorityIndex === -1
    ? 1000
    : priorityIndex * 100;
                  const reservePenalty =
                    driver.name === "清水 國光" ? 10000 : 0;
                  const assignmentPenalty =
                    driver.assignmentMode === "最終候補"
                      ? 5000
                      : driver.assignmentMode === "応援のみ"
                        ? 250
                        : 0;
                  const supportOfficePenalty =
                    driver.mainArea !== region
                      ? targetPlanCompleteByRegion.get(region)
                        ? 300
                        : 3000
                      : 0;
                  const driverFixedPriority =
                    driver.fixedCourse === course.course ? -2000 : 0;
                  // 「○曜日以外出勤」の日は、担当可能コースがある限り
                  // 他の通常ドライバーより必ず先に配置する。
                  const requiredWorkPriority = requiredToWork(
                    driver.name,
                    day,
                    weekday,
                  )
                    ? -50000
                    : 0;
                  const fairnessPenalty = shouldBalanceDriver(driver)
                    ? (() => {
                        const actualTotal = workCounts.get(driver.name) ?? 0;
                        const configuredMaximum =
                          parsedConditions.get(driver.name)?.maximumWorkDays;
                        const desiredTotal =
                          configuredMaximum ??
                          Math.max(24, getGenerationTotalTarget(driver.name));
                        const shortage = Math.max(0, desiredTotal - actualTotal);

                        // 稼働が少ない人ほど強く優先する。
                        // サブ営業所では不足日数の大きい人をさらに優先して、
                        // 横溝・楠滝・徳田などの余裕日数を応援へ回す。
                        return (
                          actualTotal * 100 -
                          shortage * (driver.mainArea !== region ? 2200 : 900)
                        );
                      })()
                    : 0;

                  // 301方式で日数が確定している営業所では、
                  // 「真田25日」などの指定日数を月初から使い切らず、
                  // 今日までに進んでいるべき日数との差で月全体へ散らす。
                  const targetDaysForRegion =
                    targetPlanCompleteByRegion.get(region)
                      ? (getGenerationTargetWorkDays(
                          region,
                          driver.name,
                        ) ?? 0)
                      : undefined;
                  const targetPacingPenalty =
                    targetDaysForRegion === undefined
                      ? 0
                      : (() => {
                          const currentRegionalCount =
                            regionalWorkCounts.get(
                              regionalCountKey(region, driver.name),
                            ) ?? 0;
                          const projectedRegionalCount =
                            currentRegionalCount + 1;
                          const expectedByToday =
                            (targetDaysForRegion * day) / lastDay;

                          // 予定より先行しすぎる配置を強く避ける。
                          const ahead = Math.max(
                            0,
                            projectedRegionalCount -
                              Math.ceil(expectedByToday),
                          );
                          // 予定より遅れている人は強く優先する。
                          // サブ営業所の応援者でも「伊勢4日」「伊勢6日」など
                          // 301で指定された日数へ届くようにする。
                          const behind = Math.max(
                            0,
                            Math.floor(expectedByToday) -
                              projectedRegionalCount,
                          );

                          const remainingTarget = Math.max(
                            0,
                            targetDaysForRegion - currentRegionalCount,
                          );
                          const remainingCalendarDays = lastDay - day + 1;

                          // 残り日数に対して目標残数が多いほど緊急度を上げる。
                          const urgency =
                            remainingTarget > 0
                              ? remainingTarget / Math.max(1, remainingCalendarDays)
                              : 0;

                          return (
                            ahead * 8000 -
                            behind * 20000 -
                            urgency * 12000
                          );
                        })();
                  // 「月8休み」「週2休み」などの休日数指定がある人を
                  // 月初に使い切らないよう、出勤可能日数を月全体へ配分する。
                  const maximumWorkDays =
                    parsedConditions.get(driver.name)?.maximumWorkDays;
                  const monthlyPacingPenalty =
                    maximumWorkDays === undefined
                      ? 0
                      : (() => {
                          const projectedWorkDays =
                            (workCounts.get(driver.name) ?? 0) + 1;
                          const expectedWorkDaysByToday =
                            (maximumWorkDays * day) / lastDay;
                          const daysAhead = Math.max(
                            0,
                            projectedWorkDays -
                              Math.ceil(expectedWorkDaysByToday),
                          );
                          return daysAhead * 1500;
                        })();
                  return (
                    fixedPriority +
                    driverFixedPriority +
                    requiredWorkPriority +
                    coursePriorityPenalty +
                    reservePenalty +
                    assignmentPenalty +
                    supportOfficePenalty +
                    fairnessPenalty +
                    targetPacingPenalty +
                    monthlyPacingPenalty +
                    variationScore(
                      driver.name,
                      date,
                      course.course,
                      trial,
                    )
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
            regionalWorkCounts.set(
              regionalCountKey(region, selected.name),
              (regionalWorkCounts.get(
                regionalCountKey(region, selected.name),
              ) ?? 0) + 1,
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

      getUniqueDrivers().forEach((driver: DriverItem) => {
        streaks.set(
          driver.name,
          assignedToday.has(driver.name)
            ? (streaks.get(driver.name) ?? 0) + 1
            : 0,
        );
      });
      generated[date] = courses;
    }
      // ─────────────────────────────────────────────────────────────
      // 自動修復パス
      // まず作ったシフトの未配置を、同日内の「直接配置 → 2人交換 → 3人連鎖交換」
      // で埋め直す。手動で入れ替えれば埋まるケースを自動で探索する。
      // ─────────────────────────────────────────────────────────────
      const rebuildAssignedToday = (dateKey: string) => {
        const names = new Set<string>();
        Object.values(generated[dateKey] ?? {})
          .flat()
          .forEach((course) => {
            if (course.driver) names.add(course.driver);
          });
        return names;
      };

      const findDriver = (name: string) =>
        uniqueDrivers.find(
          (driver) =>
            normalizeDriverName(driver.name) === normalizeDriverName(name),
        );

      const canUseOnRepair = (
        driver: DriverItem,
        region: Region,
        courseName: string,
        day: number,
        weekday: number,
        assignedNames: Set<string>,
        ignoreNames: Set<string> = new Set(),
      ) => {
        if (
          assignedNames.has(driver.name) &&
          !ignoreNames.has(driver.name)
        )
          return false;
        if (requestedOff(driver.name, day, weekday)) return false;
        if (!canDriverHandleCourse(driver, region, courseName)) return false;
        if (!isConfiguredCourse(driver.name, region, courseName)) return false;
        if (!fixedCourseMatches(driver.fixedCourse, courseName)) return false;

        if (driver.name === "東 真規" && weekday === 1) return false;
        if (driver.name === "中川 昭治" && weekday === 4) return false;
        if (
          driver.name === "東 真規" &&
          courseName !== "神久コース" &&
          courseName !== "神久・朝熊コース"
        )
          return false;
        if (driver.name === "中川 昭治" && courseName !== "Hコース")
          return false;

        const maximumWorkDays =
          parsedConditions.get(driver.name)?.maximumWorkDays;
        if (
          maximumWorkDays !== undefined &&
          (workCounts.get(driver.name) ?? 0) >= maximumWorkDays &&
          !ignoreNames.has(driver.name)
        )
          return false;

        if (targetPlanCompleteByRegion.get(region)) {
          const target =
            getGenerationTargetWorkDays(region, driver.name) ?? 0;
          const actual =
            regionalWorkCounts.get(
              regionalCountKey(region, driver.name),
            ) ?? 0;
          if (
            actual >= target &&
            !ignoreNames.has(driver.name) &&
            !canAddSupportBeyondRegionalTarget(driver, region)
          )
            return false;
        }

        return true;
      };

      const addRepairCount = (region: Region, name: string, amount: number) => {
        workCounts.set(name, (workCounts.get(name) ?? 0) + amount);
        regionalWorkCounts.set(
          regionalCountKey(region, name),
          (regionalWorkCounts.get(regionalCountKey(region, name)) ?? 0) +
            amount,
        );
      };

      // 未配置を複数周回する。1件直すことで別の未配置が直せることがある。
      for (let repairPass = 0; repairPass < 4; repairPass += 1) {
        let repairedThisPass = 0;

        for (let repairDay = 1; repairDay <= lastDay; repairDay += 1) {
          const dateKey =
            `${autoMonth}-${String(repairDay).padStart(2, "0")}`;
          const weekday = new Date(`${dateKey}T00:00:00`).getDay();

          for (const region of ["松阪", "伊勢", "伊賀"] as Region[]) {
            const dayCourses = generated[dateKey]?.[region] ?? [];

            for (
              let targetIndex = 0;
              targetIndex < dayCourses.length;
              targetIndex += 1
            ) {
              const targetCourse = dayCourses[targetIndex];
              if (targetCourse.driver) continue;

              const assignedNames = rebuildAssignedToday(dateKey);
              const regionalDrivers = uniqueDrivers.filter((driver) =>
                eligibleRegions.get(driver.name)?.has(region),
              );

              // ① 直接配置
              const direct = regionalDrivers
                .filter((driver) =>
                  canUseOnRepair(
                    driver,
                    region,
                    targetCourse.course,
                    repairDay,
                    weekday,
                    assignedNames,
                  ),
                )
                .sort((a, b) => {
                  const aTarget =
                    getGenerationTargetWorkDays(region, a.name) ?? 0;
                  const bTarget =
                    getGenerationTargetWorkDays(region, b.name) ?? 0;
                  const aActual =
                    regionalWorkCounts.get(
                      regionalCountKey(region, a.name),
                    ) ?? 0;
                  const bActual =
                    regionalWorkCounts.get(
                      regionalCountKey(region, b.name),
                    ) ?? 0;
                  return bTarget - bActual - (aTarget - aActual);
                })[0];

              if (direct) {
                dayCourses[targetIndex] = {
                  ...targetCourse,
                  driver: direct.name,
                  status: "配車済" as const,
                  memo: "自動修復：直接配置",
                };
                addRepairCount(region, direct.name, 1);
                repairedThisPass += 1;
                continue;
              }

              // ② 同日の2人交換
              let repaired = false;
              for (
                let occupiedIndex = 0;
                occupiedIndex < dayCourses.length && !repaired;
                occupiedIndex += 1
              ) {
                if (occupiedIndex === targetIndex) continue;
                const occupied = dayCourses[occupiedIndex];
                if (!occupied.driver) continue;

                const movedDriver = findDriver(occupied.driver);
                if (!movedDriver) continue;

                const ignoreMoved = new Set([movedDriver.name]);
                if (
                  !canUseOnRepair(
                    movedDriver,
                    region,
                    targetCourse.course,
                    repairDay,
                    weekday,
                    assignedNames,
                    ignoreMoved,
                  )
                )
                  continue;

                const replacement = regionalDrivers.find((candidate) => {
                  if (
                    normalizeDriverName(candidate.name) ===
                    normalizeDriverName(movedDriver.name)
                  )
                    return false;
                  return canUseOnRepair(
                    candidate,
                    region,
                    occupied.course,
                    repairDay,
                    weekday,
                    assignedNames,
                    ignoreMoved,
                  );
                });

                if (!replacement) continue;

                dayCourses[targetIndex] = {
                  ...targetCourse,
                  driver: movedDriver.name,
                  status: "配車済" as const,
                  memo: "自動修復：2人交換",
                };
                dayCourses[occupiedIndex] = {
                  ...occupied,
                  driver: replacement.name,
                  status: "配車済" as const,
                  memo: "自動修復：2人交換",
                };

                addRepairCount(region, replacement.name, 1);
                repairedThisPass += 1;
                repaired = true;
              }
              if (repaired) continue;

              // ③ 同日の3人連鎖交換
              for (
                let firstIndex = 0;
                firstIndex < dayCourses.length && !repaired;
                firstIndex += 1
              ) {
                if (firstIndex === targetIndex) continue;
                const firstCourse = dayCourses[firstIndex];
                if (!firstCourse.driver) continue;
                const firstDriver = findDriver(firstCourse.driver);
                if (!firstDriver) continue;

                const ignoreFirst = new Set([firstDriver.name]);
                if (
                  !canUseOnRepair(
                    firstDriver,
                    region,
                    targetCourse.course,
                    repairDay,
                    weekday,
                    assignedNames,
                    ignoreFirst,
                  )
                )
                  continue;

                for (
                  let secondIndex = 0;
                  secondIndex < dayCourses.length && !repaired;
                  secondIndex += 1
                ) {
                  if (
                    secondIndex === targetIndex ||
                    secondIndex === firstIndex
                  )
                    continue;
                  const secondCourse = dayCourses[secondIndex];
                  if (!secondCourse.driver) continue;
                  const secondDriver = findDriver(secondCourse.driver);
                  if (!secondDriver) continue;

                  const ignoreTwo = new Set([
                    firstDriver.name,
                    secondDriver.name,
                  ]);

                  if (
                    !canUseOnRepair(
                      secondDriver,
                      region,
                      firstCourse.course,
                      repairDay,
                      weekday,
                      assignedNames,
                      ignoreTwo,
                    )
                  )
                    continue;

                  const third = regionalDrivers.find((candidate) => {
                    if (
                      ignoreTwo.has(candidate.name)
                    )
                      return false;
                    return canUseOnRepair(
                      candidate,
                      region,
                      secondCourse.course,
                      repairDay,
                      weekday,
                      assignedNames,
                      ignoreTwo,
                    );
                  });

                  if (!third) continue;

                  dayCourses[targetIndex] = {
                    ...targetCourse,
                    driver: firstDriver.name,
                    status: "配車済" as const,
                    memo: "自動修復：3人連鎖",
                  };
                  dayCourses[firstIndex] = {
                    ...firstCourse,
                    driver: secondDriver.name,
                    status: "配車済" as const,
                    memo: "自動修復：3人連鎖",
                  };
                  dayCourses[secondIndex] = {
                    ...secondCourse,
                    driver: third.name,
                    status: "配車済" as const,
                    memo: "自動修復：3人連鎖",
                  };

                  addRepairCount(region, third.name, 1);
                  repairedThisPass += 1;
                  repaired = true;
                }
              }
            }

            generated[dateKey][region] = dayCourses;
          }
        }

        if (repairedThisPass === 0) break;
      }


      // ─────────────────────────────────────────────────────────────
      // ④ 301を守ったまま「別日交換」で未配置を修復
      //
      // 例：
      //   8/31 の未配置に Aさんを入れたいが、Aさんは301日数に到達済み
      //   → Aさんが別日に担当しているコースを探す
      //   → その別日を、301日数が1日不足している Bさんへ渡す
      //   → Aさんは8/31へ移動
      //
      // Aさんの出勤日数は ±0、Bさんは +1。
      // 未配置が1件ある分だけ不足している301日数を埋めるので、
      // 完了後も301の指定日数を崩さない。
      // ─────────────────────────────────────────────────────────────
      const driverWorksOnGeneratedDate = (
        driverName: string,
        dateKey: string,
      ) =>
        Object.values(generated[dateKey] ?? {})
          .flat()
          .some(
            (course) =>
              normalizeDriverName(course.driver) ===
              normalizeDriverName(driverName),
          );

      const wouldCreateSevenDayStreakAfterMove = (
        driverName: string,
        addDateKey: string,
        removeDateKey?: string,
      ) => {
        const [year, month] = autoMonth.split("-").map(Number);
        const last = new Date(year, month, 0).getDate();

        const works = (day: number) => {
          if (day < 1 || day > last) return false;
          const key = `${autoMonth}-${String(day).padStart(2, "0")}`;
          if (removeDateKey && key === removeDateKey) return false;
          if (key === addDateKey) return true;
          return driverWorksOnGeneratedDate(driverName, key);
        };

        let streak = 0;
        for (let day = 1; day <= last; day += 1) {
          streak = works(day) ? streak + 1 : 0;
          if (streak >= 7) return true;
        }
        return false;
      };

      const canTakeCrossDayCourse = (
        driver: DriverItem,
        region: Region,
        courseName: string,
        dateKey: string,
      ) => {
        const day = Number(dateKey.slice(-2));
        const weekday = new Date(`${dateKey}T00:00:00`).getDay();

        if (!eligibleRegions.get(driver.name)?.has(region)) return false;
        if (
          driver.assignmentMode === "自動除外" &&
          normalizeDriverName(driver.name) !==
            normalizeDriverName("清水 國光")
        )
          return false;
        if (
          driver.assignmentMode === "応援のみ" &&
          driver.mainArea === region
        )
          return false;
        if (requestedOff(driver.name, day, weekday)) return false;
        if (!canDriverHandleCourse(driver, region, courseName)) return false;
        if (!isConfiguredCourse(driver.name, region, courseName)) return false;
        if (!fixedCourseMatches(driver.fixedCourse, courseName)) return false;

        if (driver.name === "東 真規" && weekday === 1) return false;
        if (
          driver.name === "東 真規" &&
          courseName !== "神久コース" &&
          courseName !== "神久・朝熊コース"
        )
          return false;
        if (driver.name === "中川 昭治" && weekday === 4) return false;
        if (driver.name === "中川 昭治" && courseName !== "Hコース")
          return false;

        return true;
      };

      // 301が完成している営業所だけクロスデイ修復を行う。
      // 最大6周。1件直すたびに次の交換候補が増えることがある。
      for (let crossPass = 0; crossPass < 6; crossPass += 1) {
        let repairedCrossDay = 0;

        for (let targetDay = 1; targetDay <= lastDay; targetDay += 1) {
          const targetDate =
            `${autoMonth}-${String(targetDay).padStart(2, "0")}`;

          for (const region of ["松阪", "伊勢", "伊賀"] as Region[]) {
            if (!targetPlanCompleteByRegion.get(region)) continue;

            const targetCourses = generated[targetDate]?.[region] ?? [];

            for (
              let targetIndex = 0;
              targetIndex < targetCourses.length;
              targetIndex += 1
            ) {
              const targetCourse = targetCourses[targetIndex];
              if (targetCourse.driver) continue;

              const targetAssigned = rebuildAssignedToday(targetDate);
              let fixed = false;

              // A = 301日数に到達済みだが、未配置コースを担当できる人
              const moverCandidates = uniqueDrivers.filter((driver) => {
                if (targetAssigned.has(driver.name)) return false;
                if (!canTakeCrossDayCourse(
                  driver,
                  region,
                  targetCourse.course,
                  targetDate,
                ))
                  return false;

                const target =
                  getGenerationTargetWorkDays(region, driver.name) ?? 0;
                const actual =
                  regionalWorkCounts.get(
                    regionalCountKey(region, driver.name),
                  ) ?? 0;

                // 別日から移すので、現在ちょうど指定日数に達している人を対象にする。
                return target > 0 && actual === target;
              });

              for (const mover of moverCandidates) {
                if (fixed) break;

                // Aさんが同じ営業所で入っている別日を探す。
                for (let donorDay = 1; donorDay <= lastDay; donorDay += 1) {
                  if (donorDay === targetDay || fixed) continue;

                  const donorDate =
                    `${autoMonth}-${String(donorDay).padStart(2, "0")}`;
                  const donorCourses = generated[donorDate]?.[region] ?? [];

                  const donorIndex = donorCourses.findIndex(
                    (course) =>
                      normalizeDriverName(course.driver) ===
                      normalizeDriverName(mover.name) &&
                      !course.isLocked,
                  );
                  if (donorIndex < 0) continue;

                  const donorCourse = donorCourses[donorIndex];

                  // Aさんを donorDate → targetDate に動かした結果、
                  // 7連勤にならないことを確認。
                  if (
                    wouldCreateSevenDayStreakAfterMove(
                      mover.name,
                      targetDate,
                      donorDate,
                    )
                  )
                    continue;

                  // B = この営業所の301日数が不足している人。
                  // donorDate のAさんのコースを担当でき、donorDateは休みの人。
                  const replacementCandidates = uniqueDrivers
                    .filter((driver) => {
                      if (
                        normalizeDriverName(driver.name) ===
                        normalizeDriverName(mover.name)
                      )
                        return false;
                      if (driverWorksOnGeneratedDate(driver.name, donorDate))
                        return false;
                      if (
                        !canTakeCrossDayCourse(
                          driver,
                          region,
                          donorCourse.course,
                          donorDate,
                        )
                      )
                        return false;

                      const target =
                        getGenerationTargetWorkDays(region, driver.name) ?? 0;
                      const actual =
                        regionalWorkCounts.get(
                          regionalCountKey(region, driver.name),
                        ) ?? 0;

                      if (
                        actual >= target &&
                        !canAddSupportBeyondRegionalTarget(driver, region)
                      )
                        return false;

                      const maximumWorkDays =
                        parsedConditions.get(driver.name)?.maximumWorkDays;
                      if (
                        maximumWorkDays !== undefined &&
                        (workCounts.get(driver.name) ?? 0) >= maximumWorkDays
                      )
                        return false;

                      if (
                        wouldCreateSevenDayStreakAfterMove(
                          driver.name,
                          donorDate,
                        )
                      )
                        return false;

                      return true;
                    })
                    .sort((a, b) => {
                      const aTarget =
                        getGenerationTargetWorkDays(region, a.name) ?? 0;
                      const bTarget =
                        getGenerationTargetWorkDays(region, b.name) ?? 0;
                      const aActual =
                        regionalWorkCounts.get(
                          regionalCountKey(region, a.name),
                        ) ?? 0;
                      const bActual =
                        regionalWorkCounts.get(
                          regionalCountKey(region, b.name),
                        ) ?? 0;
                      return (bTarget - bActual) - (aTarget - aActual);
                    });

                  const replacement = replacementCandidates[0];
                  if (!replacement) continue;

                  // 実際に交換。
                  // A: donorDate から外して targetDate へ → 日数±0
                  // B: donorDate に追加 → 不足していた301日数を+1
                  donorCourses[donorIndex] = {
                    ...donorCourse,
                    driver: replacement.name,
                    status: "配車済" as const,
                    memo: "自動修復：別日交換",
                  };

                  targetCourses[targetIndex] = {
                    ...targetCourse,
                    driver: mover.name,
                    status: "配車済" as const,
                    memo: "自動修復：別日交換",
                  };

                  generated[donorDate][region] = donorCourses;
                  generated[targetDate][region] = targetCourses;

                  addRepairCount(region, replacement.name, 1);

                  repairedCrossDay += 1;
                  fixed = true;
                }
              }
            }
          }
        }

        if (repairedCrossDay === 0) break;
      }


      // ─────────────────────────────────────────────────────────────
      // ⑤ 301完全維持：別日2段連鎖交換
      //
      // 1段交換で埋まらない場合：
      // 未配置 ← A
      // Aの別日 ← B
      // Bの別日 ← C
      //
      // A/B は別日に移るだけなので各営業所の301日数は±0。
      // C は301不足者だけを使うので、未配置1件分の不足を+1して
      // 最終的に301指定日数へ近づける。
      // ─────────────────────────────────────────────────────────────
      for (let deepPass = 0; deepPass < 5; deepPass += 1) {
        let deepRepaired = 0;

        for (let targetDay = 1; targetDay <= lastDay; targetDay += 1) {
          const targetDate =
            `${autoMonth}-${String(targetDay).padStart(2, "0")}`;

          for (const region of ["松阪", "伊勢", "伊賀"] as Region[]) {
            if (!targetPlanCompleteByRegion.get(region)) continue;

            const targetCourses = generated[targetDate]?.[region] ?? [];

            for (
              let targetIndex = 0;
              targetIndex < targetCourses.length;
              targetIndex += 1
            ) {
              const missingCourse = targetCourses[targetIndex];
              if (missingCourse.driver) continue;

              let solved = false;

              const targetAssigned = rebuildAssignedToday(targetDate);

              // A: 未配置コースを担当でき、301は既に到達している人
              const aCandidates = uniqueDrivers.filter((a) => {
                if (targetAssigned.has(a.name)) return false;
                if (
                  !canTakeCrossDayCourse(
                    a,
                    region,
                    missingCourse.course,
                    targetDate,
                  )
                )
                  return false;

                const target =
                  getGenerationTargetWorkDays(region, a.name) ?? 0;
                const actual =
                  regionalWorkCounts.get(
                    regionalCountKey(region, a.name),
                  ) ?? 0;

                return target > 0 && actual === target;
              });

              for (const a of aCandidates) {
                if (solved) break;

                // Aが担当している別日(A日)を空ける
                for (let aDay = 1; aDay <= lastDay; aDay += 1) {
                  if (aDay === targetDay || solved) continue;

                  const aDate =
                    `${autoMonth}-${String(aDay).padStart(2, "0")}`;
                  const aCourses = generated[aDate]?.[region] ?? [];
                  const aIndex = aCourses.findIndex(
                    (course) =>
                      normalizeDriverName(course.driver) ===
                        normalizeDriverName(a.name) &&
                      !course.isLocked,
                  );
                  if (aIndex < 0) continue;

                  const aOldCourse = aCourses[aIndex];

                  if (
                    wouldCreateSevenDayStreakAfterMove(
                      a.name,
                      targetDate,
                      aDate,
                    )
                  )
                    continue;

                  const aDateAssigned = rebuildAssignedToday(aDate);

                  // B: A日を担当できる301到達者。
                  // Bも別日へ動かすので301日数は変えない。
                  const bCandidates = uniqueDrivers.filter((b) => {
                    if (
                      normalizeDriverName(b.name) ===
                      normalizeDriverName(a.name)
                    )
                      return false;
                    if (aDateAssigned.has(b.name)) return false;
                    if (
                      !canTakeCrossDayCourse(
                        b,
                        region,
                        aOldCourse.course,
                        aDate,
                      )
                    )
                      return false;

                    const target =
                      getGenerationTargetWorkDays(region, b.name) ?? 0;
                    const actual =
                      regionalWorkCounts.get(
                        regionalCountKey(region, b.name),
                      ) ?? 0;
                    return target > 0 && actual === target;
                  });

                  for (const b of bCandidates) {
                    if (solved) break;

                    // Bが担当している別日(B日)をCへ渡す
                    for (let bDay = 1; bDay <= lastDay; bDay += 1) {
                      if (
                        bDay === targetDay ||
                        bDay === aDay ||
                        solved
                      )
                        continue;

                      const bDate =
                        `${autoMonth}-${String(bDay).padStart(2, "0")}`;
                      const bCourses = generated[bDate]?.[region] ?? [];
                      const bIndex = bCourses.findIndex(
                        (course) =>
                          normalizeDriverName(course.driver) ===
                            normalizeDriverName(b.name) &&
                          !course.isLocked,
                      );
                      if (bIndex < 0) continue;

                      const bOldCourse = bCourses[bIndex];

                      // Bは bDate → aDate へ移動
                      if (
                        wouldCreateSevenDayStreakAfterMove(
                          b.name,
                          aDate,
                          bDate,
                        )
                      )
                        continue;

                      // C: 301が不足していて、B日のコースを担当できる人
                      const cCandidates = uniqueDrivers
                        .filter((c) => {
                          if (
                            normalizeDriverName(c.name) ===
                              normalizeDriverName(a.name) ||
                            normalizeDriverName(c.name) ===
                              normalizeDriverName(b.name)
                          )
                            return false;

                          if (driverWorksOnGeneratedDate(c.name, bDate))
                            return false;

                          if (
                            !canTakeCrossDayCourse(
                              c,
                              region,
                              bOldCourse.course,
                              bDate,
                            )
                          )
                            return false;

                          const target =
                            getGenerationTargetWorkDays(
                              region,
                              c.name,
                            ) ?? 0;
                          const actual =
                            regionalWorkCounts.get(
                              regionalCountKey(region, c.name),
                            ) ?? 0;

                          if (
                            actual >= target &&
                            !canAddSupportBeyondRegionalTarget(c, region)
                          )
                            return false;

                          const maximumWorkDays =
                            parsedConditions.get(c.name)?.maximumWorkDays;
                          if (
                            maximumWorkDays !== undefined &&
                            (workCounts.get(c.name) ?? 0) >= maximumWorkDays
                          )
                            return false;

                          if (
                            wouldCreateSevenDayStreakAfterMove(
                              c.name,
                              bDate,
                            )
                          )
                            return false;

                          return true;
                        })
                        .sort((c1, c2) => {
                          const t1 =
                            getGenerationTargetWorkDays(
                              region,
                              c1.name,
                            ) ?? 0;
                          const t2 =
                            getGenerationTargetWorkDays(
                              region,
                              c2.name,
                            ) ?? 0;
                          const a1 =
                            regionalWorkCounts.get(
                              regionalCountKey(region, c1.name),
                            ) ?? 0;
                          const a2 =
                            regionalWorkCounts.get(
                              regionalCountKey(region, c2.name),
                            ) ?? 0;
                          return (t2 - a2) - (t1 - a1);
                        });

                      const c = cCandidates[0];
                      if (!c) continue;

                      // A: aDate → targetDate
                      // B: bDate → aDate
                      // C: bDateへ新規配置
                      targetCourses[targetIndex] = {
                        ...missingCourse,
                        driver: a.name,
                        status: "配車済" as const,
                        memo: "自動修復：別日2段連鎖",
                      };

                      aCourses[aIndex] = {
                        ...aOldCourse,
                        driver: b.name,
                        status: "配車済" as const,
                        memo: "自動修復：別日2段連鎖",
                      };

                      bCourses[bIndex] = {
                        ...bOldCourse,
                        driver: c.name,
                        status: "配車済" as const,
                        memo: "自動修復：別日2段連鎖",
                      };

                      generated[targetDate][region] = targetCourses;
                      generated[aDate][region] = aCourses;
                      generated[bDate][region] = bCourses;

                      // A/Bは移動だけなので日数不変。Cだけ+1。
                      addRepairCount(region, c.name, 1);

                      deepRepaired += 1;
                      solved = true;
                    }
                  }
                }
              }
            }
          }
        }

        if (deepRepaired === 0) break;
      }

      // ===== 清水國光 → 稼働不足の通常ドライバーへ確実に置換 =====
      // 通常の候補採点だけでは301の地域別目標に引っ張られることがあるため、
      // 自動修復の最後に、國光さんの応援枠を「全営業所合算24日未満」の
      // 通常ドライバーへ直接振り替える。希望休・担当コース・重複・7連勤は守る。
      const countActualWorkedDates = (driverName: string) => {
        const dates = new Set<string>();
        Object.entries(generated).forEach(([dateKey, dayShifts]) => {
          const worked = Object.values(dayShifts ?? {})
            .flat()
            .some(
              (item) =>
                item.driver &&
                normalizeDriverName(item.driver) ===
                  normalizeDriverName(driverName),
            );
          if (worked) dates.add(dateKey);
        });
        return dates;
      };

      const wouldCreateSevenDayStreak = (driverName: string, addDate: string) => {
        const dates = countActualWorkedDates(driverName);
        dates.add(addDate);
        const dayNumber = Number(addDate.slice(-2));
        let consecutive = 0;
        for (let d = Math.max(1, dayNumber - 6); d <= Math.min(lastDay, dayNumber + 6); d += 1) {
          const key = `${autoMonth}-${String(d).padStart(2, "0")}`;
          if (dates.has(key)) {
            consecutive += 1;
            if (consecutive >= 7) return true;
          } else {
            consecutive = 0;
          }
        }
        return false;
      };

      const kunimitsuName = normalizeDriverName("清水 國光");
      const supportRegions: Region[] = ["伊勢", "伊賀", "松阪"];

      // 伊勢を先に処理。横溝・楠滝・徳田など通常ドライバーの不足日数を
      // 國光さんより先に埋める。特定3名へのハードコードではなく、
      // 担当可能かつ24日未満の通常ドライバー全員が対象。
      for (const region of supportRegions) {
        for (let day = 1; day <= lastDay; day += 1) {
          const dateKey = `${autoMonth}-${String(day).padStart(2, "0")}`;
          const dayCourses = generated[dateKey]?.[region] ?? [];
          const weekday = new Date(year, month - 1, day).getDay();

          for (let courseIndex = 0; courseIndex < dayCourses.length; courseIndex += 1) {
            const currentCourse = dayCourses[courseIndex];
            if (
              !currentCourse.driver ||
              normalizeDriverName(currentCourse.driver) !== kunimitsuName ||
              currentCourse.isLocked
            ) continue;

            const candidates = uniqueDrivers
              .filter((driver) => {
                if (normalizeDriverName(driver.name) === kunimitsuName) return false;
                if (driver.assignmentMode === "自動除外") return false;
                if (!eligibleRegions.get(driver.name)?.has(region)) return false;
                if (!canDriverHandleCourse(driver, region, currentCourse.course)) return false;
                if (!isConfiguredCourse(driver.name, region, currentCourse.course)) return false;
                if (!fixedCourseMatches(driver.fixedCourse, currentCourse.course)) return false;
                if (requestedOff(driver.name, day, weekday)) return false;

                const alreadyAssignedToday = Object.values(generated[dateKey] ?? {})
                  .flat()
                  .some(
                    (item) =>
                      item.driver &&
                      normalizeDriverName(item.driver) ===
                        normalizeDriverName(driver.name),
                  );
                if (alreadyAssignedToday) return false;

                const actualDays = countActualWorkedDates(driver.name).size;
                const maximum = parsedConditions.get(driver.name)?.maximumWorkDays;
                const desired = maximum ?? 24;
                if (actualDays >= desired) return false;
                if (maximum !== undefined && actualDays >= maximum) return false;
                if (wouldCreateSevenDayStreak(driver.name, dateKey)) return false;
                return true;
              })
              .sort((a, b) => {
                const aDays = countActualWorkedDates(a.name).size;
                const bDays = countActualWorkedDates(b.name).size;
                // 17日、20日、22日のように少ない人から優先。
                if (aDays !== bDays) return aDays - bDays;

                // 同数なら、その営業所がサブ営業所の人を応援として優先。
                const aSupport = a.mainArea !== region ? 0 : 1;
                const bSupport = b.mainArea !== region ? 0 : 1;
                if (aSupport !== bSupport) return aSupport - bSupport;
                return a.name.localeCompare(b.name, "ja");
              });

            const replacement = candidates[0];
            if (!replacement) continue;

            dayCourses[courseIndex] = {
              ...currentCourse,
              driver: replacement.name,
              status: "配車済" as const,
              memo: "自動均等化：通常ドライバー24日前後を優先",
            };
          }

          if (generated[dateKey]) generated[dateKey][region] = dayCourses;
        }
      }

      // 上の置換後の実績を採点へ正しく反映する。
      uniqueDrivers.forEach((driver) => {
        workCounts.set(driver.name, countActualWorkedDates(driver.name).size);
        (["松阪", "伊勢", "伊賀"] as Region[]).forEach((region) => {
          let regionalDays = 0;
          for (let d = 1; d <= lastDay; d += 1) {
            const key = `${autoMonth}-${String(d).padStart(2, "0")}`;
            if (
              (generated[key]?.[region] ?? []).some(
                (item) =>
                  item.driver &&
                  normalizeDriverName(item.driver) ===
                    normalizeDriverName(driver.name),
              )
            ) regionalDays += 1;
          }
          regionalWorkCounts.set(regionalCountKey(region, driver.name), regionalDays);
        });
      });

      // 修復後の未配置数を採点に使う。
      unassignedCount = Object.values(generated).reduce(
        (total, dayShifts) =>
          total +
          Object.values(dayShifts)
            .flat()
            .filter((course) => !course.driver).length,
        0,
      );

      let duplicateCount = 0;
      Object.values(generated).forEach((dayShifts) => {
        const assignedNames = new Set<string>();

        Object.values(dayShifts)
          .flat()
          .forEach((course) => {
            if (!course.driver) return;
            const driverName = normalizeDriverName(course.driver);
            if (assignedNames.has(driverName)) {
              duplicateCount += 1;
            } else {
              assignedNames.add(driverName);
            }
          });
      });

      let sevenDayStreakCount = 0;
      uniqueDrivers.forEach((driver) => {
        let consecutiveDays = 0;

        Object.keys(generated)
          .sort()
          .forEach((dateKey) => {
            const worked = Object.values(generated[dateKey] ?? {})
              .flat()
              .some(
                (course) =>
                  course.driver &&
                  normalizeDriverName(course.driver) ===
                    normalizeDriverName(driver.name),
              );

            if (worked) {
              consecutiveDays += 1;
              if (consecutiveDays === 7) sevenDayStreakCount += 1;
            } else {
              consecutiveDays = 0;
            }
          });
      });

      let missedRequiredWorkDays = 0;
      uniqueDrivers.forEach((driver) => {
        const condition = parsedConditions.get(driver.name);
        if (!condition?.requiredWorkDays.size) return;

        for (let requiredDay = 1; requiredDay <= lastDay; requiredDay += 1) {
          const dateKey =
            `${autoMonth}-${String(requiredDay).padStart(2, "0")}`;
          const requiredWeekday =
            new Date(`${dateKey}T00:00:00`).getDay();

          if (
            !requiredToWork(driver.name, requiredDay, requiredWeekday)
          ) {
            continue;
          }

          const worked = Object.values(generated[dateKey] ?? {})
            .flat()
            .some(
              (course) =>
                course.driver &&
                normalizeDriverName(course.driver) ===
                  normalizeDriverName(driver.name),
            );

          if (worked) continue;

          // 本人が担当可能な稼働コースがその日に1つでもある時だけ、
          // 未出勤を候補評価上の重大エラーとして数える。
          const hadEligibleCourse = (
            Object.entries(generated[dateKey] ?? {}) as [
              Region,
              Course[],
            ][]
          ).some(([region, dayCourses]) =>
            dayCourses.some(
              (course) =>
                eligibleRegions.get(driver.name)?.has(region) &&
                canDriverHandleCourse(driver, region, course.course) &&
                isConfiguredCourse(driver.name, region, course.course) &&
                (!driver.fixedCourse ||
                  driver.fixedCourse === course.course),
            ),
          );

          if (hadEligibleCourse) missedRequiredWorkDays += 1;
        }
      });

      const countValues = uniqueDrivers
        .filter(shouldBalanceDriver)
        .map((driver) => workCounts.get(driver.name) ?? 0);
      const workloadSpread = countValues.length
        ? Math.max(...countValues) - Math.min(...countValues)
        : 0;

      // 月の前半・後半や特定の週に勤務が固まらない候補を優先する。
      // 特に清水國光さんは「必要な時だけ使う」条件は維持したまま、
      // 必要になった勤務日を月全体へできるだけ均等に散らす。
      let monthlyDistributionPenalty = 0;

      uniqueDrivers.forEach((driver) => {
        const workedDays: number[] = [];

        for (let checkDay = 1; checkDay <= lastDay; checkDay += 1) {
          const dateKey =
            `${autoMonth}-${String(checkDay).padStart(2, "0")}`;
          const worked = Object.values(generated[dateKey] ?? {})
            .flat()
            .some(
              (course) =>
                course.driver &&
                normalizeDriverName(course.driver) ===
                  normalizeDriverName(driver.name),
            );

          if (worked) workedDays.push(checkDay);
        }

        // 0～1日しか勤務しない人は「偏り」を評価できないので対象外。
        if (workedDays.length <= 1) return;

        // 月を4区画に分け、各区画の勤務数の差を見る。
        const quarterCounts = [0, 0, 0, 0];
        workedDays.forEach((workedDay) => {
          const quarter = Math.min(
            3,
            Math.floor(((workedDay - 1) * 4) / lastDay),
          );
          quarterCounts[quarter] += 1;
        });

        const quarterSpread =
          Math.max(...quarterCounts) - Math.min(...quarterCounts);

        // 前半・後半の偏りも別で評価する。
        const firstHalfCount = workedDays.filter(
          (workedDay) => workedDay <= Math.ceil(lastDay / 2),
        ).length;
        const secondHalfCount = workedDays.length - firstHalfCount;
        const halfImbalance = Math.abs(firstHalfCount - secondHalfCount);

        // 勤務間隔が極端に空いている場合も少し不利にする。
        let maxGap = 0;
        for (let index = 1; index < workedDays.length; index += 1) {
          maxGap = Math.max(
            maxGap,
            workedDays[index] - workedDays[index - 1],
          );
        }

        const isKunimitsu =
          normalizeDriverName(driver.name) ===
          normalizeDriverName("清水 國光");

        // 清水國光さんは後半集中を強く避ける。
        // その他のドライバーにも軽く分散評価をかける。
        const weight = isKunimitsu ? 5000 : 250;

        monthlyDistributionPenalty +=
          quarterSpread * weight +
          halfImbalance * weight +
          Math.max(0, maxGap - 10) * (isKunimitsu ? 1000 : 50);
      });

      let targetMismatchCount = 0;
      (["松阪", "伊勢", "伊賀"] as Region[]).forEach((region) => {
        if (!targetPlanCompleteByRegion.get(region)) return;

        uniqueDrivers.forEach((driver) => {
          const target =
            getGenerationTargetWorkDays(region, driver.name) ?? 0;
          const actual =
            regionalWorkCounts.get(
              regionalCountKey(region, driver.name),
            ) ?? 0;
          targetMismatchCount += Math.abs(target - actual);
        });
      });

      const trialScore =
        unassignedCount * 1000000 +
        targetMismatchCount * 100000 +
        duplicateCount * 100000 +
        sevenDayStreakCount * 10000 +
        missedRequiredWorkDays * 1000000 +
        monthlyDistributionPenalty +
        workloadSpread;

      if (trialScore < bestScore) {
        bestScore = trialScore;
        bestGenerated = generated;
        bestUnassignedCount = unassignedCount;
        bestDuplicateCount = duplicateCount;
        bestSevenDayStreakCount = sevenDayStreakCount;
        bestTrial = trial + 1;
      }

      if (bestScore === 0) break;
    }

    if (!bestGenerated) {
      setAutoMessage("シフト候補を作成できませんでした。");
      return;
    }

    const selectedGenerated = bestGenerated;
    setShiftsByDate((previous) => ({ ...previous, ...selectedGenerated }));
    setSelectedDate(`${autoMonth}-01`);

    const warnings: string[] = [];
    if (bestUnassignedCount > 0)
      warnings.push(`未配置が${bestUnassignedCount}件`);
    if (bestDuplicateCount > 0)
      warnings.push(`同日重複が${bestDuplicateCount}件`);
    if (bestSevenDayStreakCount > 0)
      warnings.push(`7連勤以上が${bestSevenDayStreakCount}件`);

    const supportSummary = autoSupportMoves.length
      ? ` 自動応援：${autoSupportMoves
          .map(
            (move) =>
              `${move.driverName}→${move.region}${move.addedDays}日`,
          )
          .join("、")}。`
      : "";

    setAutoMessage(
      warnings.length === 0
        ? `${trialCount}パターン以内で比較し、エラーのない候補（候補${bestTrial}）を採用しました。${supportSummary}`
        : `${trialCount}パターンを比較し、最少エラーの候補${bestTrial}を採用しました。${warnings.join("、")}あります。${supportSummary}`,
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
memo: driverName ? "手動変更" : "",            }
          : course,
      ),
    }));
  };
const changeMonthlyCourseDriver = async (
  dateKey: string,
  region: Region,
  courseId: number,
  driverName: string,
) => {
  const selectedDriver = standbyDrivers.find(
    (driver) =>
      driver.name === driverName &&
      driver.area.replace("営業所", "") === region,
  );
  const targetCourse = (
  shiftsByDate[dateKey]?.[region] ?? []
).find((course) => course.id === courseId);

if (
  driverName &&
  targetCourse &&
  selectedDriver &&
  !canDriverDriveCourse(selectedDriver, region, targetCourse.course)
) {
  window.alert(
    `${driverName}さんは${region}の${targetCourse.course}を担当可能コースに登録していません。`,
  );
  return;
}
if (driverName) {
  const {
    data: manualDayOffRows,
    error: manualDayOffError,
  } = await supabase
    .from("shift_day_off_requests")
    .select("driver_name,requested_date")
    .eq("target_month", autoMonth)
    .eq("requested_date", dateKey);

  if (manualDayOffError) {
    window.alert(
      `希望休を確認できなかったため変更を中止しました：${manualDayOffError.message}`,
    );
    return;
  }

  const isRequestedDayOff = (manualDayOffRows ?? []).some(
    (row) =>
      String(row.driver_name).replace(/[\s　]/g, "") ===
      driverName.replace(/[\s　]/g, ""),
  );

  if (isRequestedDayOff) {
    window.alert(
      `${driverName}さんは${dateKey}を希望休に登録しています。`,
    );
    return;
  }
}
if (driverName) {
  const duplicateAssignment = Object.entries(
    shiftsByDate[dateKey] ?? {},
  ).some(([assignedRegion, courses]) =>
    courses.some(
      (course) =>
course.driver.replace(/[\s　]/g, "") ===
  driverName.replace(/[\s　]/g, "") &&        !(
          assignedRegion === region &&
          course.id === courseId
        ),
    ),
  );

  if (duplicateAssignment) {
    window.alert(
      `${driverName}さんは${dateKey}にすでに別のコースへ配置されています。`,
    );
    return;
  }
}
if (driverName) {
  const normalizedDriverName = driverName.replace(/[\s　]/g, "");
  const workedDates = new Set<string>();

  Object.entries(shiftsByDate).forEach(
    ([workDate, regions]) => {
      if (!workDate.startsWith(`${autoMonth}-`)) return;

      const alreadyWorked = Object.values(regions)
        .flat()
        .some(
          (course) =>
            course.driver.replace(/[\s　]/g, "") ===
            normalizedDriverName,
        );

      if (alreadyWorked) {
        workedDates.add(workDate);
      }
    },
  );

  workedDates.add(dateKey);

  const [year, month] = autoMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  let consecutiveDates: string[] = [];
  let createsSevenDayStreak = false;

  for (let day = 1; day <= lastDay; day += 1) {
    const workDate =
      `${autoMonth}-${String(day).padStart(2, "0")}`;

    if (workedDates.has(workDate)) {
      consecutiveDates.push(workDate);

      if (
        consecutiveDates.length >= 7 &&
        consecutiveDates.includes(dateKey)
      ) {
        createsSevenDayStreak = true;
        break;
      }
    } else {
      consecutiveDates = [];
    }
  }

  if (createsSevenDayStreak) {
    window.alert(
      `${driverName}さんはこの変更で7連勤以上になります。`,
    );
    return;
  }
}
  setShiftsByDate((previous) => ({
    ...previous,
    [dateKey]: {
      ...previous[dateKey],
      [region]: (previous[dateKey]?.[region] ?? []).map((course) =>
        course.id === courseId
          ? {
              ...course,
              driver: driverName,
              status: driverName ? "配車済" : "未配車",
memo: driverName ? "手動変更" : "",              isLocked: true,
            }
          : course,
      ),
    },
  }));
};
const driverWorkedOnDate = (
  driverName: string,
  dateKey: string,
) =>
  Object.values(shiftsByDate[dateKey] ?? {})
    .flat()
    .some(
      (course) =>
        course.driver.replace(/[\s　]/g, "") ===
        driverName.replace(/[\s　]/g, ""),
    );

// 今月稼働は全営業所の実配置を合算する。
// 保存データの営業所キーが「伊勢」でも「伊勢営業所」でも拾えるよう、
// キーを normalizeRegion() してから集計する。
// 各営業所内では同じ日に複数コースへ入っていても1日として数える。
const getMonthlyWorkBreakdown = (driverName: string) => {
  const normalizedDriverName = normalizeDriverName(driverName);
  const workedDatesByRegion: Record<Region, Set<string>> = {
    松阪: new Set<string>(),
    伊勢: new Set<string>(),
    伊賀: new Set<string>(),
  };

  Object.entries(shiftsByDate).forEach(([dateKey, regionShifts]) => {
    if (!dateKey.startsWith(`${autoMonth}-`)) return;

    Object.entries(regionShifts ?? {}).forEach(([rawRegion, courses]) => {
      const region = normalizeRegion(rawRegion);
      if (!region) return;

      const workedInRegion = (courses ?? []).some(
        (course) =>
          Boolean(course.driver) &&
          normalizeDriverName(course.driver) === normalizedDriverName,
      );

      if (workedInRegion) workedDatesByRegion[region].add(dateKey);
    });
  });

  const matsusaka = workedDatesByRegion.松阪.size;
  const ise = workedDatesByRegion.伊勢.size;
  const iga = workedDatesByRegion.伊賀.size;

  return {
    松阪: matsusaka,
    伊勢: ise,
    伊賀: iga,
    total: matsusaka + ise + iga,
  };
};

const getMonthlyWorkCount = (driverName: string) =>
  getMonthlyWorkBreakdown(driverName).total;

// 今月稼働の表示用。
// 1営業所だけのドライバーは「24日」のように合計だけ表示。
// 複数営業所に登録されているドライバーだけ
// 「24日（松阪20・伊勢4）」のように登録営業所別の内訳を表示する。
const getMonthlyWorkDisplayParts = (driverName: string) => {
  const work = getMonthlyWorkBreakdown(driverName);
  const driver = getUniqueDrivers().find(
    (item) => normalizeDriverName(item.name) === normalizeDriverName(driverName),
  );

  if (!driver) {
    return { total: `${work.total}日`, breakdown: "" };
  }

  const officeTabs = getDriverOfficeTabs(driver);
  if (officeTabs.length <= 1) {
    return { total: `${work.total}日`, breakdown: "" };
  }

  return {
    total: `${work.total}日`,
    breakdown: officeTabs
      .map((region) => `${region}${work[region]}`)
      .join("・"),
  };
};

const formatMonthlyWorkDisplay = (driverName: string) => {
  const display = getMonthlyWorkDisplayParts(driverName);
  return display.breakdown
    ? `${display.total}（${display.breakdown}）`
    : display.total;
};

const getConsecutiveWorkCount = (
  driverName: string,
  dateKey: string,
) => {
  let count = 0;
  const currentDate = new Date(`${dateKey}T00:00:00`);

  for (let index = 0; index < 31; index += 1) {
    const currentDateKey = formatDateKey(currentDate);

    if (!driverWorkedOnDate(driverName, currentDateKey)) {
      break;
    }

    count += 1;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return count;
};
// 月間表の日付列は shiftsByDate にデータがある日だけではなく、
// 選択中の月の日付を1日〜月末まで必ず作る。
// これで15〜21日など、まだシフトデータが無い週でも日付列が消えない。
const [monthlyYear, monthlyMonth] = autoMonth.split("-").map(Number);
const daysInSelectedMonth =
  monthlyYear && monthlyMonth
    ? new Date(monthlyYear, monthlyMonth, 0).getDate()
    : 0;

const monthlyDateKeys = Array.from(
  { length: daysInSelectedMonth },
  (_, index) =>
    `${autoMonth}-${String(index + 1).padStart(2, "0")}`,
);
const weekLabels = [
  "1〜7日",
  "8〜14日",
  "15〜21日",
  "22〜28日",
  "29〜31日",
];

const displayedDateKeys = monthlyDateKeys.slice(
  selectedWeek * 7,
  selectedWeek * 7 + 7,
);
// 月間シフト表の行は「登録されている基本コース」を固定表示する。
// AB/BC/CDなどの結合コースは別行として増やさず、その日のセル側で扱う。
// これで A〜H + 追加コース（例: 高町）のシンプルな表を維持する。
const monthlyCourseNames = uniqueCourseNames(
  courseSettings
    .filter((setting) => setting.region === activeTab)
    .map((setting) => setting.name),
);

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

  const canonicalMonthKey = (value: string) => {
    const match = String(value ?? "").trim().match(/^(\\d{4})-(\\d{1,2})$/);
    if (!match) return String(value ?? "").trim();
    return `${match[1]}-${match[2].padStart(2, "0")}`;
  };

  const loadCloudMonth = async () => {
    if (!session) return setCloudMessage("先に管理者ログインしてください。");
    setCloudBusy(true);
    setCloudMessage("");
    const cloudMonthKey = canonicalMonthKey(autoMonth);

    // 共有画面と同じ公開済み月を最優先で読む
    const { data: publishedMonth, error: publishedMonthError } = await supabase
      .from("shift_months")
      .select("id,status")
      .eq("month_key", cloudMonthKey)
      .eq("status", "published")
      .limit(1)
      .maybeSingle();

    if (publishedMonthError) {
      setCloudBusy(false);
      setCloudMessage(`読込エラー：${publishedMonthError.message}`);
      return;
    }

    let monthRow = publishedMonth;

    // 公開済みが無い月だけ下書きを読む
    if (!monthRow) {
      const { data: draftRows, error: draftError } = await supabase
        .from("shift_months")
        .select("id,status")
        .eq("month_key", cloudMonthKey)
        .eq("status", "draft")
        .limit(1);

      if (draftError) {
        setCloudBusy(false);
        setCloudMessage(`読込エラー：${draftError.message}`);
        return;
      }
      monthRow = draftRows?.[0] ?? null;
    }

    if (!monthRow) {
      setCloudBusy(false);
      setMonthStatus("draft");
      setCloudMessage(`${cloudMonthKey}のクラウドデータはまだありません。`);
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

    // 0件データで現在の管理画面を消さない
    if ((assignments ?? []).length === 0) {
      setCloudBusy(false);
      setMonthStatus(monthRow.status as "draft" | "published");
      setCloudMessage(
        `${cloudMonthKey}のクラウド月は見つかりましたが、配置データが0件です。現在の画面は保持しました。`,
      );
      return;
    }

    const loaded: ShiftsByDate = {};
    (assignments ?? []).forEach((row, index) => {
      const date = String(row.work_date).slice(0, 10);
      const rawArea = String(row.area ?? "").replace("営業所", "");
      if (rawArea !== "松阪" && rawArea !== "伊勢" && rawArea !== "伊賀") return;
      const region = rawArea as Region;

      if (!loaded[date]) loaded[date] = { 松阪: [], 伊勢: [], 伊賀: [] };

      const nextCourse: Course = {
        ...createCourse(Date.now() + index, String(row.course ?? "")),
        driver: row.driver_name ?? "",
        status: row.status as CourseStatus,
        memo: row.memo ?? "",
        isLocked: Boolean(row.is_locked),
      };

      const existing = loaded[date][region].findIndex((item) =>
        sameCourseName(item.course, nextCourse.course),
      );
      if (existing >= 0) loaded[date][region][existing] = nextCourse;
      else loaded[date][region].push(nextCourse);
    });

    const loadedConditions: RequestedDaysOff = {};
    (conditions ?? []).forEach((row) => {
      loadedConditions[row.driver_name] = row.condition_text;
    });

    const loadedOverrides: DailyCourseOverrides = {};
    Object.entries(loaded).forEach(([date, regions]) => {
      (Object.keys(regions) as Region[]).forEach((region) => {
        const actualNames = regions[region].map((course) => course.course);
        const presetNames = getCourseNamesForDate(date, region, coursePreset);
        if (actualNames.join("|") !== presetNames.join("|")) {
          loadedOverrides[date] = {
            ...(loadedOverrides[date] ?? {}),
            [region]: actualNames,
          };
        }
      });
    });

    // 選択月だけクラウドを正として完全置換。他の月は残す。
    setShiftsByDate((previous) => {
      const otherMonths = Object.fromEntries(
        Object.entries(previous).filter(([date]) => !date.startsWith(`${cloudMonthKey}-`)),
      ) as ShiftsByDate;
      return { ...otherMonths, ...loaded };
    });

    setDailyCourseOverrides((previous) => {
      const otherMonths = Object.fromEntries(
        Object.entries(previous).filter(([date]) => !date.startsWith(`${cloudMonthKey}-`)),
      ) as DailyCourseOverrides;
      return { ...otherMonths, ...loadedOverrides };
    });

    setRequestedDaysOff((previous) => ({ ...previous, ...loadedConditions }));
    setMonthStatus(monthRow.status as "draft" | "published");
    setSelectedDate(`${cloudMonthKey}-01`);
    setCloudBusy(false);
    setCloudMessage(
      `${cloudMonthKey}をクラウドから読み込みました（${assignments?.length ?? 0}件）。`,
    );
  };

  const finalChecks = useMemo(() => {
    const issues: string[] = [];
    const [checkYear, checkMonth] = autoMonth.split("-").map(Number);
    const checkDaysInMonth =
      checkYear && checkMonth ? new Date(checkYear, checkMonth, 0).getDate() : 0;
    const monthDates = Array.from(
      { length: checkDaysInMonth },
      (_, index) => `${autoMonth}-${String(index + 1).padStart(2, "0")}`,
    );
    const workedDates = new Map<string, Set<string>>();

    const findActualCourse = (
      dayCourses: Course[],
      requiredCourseName: string,
      region: Region,
    ) => {
      const exact = dayCourses.find((course) =>
        sameCourseName(course.course, requiredCourseName),
      );
      if (exact) return exact;

      const required = normalizeCourseName(requiredCourseName);
      if (region === "松阪") {
        const baseForMerged: Record<string, string> = {
          AB: "A",
          BC: "B",
          CD: "C",
        };
        const base = baseForMerged[required];
        if (base) {
          return dayCourses.find(
            (course) => normalizeCourseName(course.course) === base,
          );
        }
      }
      if (region === "伊勢") {
        if (required === "神久・朝熊") {
          return dayCourses.find(
            (course) => normalizeCourseName(course.course) === "神久",
          );
        }
        if (required === "御薗・高向") {
          return dayCourses.find(
            (course) => normalizeCourseName(course.course) === "御薗",
          );
        }
      }
      return undefined;
    };

    monthDates.forEach((date) => {
      const dayShift = shiftsByDate[date];
      const seen = new Map<string, string>();

      (["松阪", "伊勢", "伊賀"] as Region[]).forEach((region) => {
        const requiredCourseNames = resolveCourseNamesForDate(
          date,
          region,
          coursePreset,
          dailyCourseOverrides[date]?.[region],
        );
        const dayCourses = dayShift?.[region] ?? [];

        requiredCourseNames.forEach((requiredCourseName) => {
          const course = findActualCourse(dayCourses, requiredCourseName, region);
          if (!course || !course.driver || course.status === "未配車") {
            issues.push(
              `${date} ${region} ${requiredCourseName}：未配置${
                course?.memo ? `（${course.memo}）` : ""
              }`,
            );
            return;
          }

          const driverKey = normalizeDriverName(course.driver);
          const previous = seen.get(driverKey);
          if (previous) {
            issues.push(
              `${date} ${course.driver}：重複配置（${previous}／${region} ${requiredCourseName}）`,
            );
          } else {
            seen.set(driverKey, `${region} ${requiredCourseName}`);
          }

          const dates = workedDates.get(driverKey) ?? new Set<string>();
          dates.add(date);
          workedDates.set(driverKey, dates);
        });
      });
    });

    workedDates.forEach((dates, driverKey) => {
      let streak = 0;
      monthDates.forEach((date) => {
        streak = dates.has(date) ? streak + 1 : 0;
        if (streak === 7) {
          const displayName =
            getUniqueDrivers().find(
              (driver) => normalizeDriverName(driver.name) === driverKey,
            )?.name ?? driverKey;
          issues.push(`${date} ${displayName}：7連勤`);
        }
      });
    });

    return issues;
  }, [
    autoMonth,
    coursePreset,
    dailyCourseOverrides,
    shiftsByDate,
    standbyDrivers,
  ]);

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
    const cloudMonthKey = canonicalMonthKey(autoMonth);
    const nextStatus = publish ? "published" : "draft";
    const { data: monthRow, error: monthError } = await supabase
      .from("shift_months")
      .upsert(
        {
          month_key: cloudMonthKey,
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
      .filter((date) => date.startsWith(`${cloudMonthKey}-`))
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
    // 安全装置：管理画面が空の状態ではクラウド既存シフトを削除しない
    if (rows.length === 0) {
      setCloudBusy(false);
      setCloudMessage(
        "保存を中止しました。現在の管理画面に保存対象シフトが0件のため、クラウドの既存データは削除していません。",
      );
      return;
    }

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

  // 月間出勤日数も301入力欄と同じ営業所対象者で集計する。
  // メイン営業所が松阪でも、伊勢の対象として登録されている
  // 横溝・楠滝などの実配置日数を伊勢側で正しく表示する。
  const monthlyDriverSummary = driversForTargetRegion(activeTab)
    .map((driver) => ({
      name: driver.name,
      workDays: getMonthlyWorkCount(driver.name),
      workDisplay: formatMonthlyWorkDisplay(driver.name),
      workDisplayParts: getMonthlyWorkDisplayParts(driver.name),
    }))
    .sort(
      (a, b) =>
        b.workDays - a.workDays || a.name.localeCompare(b.name, "ja"),
    );

  // 月全体の営業所バランス診断。
  // 301の合計日数は変えず、「メイン営業所を最大限優先」したまま、
  // 未配置を解消するために必要な最小限だけサブ営業所へ振り替える。
  const officeBalanceAdvice = (() => {
    type BalanceRow = {
      name: string;
      mainRegion: Region;
      before: Record<Region, number>;
      recommended: Record<Region, number>;
      moved: string[];
      reserve: boolean;
    };

    const regions: Region[] = ["松阪", "伊勢", "伊賀"];
    const normalize = (value: string) => value.replace(/[\s　]/g, "");

    const rows = new Map<string, BalanceRow>();

    getUniqueDrivers().forEach((driver: DriverItem) => {
      const rawMain = driver.mainArea ?? driver.area.replace("営業所", "");
      const mainRegion: Region =
        rawMain === "伊勢" || rawMain === "伊賀" ? rawMain : "松阪";

      const before = {
        松阪: getTargetWorkDays(autoMonth, "松阪", driver.name) ?? 0,
        伊勢: getTargetWorkDays(autoMonth, "伊勢", driver.name) ?? 0,
        伊賀: getTargetWorkDays(autoMonth, "伊賀", driver.name) ?? 0,
      };

      rows.set(normalize(driver.name), {
        name: driver.name,
        mainRegion,
        before: { ...before },
        recommended: { ...before },
        moved: [],
        reserve:
          normalize(driver.name) === normalize("清水 國光") ||
          driver.assignmentMode === "自動除外",
      });
    });

    const unresolved: string[] = [];

    finalChecks
      .filter((issue) => issue.includes("未配置"))
      .forEach((issue) => {
        const match = issue.match(
          /^(\d{4}-\d{2}-\d{2})\s+(松阪|伊勢|伊賀)\s+(.+?)：(.*未配置.*)$/,
        );
        if (!match) return;

        const dateKey = match[1];
        const targetRegion = match[2] as Region;
        const courseName = match[3];

        const candidates = getUniqueDrivers()
          .filter((driver) => {
            const row = rows.get(normalize(driver.name));
            if (!row) return false;

            // メイン営業所からサブ営業所へ必要最小限だけ動かす。
            if (row.mainRegion === targetRegion) return false;
            if (row.recommended[row.mainRegion] <= 0) return false;

            if (!getDriverOfficeTabs(driver).includes(targetRegion))
              return false;
            if (!canDriverHandleCourse(driver, targetRegion, courseName))
              return false;
            if (!fixedCourseMatches(driver.fixedCourse, courseName))
              return false;

            const requested = dayOffRequestRows.some(
              (request) =>
                normalize(request.driver_name) === normalize(driver.name) &&
                request.requested_date === dateKey,
            );
            if (requested) return false;

            return true;
          })
          .sort((a, b) => {
            const aRow = rows.get(normalize(a.name))!;
            const bRow = rows.get(normalize(b.name))!;

            // 清水國光・自動除外は最後の最後。
            if (aRow.reserve !== bRow.reserve)
              return aRow.reserve ? 1 : -1;

            // 既にサブ営業所へ多く出している人より、
            // まだメイン中心で組めている人を優先。
            const aSub = regions
              .filter((region) => region !== aRow.mainRegion)
              .reduce((sum, region) => sum + aRow.recommended[region], 0);
            const bSub = regions
              .filter((region) => region !== bRow.mainRegion)
              .reduce((sum, region) => sum + bRow.recommended[region], 0);

            return (
              aSub - bSub ||
              bRow.recommended[bRow.mainRegion] -
                aRow.recommended[aRow.mainRegion] ||
              a.name.localeCompare(b.name, "ja")
            );
          });

        const selected = candidates[0];
        if (!selected) {
          unresolved.push(`${dateKey} ${targetRegion} ${courseName}`);
          return;
        }

        const row = rows.get(normalize(selected.name))!;
        row.recommended[row.mainRegion] -= 1;
        row.recommended[targetRegion] += 1;
        row.moved.push(
          `${row.mainRegion}→${targetRegion} 1日（${dateKey.slice(5).replace("-", "/")} ${courseName}対策）`,
        );
      });

    const changed = Array.from(rows.values())
      .filter((row) =>
        regions.some(
          (region) => row.before[region] !== row.recommended[region],
        ),
      )
      .sort((a, b) => {
        if (a.reserve !== b.reserve) return a.reserve ? 1 : -1;
        return a.name.localeCompare(b.name, "ja");
      });

    return { changed, unresolved };
  })();

  const dayOffRequestSummary = monthlyDriverSummary
    .map((driver) => {
      const normalizedName = driver.name.replace(/[\s　]/g, "");
      const dates = dayOffRequestRows
        .filter(
          (row) =>
            row.driver_name.replace(/[\s　]/g, "") === normalizedName,
        )
        .map((row) => row.requested_date)
        .sort();

      return { name: driver.name, dates };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

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
                  className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                    coursePreset === "normal"
                      ? "border-sky-400 bg-sky-500/20 text-sky-200"
                      : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  通常版
                </button>
                <button
                  type="button"
                  onClick={() => applyCoursePreset("weekday")}
                  className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                    coursePreset === "weekday"
                      ? "border-amber-400 bg-amber-400/20 text-amber-200"
                      : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  曜日版
                </button>
                <button
                  type="button"
                  onClick={openCourseChange}
                  className="rounded-xl bg-sky-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
                >
                  コース変更
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

            {courseChangeOpen && (
              <div className="mt-4 rounded-2xl border border-sky-400/30 bg-slate-900/90 p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-white">
                      {selectedDate}・{activeTab}の必要コース
                    </h3>
                    <p className="text-sm text-slate-400">
                      この日だけ変更され、翌月には引き継がれません。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCourseChangeOpen(false)}
                    className="self-start rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-300"
                  >
                    閉じる
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {selectableCourseNames.map((name) => {
                    const selected = courseChangeSelection.includes(name);
                    return (
                      <label
                        key={name}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
                          selected
                            ? "border-sky-400 bg-sky-500/20 text-sky-200"
                            : "border-white/10 bg-white/5 text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            setCourseChangeSelection((previous) =>
                              previous.includes(name)
                                ? previous.filter((item) => item !== name)
                                : [...previous, name],
                            )
                          }
                          className="h-4 w-4"
                        />
                        {name}
                      </label>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyDailyCourseChange}
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950"
                  >
                    この日のコースを確定
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCourseChangeSelection(
                        getCourseNamesForDate(
                          selectedDate,
                          activeTab,
                          coursePreset,
                        ),
                      );
                    }}
                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300"
                  >
                    基本設定に戻す
                  </button>
                </div>
              </div>
            )}

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

            {(officeBalanceAdvice.changed.length > 0 ||
              officeBalanceAdvice.unresolved.length > 0) && (
              <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
                <h3 className="font-bold text-amber-200">
                  💡 松阪・伊勢 営業所バランス診断
                </h3>
                <p className="mt-1 text-xs text-slate-300">
                  301の合計日数は変えず、メイン営業所をできるだけ優先したまま、
                  未配置解消に必要な日数だけサブ営業所へ振り替える推奨案です。
                  清水國光・自動除外ドライバーは他で解消できない場合だけ候補にします。
                </p>

                {officeBalanceAdvice.changed.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-left text-slate-300">
                          <th className="px-2 py-2">ドライバー</th>
                          <th className="px-2 py-2">メイン</th>
                          <th className="px-2 py-2">現在301</th>
                          <th className="px-2 py-2">推奨301</th>
                          <th className="px-2 py-2">変更理由</th>
                        </tr>
                      </thead>
                      <tbody>
                        {officeBalanceAdvice.changed.map((row) => (
                          <tr
                            key={row.name}
                            className="border-b border-white/5 text-slate-100"
                          >
                            <td className="px-2 py-2 font-semibold">
                              {row.name}
                            </td>
                            <td className="px-2 py-2">{row.mainRegion}</td>
                            <td className="px-2 py-2">
                              松阪{row.before["松阪"]}日 / 伊勢
                              {row.before["伊勢"]}日 / 伊賀
                              {row.before["伊賀"]}日
                            </td>
                            <td className="px-2 py-2 font-bold text-emerald-300">
                              松阪{row.recommended["松阪"]}日 / 伊勢
                              {row.recommended["伊勢"]}日 / 伊賀
                              {row.recommended["伊賀"]}日
                            </td>
                            <td className="px-2 py-2 text-amber-100">
                              {row.moved.join("、")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {officeBalanceAdvice.unresolved.length > 0 && (
                  <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
                    <p className="font-bold">
                      このバランス変更だけでは候補が見つからない未配置
                    </p>
                    <ul className="mt-1 list-disc pl-5">
                      {officeBalanceAdvice.unresolved.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

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

            <details className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
              <summary className="cursor-pointer text-lg font-semibold text-white">
                👤 ドライバー担当可能コース
              </summary>
                <p className="mt-2 text-xs text-slate-400">
                  設定画面で保存した担当可能コースを表示しています。変更は「設定」から行ってください。
                </p>
              <p className="mt-2 text-sm text-slate-300">
                メイン営業所を先頭に表示します。サブ営業所はドライバー登録で設定した営業所だけ表示されます。
              </p>
              <div className="mt-4 space-y-4">
                {getUniqueDrivers().map((driver) => {
                  const officeTabs = getDriverOfficeTabs(driver);
                  const mainRegion =
                    (driver.mainArea as Region | undefined) ?? officeTabs[0];
                  const selectedOffice =
                    driverCourseOffice[driver.name] ?? mainRegion;
                  if (!selectedOffice) return null;
                  const supported = getSupportedCoursesForRegion(
                    driver,
                    selectedOffice,
                  );
                  const names = Array.from(
                    new Set([
                      ...(NORMAL_COURSE_NAMES[selectedOffice] ?? []),
                      ...courseSettings
                        .filter((setting) => setting.region === selectedOffice)
                        .map((setting) => setting.name),
                    ]),
                  );

                  return (
                    <div
                      key={driver.name}
                      className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
                    >
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="font-bold text-white">{driver.name}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            メイン営業所：{mainRegion ?? "未設定"}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {officeTabs.map((region) => {
                            const isMain = region === mainRegion;
                            const selected = region === selectedOffice;
                            return (
                              <button
                                key={region}
                                type="button"
                                onClick={() =>
                                  setDriverCourseOffice((previous) => ({
                                    ...previous,
                                    [driver.name]: region,
                                  }))
                                }
                                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                                  selected
                                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                                    : "border-white/15 bg-white/5 text-slate-300"
                                }`}
                              >
                                {region}
                                {isMain ? "（メイン）" : "（サブ）"}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 text-sm font-semibold text-slate-200">
                          {selectedOffice}の担当可能コース
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {names.map((courseName) => {
                            const selected = supported.includes(courseName);
                            return (
                              <button
                                key={courseName}
                                type="button"
                                disabled title="担当可能コースの変更は設定画面から行います"
                                className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                                  selected
                                    ? "border-emerald-400 bg-emerald-500 text-white"
                                    : "border-white/20 bg-white/5 text-slate-300"
                                }`}
                              >
                                {courseName.replace(/コース$/, "")}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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

              <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
                {(() => {
                  const required = getMonthlyRequiredCourseCount(activeTab);
                  const targetDrivers = driversForTargetRegion(activeTab);
                  const assigned = targetDrivers.reduce(
                    (sum, driver) =>
                      sum +
                      (getTargetWorkDays(
                        autoMonth,
                        activeTab,
                        driver.name,
                      ) ?? 0),
                    0,
                  );
                  const remaining = required - assigned;

                  return (
                    <>
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-amber-200">
                            🎯 月間必要コース数（{activeTab}・{autoMonth}）
                          </div>
                          <div className="mt-1 text-4xl font-black text-white">
                            残り{" "}
                            <span
                              className={
                                remaining === 0
                                  ? "text-emerald-300"
                                  : remaining < 0
                                    ? "text-rose-300"
                                    : "text-amber-300"
                              }
                            >
                              {Math.abs(remaining)}
                            </span>
                            <span className="ml-2 text-lg font-bold text-slate-300">
                              {remaining < 0 ? "コース超過" : "コース"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-sm text-slate-300">
                          <div>必要 {required}コース</div>
                          <div>指定済み {assigned}日</div>
                        </div>
                      </div>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-amber-400 transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              required > 0 ? (assigned / required) * 100 : 0,
                            )}%`,
                          }}
                        />
                      </div>

                      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {targetDrivers.map((driver) => {
                          const key = targetKey(
                            autoMonth,
                            activeTab,
                            driver.name,
                          );
                          const value = targetWorkDays[key] ?? "";

                          return (
                            <label
                              key={driver.name}
                              className="grid grid-cols-[1fr_90px] items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
                            >
                              <span>{driver.name}</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={31}
                                  value={value}
                                  onChange={(event) => {
                                    const raw = event.target.value;
                                    setTargetWorkDays((previous) => ({
                                      ...previous,
                                      [key]:
                                        raw === ""
                                          ? ""
                                          : Math.max(
                                              0,
                                              Math.min(
                                                31,
                                                Number(raw) || 0,
                                              ),
                                            ),
                                    }));
                                  }}
                                  placeholder="25"
                                  className="w-full rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-center font-bold text-white"
                                />
                                <span className="text-slate-400">日</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      <div
                        className={`mt-4 rounded-lg px-3 py-2 text-sm font-bold ${
                          remaining === 0
                            ? "bg-emerald-500/15 text-emerald-200"
                            : remaining < 0
                              ? "bg-rose-500/15 text-rose-200"
                              : "bg-amber-500/10 text-amber-100"
                        }`}
                      >
                        {remaining === 0
                          ? "✅ 必要コース数ぴったりです。この日数を目標に月全体へ分散して自動作成します。"
                          : remaining > 0
                            ? `あと${remaining}日分を各ドライバーへ振り分けてください。`
                            : `${Math.abs(remaining)}日分オーバーしています。`}
                      </div>
                    </>
                  );
                })()}
              </div>

              <p className="mt-4 text-sm text-slate-300">
               月間の休日日数など、日付を指定しない条件を入力します。希望する具体的な日付はドライバー用ページから登録してください。
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
                      placeholder="例：月8日休み"
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

            <details className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
              <summary className="cursor-pointer text-base font-semibold text-white">
                📅 月間出勤日数（{activeTab}・{autoMonth}）
              </summary>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {monthlyDriverSummary.map((driver) => (
                  <div
                    key={driver.name}
                    className="rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 whitespace-nowrap font-medium text-slate-200">
                        {driver.name}
                      </span>
                      <span className="shrink-0 text-lg font-bold text-cyan-300">
                        {driver.workDisplayParts.total}
                      </span>
                    </div>
                    {driver.workDisplayParts.breakdown && (
                      <div className="mt-1 text-right text-sm font-semibold text-cyan-300/80">
                        {driver.workDisplayParts.breakdown}
                      </div>
                    )}
                  </div>
                ))}
                {monthlyDriverSummary.length === 0 && (
                  <p className="text-sm text-slate-400">
                    対象ドライバーがいません。
                  </p>
                )}
              </div>
            </details>

            <details className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
              <summary className="cursor-pointer text-base font-semibold text-white">
                🗓️ ドライバー希望休一覧（{activeTab}・{dayOffListMonth}）
              </summary>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-400">
                  ドライバー本人が登録した希望休です。
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="day-off-list-month"
                    className="text-sm font-semibold text-amber-100"
                  >
                    確認する月
                  </label>
                  <input
                    id="day-off-list-month"
                    type="month"
                    value={dayOffListMonth}
                    onChange={(event) => setDayOffListMonth(event.target.value)}
                    className="rounded-lg border border-amber-300/30 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white [color-scheme:dark]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDayOffRequestRefreshKey((previous) => previous + 1)
                    }
                    className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-sm font-semibold text-amber-200"
                  >
                    最新に更新
                  </button>
                </div>
              </div>
              {dayOffRequestMessage && (
                <p className="mt-3 text-sm text-amber-200">
                  {dayOffRequestMessage}
                </p>
              )}
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {dayOffRequestSummary.map((driver) => (
                  <div
                    key={driver.name}
                    className="rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3"
                  >
                    <p className="font-semibold text-slate-200">
                      {driver.name}
                    </p>
                    <p
                      className={`mt-1 text-sm ${
                        driver.dates.length
                          ? "font-semibold text-amber-300"
                          : "text-slate-500"
                      }`}
                    >
                      {driver.dates.length
                        ? driver.dates
                            .map(
                              (date) =>
                                `${Number(date.slice(8, 10))}日`,
                            )
                            .join("・")
                        : "登録なし"}
                    </p>
                  </div>
                ))}
              </div>
            </details>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/70 p-2">
              <table className="min-w-full text-left text-sm">
<thead>
  <tr className="border-b border-white/10 text-slate-400">
    <th className="px-3 py-3 text-left font-semibold">
      コース
    </th>
    <th className="px-3 py-3 text-left font-semibold">
      担当ドライバー
    </th>
    <th className="px-3 py-3 text-center font-semibold">
      今月稼働
    </th>
    <th className="px-3 py-3 text-center font-semibold">
      連勤数
    </th>
    <th className="px-3 py-3 text-center font-semibold">
      配置方法
    </th>
    <th className="px-3 py-3 text-center font-semibold">
      固定
    </th>
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
<td className="px-3 py-3 text-center font-bold text-cyan-300">
  {course.driver ? formatMonthlyWorkDisplay(course.driver) : "―"}
</td>

<td className="px-3 py-3 text-center">
  {course.driver
    ? `${getConsecutiveWorkCount(
        course.driver,
        selectedDate,
      )}連勤`
    : "―"}
</td>

<td className="px-3 py-3 text-center">
  <span
    className={`rounded-full px-3 py-1 text-xs font-bold ${
      course.memo === "手動変更"
        ? "bg-amber-500/20 text-amber-300"
        : "bg-blue-500/20 text-blue-300"
    }`}
  >
    {course.memo === "手動変更" ? "手動" : "自動"}
  </span>
</td>
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
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
  <div className="mb-4">
    <h2 className="text-xl font-bold text-white">
      {autoMonth} 月間シフト表
    </h2>
    <p className="mt-1 text-sm text-slate-400">
      ドライバー名を選択すると、その日のシフトを手動変更できます。
    </p>
    <div className="mt-4 flex flex-wrap gap-2">
  {weekLabels.map((label, index) => (
    <button
      key={label}
      type="button"
      onClick={() => setSelectedWeek(index)}
      className={`rounded-lg px-4 py-2 text-sm font-bold ${
        selectedWeek === index
          ? "bg-blue-600 text-white"
          : "border border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  ))}
</div>
  </div>

  {monthlyDateKeys.length === 0 ? (
    <p className="text-slate-400">
      先に「1か月分を自動作成」を押してください。
    </p>
  ) : (
    <div className="overflow-x-auto">
      <table className="min-w-max border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border border-white/10 bg-slate-900 px-3 py-2 text-left text-white">
              コース
            </th>

            {displayedDateKeys.map((dateKey) => (
              <th
                key={dateKey}
                className="border border-white/10 bg-slate-900 px-3 py-2 text-center text-white"
              >
{new Date(`${dateKey}T00:00:00`).getDate()}日
（
{new Date(`${dateKey}T00:00:00`).toLocaleDateString(
  "ja-JP",
  { weekday: "short" },
)}
）              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {monthlyCourseNames.map((courseName) => (
            <tr key={courseName}>
              <td className="sticky left-0 z-10 border border-white/10 bg-slate-900 px-3 py-2 font-bold text-white">
                {normalizeCourseName(courseName)}
              </td>

              {displayedDateKeys.map((dateKey) => {
                const effectiveCourseNames = resolveCourseNamesForDate(
                  dateKey,
                  activeTab,
                  coursePreset,
                  dailyCourseOverrides[dateKey]?.[activeTab],
                );
                const baseName = normalizeCourseName(courseName);
                const dayCourses = shiftsByDate[dateKey]?.[activeTab] ?? [];

                // 通常は同じ基本コースを表示。
                // 結合コースは別行を作らず、先頭側の基本行に表示する。
                // 例: AB→A行、BC→B行、CD→C行、神久・朝熊→神久行。
                const mergedCourseForBase = dayCourses.find((item) => {
                  const mergedName = normalizeCourseName(item.course);
                  if (sameCourseName(item.course, courseName)) return true;

                  if (activeTab === "松阪") {
                    if (baseName === "A" && mergedName === "AB") return true;
                    if (baseName === "B" && mergedName === "BC") return true;
                    if (baseName === "C" && mergedName === "CD") return true;
                  }

                  if (activeTab === "伊勢") {
                    if (baseName === "神久" && mergedName === "神久・朝熊")
                      return true;
                    if (baseName === "御薗" && mergedName === "御薗・高向")
                      return true;
                  }

                  return false;
                });

                const course = mergedCourseForBase;

                return (
                  <td
                    key={`${dateKey}-${courseName}`}
                    className="border border-white/10 p-2"
                  >
                    {course ? (
                      <select
                        value={course.driver}
                        onChange={(event) =>
                          changeMonthlyCourseDriver(
                            dateKey,
                            activeTab,
                            course.id,
                            event.target.value,
                          )
                        }
                        className="w-32 rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 text-slate-100"
                      >
                        <option value="">未割当</option>

                        {course.driver && (
                          <option value={course.driver}>
                            {course.driver}
                          </option>
                        )}

                        {standbyDrivers
                          .filter(
                            (driver) =>
                              driver.area.replace("営業所", "") ===
                              activeTab,
                          )
                          .map((driver) => (
                            <option
                              key={driver.id}
                              value={driver.name}
                            >
                              {driver.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <span className="text-slate-600">―</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
        </section>
      </div>
    </main>
  );
}
