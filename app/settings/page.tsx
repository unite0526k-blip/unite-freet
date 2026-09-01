"use client";

import { useEffect, useState } from "react";
import { supabase as maybeSupabase } from "../../lib/supabase";

const supabase = maybeSupabase!;

type CoursePriority = {
  office: string;
  course: string;
};

type DriverSetting = {
  id?: string;
  driver_name: string;
  office: string;
  pin_code: string;
  fixed_days_off: string[];
  available_courses: string[];
  course_priorities: CoursePriority[];
  auto_assign: boolean;
};

type MasterDriver = {
  name: string;
  office: string;
  subOffice?: string;
  subOffices?: string[];
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
const COURSE_SETTINGS_STORAGE_KEY = "unite-fleet-course-settings";
type SavedCourseSetting = {
  id?: string;
  name: string;
  region?: string;
  office?: string;
  fixedDriver?: string;
  closedWeekdays?: number[];
};
export default function SettingsPage() {
  const [drivers, setDrivers] = useState<DriverSetting[]>([]);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [targetMonth, setTargetMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [loading, setLoading] = useState(true);
  const [selectedOffice, setSelectedOffice] = useState("松阪営業所");
  const [message, setMessage] = useState("");
  const [masterDrivers, setMasterDrivers] = useState<MasterDriver[]>([]);
  const [courseOfficeByDriver, setCourseOfficeByDriver] =
    useState<Record<string, string>>({});
  const [savedCourseSettings, setSavedCourseSettings] =
    useState<SavedCourseSetting[]>([]);
  const [newCourseName, setNewCourseName] = useState("");
  const [courseSaving, setCourseSaving] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    setMessage("");
try {
  const saved = localStorage.getItem(COURSE_SETTINGS_STORAGE_KEY);

  if (saved) {
    const parsed = JSON.parse(saved) as SavedCourseSetting[];
    setSavedCourseSettings(Array.isArray(parsed) ? parsed : []);
  } else {
    setSavedCourseSettings([]);
  }
} catch {
  setSavedCourseSettings([]);
}
    const [driverResult, limitResult, masterResult] = await Promise.all([
      supabase
        .from("shift_driver_settings")
        .select("*")
        .order("office")
        .order("driver_name"),

      supabase
        .from("shift_monthly_limits")
        .select("driver_name, day_limit")
        .eq("target_month", targetMonth),

      supabase
        .from("fleet_master")
        .select("drivers,course_settings")
        .eq("id", "default")
        .maybeSingle(),
    ]);

    if (driverResult.error) {
      setMessage(`読込エラー：${driverResult.error.message}`);
      setLoading(false);
      return;
    }

    if (masterResult.error) {
      setMessage(`ドライバー管理の読込エラー：${masterResult.error.message}`);
      setLoading(false);
      return;
    }

    // コース設定は fleet_master.course_settings を正本にする。
    // これで別端末でも、追加・削除したコースが同じ候補として表示される。
    const cloudCourseSettings = (masterResult.data?.course_settings ?? []) as SavedCourseSetting[];
    if (Array.isArray(cloudCourseSettings)) {
      // Supabase の course_settings を正本として扱う。
      // region が「松阪」、office が「松阪営業所」のどちらの保存形式でも統一して読む。
      const normalizedCloudCourseSettings = cloudCourseSettings
        .map((setting) => {
          const rawOffice = String(setting.office ?? setting.region ?? "").trim();
          const office = rawOffice
            ? rawOffice.endsWith("営業所")
              ? rawOffice
              : `${rawOffice}営業所`
            : "";

          return {
            ...setting,
            office,
            region: office.replace(/営業所$/, ""),
            name: String(setting.name ?? "").trim().replace(/コース$/, ""),
          };
        })
        .filter((setting) => setting.office && setting.name);

      setSavedCourseSettings(normalizedCloudCourseSettings);
      localStorage.setItem(
        COURSE_SETTINGS_STORAGE_KEY,
        JSON.stringify(normalizedCloudCourseSettings),
      );
    }

    const monthlyLimits: Record<string, number> = {};

    for (const item of limitResult.data ?? []) {
      monthlyLimits[item.driver_name] = item.day_limit;
    }

    const normalizeName = (value: string) => value.replace(/[\s　]/g, "");
    const nextMasterDrivers =
      ((masterResult.data?.drivers ?? []) as MasterDriver[]).map((driver) => ({
        ...driver,
        subOffices: Array.from(
          new Set([
            ...(driver.subOffices ?? []),
            ...(driver.subOffice ? [driver.subOffice] : []),
          ]),
        ).filter((office) => office && office !== driver.office),
      }));

    const settingsByName = new Map(
      ((driverResult.data ?? []) as DriverSetting[]).map((setting) => [
        normalizeName(setting.driver_name),
        setting,
      ]),
    );

    // 表示するドライバーは fleet_master（ドライバー管理）にいる人だけ。
    const synchronizedDrivers: DriverSetting[] = nextMasterDrivers
      .filter((master) => master.name?.trim())
      .map((master) => {
        const existing = settingsByName.get(normalizeName(master.name));
        return {
          id: existing?.id,
          driver_name: master.name,
          office: master.office,
          pin_code: existing?.pin_code ?? "0000",
          fixed_days_off: existing?.fixed_days_off ?? [],
          available_courses: existing?.available_courses ?? [],
          course_priorities: existing?.course_priorities ?? [],
          auto_assign: existing?.auto_assign ?? true,
        };
      });

    setMasterDrivers(nextMasterDrivers);
    setDrivers(synchronizedDrivers);
    setCourseOfficeByDriver((current) => {
      const next = { ...current };
      for (const driver of synchronizedDrivers) {
        const key = driver.id ?? driver.driver_name;
        if (!next[key]) next[key] = driver.office;
      }
      return next;
    });
    setLimits(monthlyLimits);
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, [targetMonth]);

  const updateDriver = (
    driverKey: string,
    changes: Partial<DriverSetting>,
  ) => {
    setDrivers((current) =>
      current.map((driver) =>
        (driver.id ?? driver.driver_name) === driverKey
          ? { ...driver, ...changes }
          : driver,
      ),
    );
  };

  const toggleFixedDay = (driver: DriverSetting, day: string) => {
    const current = driver.fixed_days_off ?? [];
    const next = current.includes(day)
      ? current.filter((item) => item !== day)
      : [...current, day];

    updateDriver(driver.id ?? driver.driver_name, { fixed_days_off: next });
  };

  const courseKey = (office: string, course: string) =>
    `${office}|||${course}`;

  const hasAvailableCourse = (
    driver: DriverSetting,
    office: string,
    course: string,
  ) => {
    const current = driver.available_courses ?? [];
    return (
      current.includes(courseKey(office, course)) ||
      (office === driver.office && current.includes(course))
    );
  };

  const toggleCourse = (
    driver: DriverSetting,
    office: string,
    course: string,
  ) => {
    const current = driver.available_courses ?? [];
    const qualified = courseKey(office, course);
    const legacySelected =
      office === driver.office && current.includes(course);
    const selected = current.includes(qualified) || legacySelected;

    let next = current.filter(
      (item) => item !== qualified && !(legacySelected && item === course),
    );
    if (!selected) next = [...next, qualified];

    updateDriver(driver.id ?? driver.driver_name, { available_courses: next });
  };

  const getRegisteredOffices = (driver: DriverSetting) => {
    
    const normalizeName = (value: string) => value.replace(/[\s　]/g, "");
    const master = masterDrivers.find(
      (item) =>
        normalizeName(item.name) === normalizeName(driver.driver_name),
    );

    const mainOffice = master?.office ?? driver.office;
    const subOffices = Array.from(
      new Set([
        ...(master?.subOffices ?? []),
        ...(master?.subOffice ? [master.subOffice] : []),
      ]),
    ).filter((office) => office && office !== mainOffice);

    return [mainOffice, ...subOffices];
  };
  const getCoursesForOffice = (office: string) => {
    const normalizedOffice = office.endsWith("営業所")
      ? office
      : `${office}営業所`;

    // まず初期コースを入れる（松阪なら A〜H など）
    const defaultCourses = OFFICE_COURSES[normalizedOffice] ?? [];

    // fleet_master.course_settings / localStorage に追加されたコースも拾う。
    // 保存形式が office / region のどちらでも読めるようにする。
    const savedCourses = savedCourseSettings
      .filter((setting) => {
        const rawOffice = String(
          setting.office ?? setting.region ?? "",
        ).trim();

        const settingOffice = rawOffice.endsWith("営業所")
          ? rawOffice
          : `${rawOffice}営業所`;

        return settingOffice === normalizedOffice;
      })
      .map((setting) => String(setting.name ?? "").trim())
      .filter(Boolean)
      .map((name) => name.replace(/コース$/, ""));

    // A〜H + 高町のように結合して重複を除去する。
    return Array.from(
      new Set([
        ...defaultCourses.map((name) =>
          String(name).trim().replace(/コース$/, ""),
        ),
        ...savedCourses,
      ]),
    );
  };

  const normalizeOffice = (value: string) =>
    value.endsWith("営業所") ? value : `${value}営業所`;

  const saveCourseSettingsToCloud = async (
    nextSettings: SavedCourseSetting[],
    successMessage: string,
  ) => {
    setCourseSaving(true);
    setMessage("");

    try {
      localStorage.setItem(
        COURSE_SETTINGS_STORAGE_KEY,
        JSON.stringify(nextSettings),
      );

      const { error } = await supabase
        .from("fleet_master")
        .update({
          course_settings: nextSettings,
          updated_at: new Date().toISOString(),
        })
        .eq("id", "default");

      if (error) {
        setMessage(`コース保存エラー：${error.message}`);
        return false;
      }

      setSavedCourseSettings(nextSettings);
      setMessage(successMessage);
      return true;
    } finally {
      setCourseSaving(false);
    }
  };

  const addCourse = async () => {
    const name = newCourseName.trim().replace(/コース$/, "");
    if (!name) {
      setMessage("追加するコース名を入力してください。");
      return;
    }

    const exists = getCoursesForOffice(selectedOffice).some(
      (course) => course === name,
    );
    if (exists) {
      setMessage(`${selectedOffice}には「${name}」がすでにあります。`);
      return;
    }

    // fleet_master.course_settings がまだ空なら、現在の初期コースも一緒に正本化する。
    const baseSettings: SavedCourseSetting[] =
      savedCourseSettings.length > 0
        ? savedCourseSettings
        : Object.entries(OFFICE_COURSES).flatMap(([office, courses]) =>
            courses.map((course) => ({
              office,
              region: office.replace(/営業所$/, ""),
              name: course,
            })),
          );

    const nextSettings: SavedCourseSetting[] = [
      ...baseSettings,
      {
        id: `${selectedOffice.replace(/営業所$/, "")}-${Date.now()}`,
        office: selectedOffice,
        region: selectedOffice.replace(/営業所$/, ""),
        name,
        fixedDriver: "",
        closedWeekdays: [],
      },
    ];

    const saved = await saveCourseSettingsToCloud(
      nextSettings,
      `${selectedOffice}に「${name}」を追加しました。`,
    );
    if (saved) setNewCourseName("");
  };

  const deleteCourse = async (course: string) => {
    if (
      !window.confirm(
        `「${selectedOffice}・${course}」を削除しますか？\n担当可能コースと優先順位からも外します。`,
      )
    ) {
      return;
    }

    // course_settings がまだ空なら、初期コースを正本化してから対象だけ除く。
    const baseSettings: SavedCourseSetting[] =
      savedCourseSettings.length > 0
        ? savedCourseSettings
        : Object.entries(OFFICE_COURSES).flatMap(([office, courses]) =>
            courses.map((name) => ({
              office,
              region: office.replace(/営業所$/, ""),
              name,
            })),
          );

    const nextSettings = baseSettings.filter((setting) => {
      const office = setting.office ?? setting.region ?? "";
      const name = String(setting.name ?? "").trim().replace(/コース$/, "");
      return !(
        normalizeOffice(office) === normalizeOffice(selectedOffice) &&
        name === course
      );
    });

    const { error: masterError } = await supabase
      .from("fleet_master")
      .update({
        course_settings: nextSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "default");

    if (masterError) {
      setMessage(`コース削除エラー：${masterError.message}`);
      return;
    }

    // 削除コースを全ドライバーの担当可能コース・優先順位からも除去。
    const affectedDrivers = drivers.filter(
      (driver) =>
        hasAvailableCourse(driver, selectedOffice, course) ||
        (driver.course_priorities ?? []).some(
          (priority) =>
            normalizeOffice(priority.office) === normalizeOffice(selectedOffice) &&
            priority.course === course,
        ),
    );

    for (const driver of affectedDrivers) {
      const nextAvailable = (driver.available_courses ?? []).filter((item) => {
        if (item === courseKey(selectedOffice, course)) return false;
        if (driver.office === selectedOffice && item === course) return false;
        return true;
      });

      const nextPriorities = (driver.course_priorities ?? []).filter(
        (priority) =>
          !(
            normalizeOffice(priority.office) === normalizeOffice(selectedOffice) &&
            priority.course === course
          ),
      );

      const { error } = await supabase
        .from("shift_driver_settings")
        .update({
          available_courses: nextAvailable,
          course_priorities: nextPriorities,
          updated_at: new Date().toISOString(),
        })
        .eq("driver_name", driver.driver_name);

      if (error) {
        setMessage(
          `コース本体は削除しましたが、${driver.driver_name}の設定更新でエラー：${error.message}`,
        );
        await loadSettings();
        return;
      }
    }

    localStorage.setItem(
      COURSE_SETTINGS_STORAGE_KEY,
      JSON.stringify(nextSettings),
    );
    setSavedCourseSettings(nextSettings);

    setDrivers((current) =>
      current.map((driver) => ({
        ...driver,
        available_courses: (driver.available_courses ?? []).filter((item) => {
          if (item === courseKey(selectedOffice, course)) return false;
          if (driver.office === selectedOffice && item === course) return false;
          return true;
        }),
        course_priorities: (driver.course_priorities ?? []).filter(
          (priority) =>
            !(
              normalizeOffice(priority.office) === normalizeOffice(selectedOffice) &&
              priority.course === course
            ),
        ),
      })),
    );

    setMessage(`${selectedOffice}の「${course}」を削除しました。`);
  };

  const saveDriver = async (driver: DriverSetting) => {
    setMessage("");

    if (!/^\d{4}$/.test(driver.pin_code)) {
      setMessage(`${driver.driver_name}のPINは4桁の数字にしてください。`);
      return;
    }

    const payload = {
      driver_name: driver.driver_name,
      office: driver.office,
      pin_code: driver.pin_code,
      fixed_days_off: driver.fixed_days_off ?? [],
      available_courses: driver.available_courses ?? [],
      course_priorities: driver.course_priorities ?? [],
      auto_assign: driver.auto_assign,
      updated_at: new Date().toISOString(),
    };

    const saveResult = driver.id
      ? await supabase
          .from("shift_driver_settings")
          .update(payload)
          .eq("id", driver.id)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("shift_driver_settings")
          .insert(payload)
          .select("id")
          .single();

    const error = saveResult.error;

    if (!error && !driver.id && saveResult.data?.id) {
      updateDriver(driver.driver_name, { id: saveResult.data.id });
    }

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
        },
      );

    if (limitError) {
      setMessage(`上限保存エラー：${limitError.message}`);
      return;
    }

    setMessage(`${driver.driver_name}の設定を保存しました。`);
  };


  if (loading) {
    return <p className="p-6">設定を読み込み中...</p>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">シフト設定</h1>

        <p className="mt-2 text-sm text-gray-600">
          ドライバーはドライバー管理から自動反映します。担当可能コースはこの設定画面を正本として保存し、シフト管理では確認専用で表示します。ここではPIN・希望休上限・固定休・担当可能コース・コース優先順位・自動振り分けを設定します。
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
        <div className="mt-5 rounded-lg border bg-gray-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold">
                {selectedOffice}のコース管理
              </p>
              <p className="mt-1 text-xs text-gray-500">
                ここで追加・削除したコースは担当可能コースとシフト管理の候補に反映されます。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newCourseName}
                onChange={(event) => setNewCourseName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addCourse();
                  }
                }}
                placeholder="例：高町"
                className="rounded border bg-white px-3 py-2"
              />
              <button
                type="button"
                onClick={() => void addCourse()}
                disabled={courseSaving}
                className="rounded bg-green-600 px-4 py-2 font-bold text-white disabled:opacity-50"
              >
                ＋ コース追加
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {getCoursesForOffice(selectedOffice).length === 0 ? (
              <p className="text-sm text-gray-500">コースはまだありません。</p>
            ) : (
              getCoursesForOffice(selectedOffice).map((course) => (
                <div
                  key={`${selectedOffice}-${course}`}
                  className="flex items-center overflow-hidden rounded border bg-white"
                >
                  <span className="px-3 py-2 font-bold">{course}</span>
                  <button
                    type="button"
                    onClick={() => void deleteCourse(course)}
                    disabled={courseSaving}
                    className="border-l px-3 py-2 text-sm font-bold text-red-600 disabled:opacity-50"
                  >
                    削除
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {message && (
          <p className="mt-4 rounded bg-yellow-100 p-3 text-sm">{message}</p>
        )}
      </div>

      <div className="space-y-4">
        {drivers
          .filter((driver) => driver.office === selectedOffice)
          .map((driver) => {
            const registeredOffices = getRegisteredOffices(driver);
            const courseOffice =
              courseOfficeByDriver[driver.id ?? driver.driver_name] ??
              registeredOffices[0] ??
              driver.office;
const courses = getCoursesForOffice(courseOffice);
            return (
              <section
                key={driver.id ?? driver.driver_name}
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
                          updateDriver(driver.id ?? driver.driver_name, {
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
                        disabled
                        title="ドライバー管理のメイン営業所から自動反映されます"
                        className="mt-1 rounded border bg-gray-100 px-3 py-2 text-gray-700 disabled:opacity-100"
                      >
                        <option value="松阪営業所">松阪営業所</option>
                        <option value="伊勢営業所">伊勢営業所</option>
                        <option value="鈴鹿営業所">鈴鹿営業所</option>
                        <option value="伊賀営業所">伊賀営業所</option>
                        <option value="浜松営業所">浜松営業所</option>
                        <option value="京都営業所">京都営業所</option>
                        <option value="営業所なし">営業所なし</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        ドライバー管理のメイン営業所から自動反映
                      </p>
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
                  </div>{" "}
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-bold">4桁PIN</label>

                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={driver.pin_code}
                      onChange={(event) =>
                        updateDriver(driver.id ?? driver.driver_name, {
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
                      const selected = driver.fixed_days_off?.includes(day);

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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">担当可能コース</p>
                    <span className="rounded bg-green-100 px-2 py-1 text-xs font-bold text-green-800">
                      この画面で設定・保存
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {registeredOffices.map((office, index) => (
                      <button
                        key={office}
                        type="button"
                        onClick={() =>
                          setCourseOfficeByDriver((current) => ({
                            ...current,
                            [driver.id ?? driver.driver_name]: office,
                          }))
                        }
                        className={`rounded border px-4 py-2 font-bold ${
                          courseOffice === office
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "bg-white text-gray-700"
                        }`}
                      >
                        {office.replace("営業所", "")}
                        {index === 0 ? "（メイン）" : "（サブ）"}
                      </button>
                    ))}
                  </div>

                  <p className="mt-2 text-xs text-gray-500">
                    メイン営業所を先頭表示。サブ営業所はドライバー管理で登録した営業所だけ選択できます。
                  </p>

                  {courses.length === 0 ? (
                    <p className="mt-3 text-sm text-gray-500">
                      {courseOffice}のコースは後から設定できます。
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {courses.map((course) => {
                        const selected = hasAvailableCourse(
                          driver,
                          courseOffice,
                          course,
                        );

                        return (
                          <button
                            key={`${courseOffice}-${course}`}
                            type="button"
                            onClick={() =>
                              toggleCourse(driver, courseOffice, course)
                            }
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
                <div className="mt-5 rounded-lg border bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">コース優先順位</p>
                      <p className="mt-1 text-xs text-gray-500">
                        メイン営業所と登録済みサブ営業所のコースから選択できます。
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        updateDriver(driver.id ?? driver.driver_name, {
                          course_priorities: [
                            ...(driver.course_priorities ?? []),
                            {
                              office: registeredOffices[0] ?? driver.office,
                              course:
  getCoursesForOffice(
    registeredOffices[0] ?? driver.office
  )[0] ?? "",
                            },
                          ],
                        })
                      }
                      className="rounded bg-green-600 px-4 py-2 text-sm font-bold text-white"
                    >
                      ＋ 優先コース追加
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {(driver.course_priorities ?? []).map((priority, index) => (
                      <div
                        key={`${driver.id ?? driver.driver_name}-${index}`}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span className="w-12 text-sm font-bold">
                          {index + 1}番
                        </span>

                        <select
                          value={`${priority.office}|||${priority.course}`}
                          onChange={(event) => {
                            const [office, course] =
                              event.target.value.split("|||");
                            const nextPriorities = [
                              ...(driver.course_priorities ?? []),
                            ];

                            nextPriorities[index] = { office, course };

                            updateDriver(driver.id ?? driver.driver_name, {
                              course_priorities: nextPriorities,
                            });
                          }}
                          className="min-w-56 rounded border bg-white px-3 py-2"
                        >
{registeredOffices.flatMap((office) =>
  getCoursesForOffice(office).map((course) => (
    <option
      key={`${office}-${course}`}
      value={`${office}|||${course}`}
    >
      {office}・{course}
    </option>
  )),
)}                        </select>

                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => {
                            const nextPriorities = [
                              ...(driver.course_priorities ?? []),
                            ];
                            const [movedPriority] = nextPriorities.splice(
                              index,
                              1,
                            );

                            if (!movedPriority) return;

                            nextPriorities.splice(index - 1, 0, movedPriority);

                            updateDriver(driver.id ?? driver.driver_name, {
                              course_priorities: nextPriorities,
                            });
                          }}
                          className="rounded bg-gray-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          disabled={
                            index ===
                            (driver.course_priorities ?? []).length - 1
                          }
                          onClick={() => {
                            const nextPriorities = [
                              ...(driver.course_priorities ?? []),
                            ];
                            const [movedPriority] = nextPriorities.splice(
                              index,
                              1,
                            );

                            if (!movedPriority) return;

                            nextPriorities.splice(index + 1, 0, movedPriority);

                            updateDriver(driver.id ?? driver.driver_name, {
                              course_priorities: nextPriorities,
                            });
                          }}
                          className="rounded bg-gray-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ↓
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateDriver(driver.id ?? driver.driver_name, {
                              course_priorities: (
                                driver.course_priorities ?? []
                              ).filter(
                                (_, priorityIndex) => priorityIndex !== index,
                              ),
                            })
                          }
                          className="rounded bg-red-600 px-3 py-2 text-sm font-bold text-white"
                        >
                          削除
                        </button>
                      </div>
                    ))}

                    {(driver.course_priorities ?? []).length === 0 && (
                      <p className="text-sm text-gray-500">
                        優先順位は未設定です。
                      </p>
                    )}
                  </div>
                </div>
                <label className="mt-5 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={driver.auto_assign}
                    onChange={(event) =>
                      updateDriver(driver.id ?? driver.driver_name, {
                        auto_assign: event.target.checked,
                      })
                    }
                    className="h-5 w-5"
                  />

                  <span className="font-bold">自動振り分けの対象にする</span>
                </label>
              </section>
            );
          })}
      </div>
    </div>
  );
}
