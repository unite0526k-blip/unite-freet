"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase as maybeSupabase } from "../../lib/supabase";

const supabase = maybeSupabase!;

const DEFAULT_OFFICES = [
  "松阪営業所",
  "伊勢営業所",
  "鈴鹿営業所",
  "伊賀営業所",
  "浜松営業所",
  "京都営業所",
];

type DriverStatus = "稼働" | "休み" | "応援" | "退職";
type AssignmentMode = "通常" | "応援のみ" | "最終候補" | "自動除外";

type StoredCourseSetting = {
  region: string;
  name: string;
};

type Driver = {
  id: number;
  office: string;
  subOffice?: string;
  subOffices?: string[];
  name: string;
  phone: string;
  vehicle: string;
  status: DriverStatus;
  supportedCourses?: string[];
  fixedCourse?: string;
  assignmentMode?: AssignmentMode;
};

type DriverForm = Omit<Driver, "id" | "subOffice">;

const STORAGE_KEY = "unite-fleet-drivers";
const OFFICES_STORAGE_KEY = "unite-fleet-offices";
const COURSE_SETTINGS_KEY = "unite-fleet-course-settings";

const DEFAULT_COURSES: StoredCourseSetting[] = [
  ...["A", "B", "C", "D", "E", "F", "G", "H"].map((name) => ({
    region: "松阪",
    name: `${name}コース`,
  })),
  ...["朝熊", "神久", "御薗", "高向"].map((name) => ({
    region: "伊勢",
    name: `${name}コース`,
  })),
  { region: "伊賀", name: "赤目コース" },
];

const DEFAULT_DRIVERS: Driver[] = [
  ...[
    "清水 國光",
    "清水 光真",
    "徳田 亮太",
    "横溝 一泰",
    "中川 昭治",
    "楠滝 空杜",
    "真田 拓海",
    "齋藤 朋樹",
    "福田 華月",
    "垣内 連",
    "伊藤 圭志",
  ].map((name, index) => ({
    id: 100 + index,
    office: "松阪営業所",
    subOffices: [],
    name,
    phone: "",
    vehicle: "",
    status: "稼働" as const,
  })),
  ...["東 真規", "勝村 武史", "藤原 颯士", "西田 勇太"].map((name, index) => ({
    id: 200 + index,
    office: "伊勢営業所",
    subOffices: [],
    name,
    phone: "",
    vehicle: "",
    status: "稼働" as const,
  })),
  {
    id: 300,
    office: "鈴鹿営業所",
    subOffices: [],
    name: "仲村 賢一郎",
    phone: "",
    vehicle: "",
    status: "稼働",
  },
  ...["山崎 雅也", "辻本 顕寛", "小倉 祐司", "吉田 健人"].map(
    (name, index) => ({
      id: 400 + index,
      office: "伊賀営業所",
      subOffices: [],
      name,
      phone: "",
      vehicle: "",
      status: "稼働" as const,
    }),
  ),
  ...["津嘉山", "藤田", "レイネル"].map((name, index) => ({
    id: 500 + index,
    office: "浜松営業所",
    subOffices: [],
    name,
    phone: "",
    vehicle: "",
    status: "稼働" as const,
  })),
];

const emptyForm = (): DriverForm => ({
  office: "",
  subOffices: [],
  name: "",
  phone: "",
  vehicle: "",
  status: "稼働",
  supportedCourses: [],
  fixedCourse: "",
  assignmentMode: "通常",
});

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DriverForm>(emptyForm);
  const [offices, setOffices] = useState<string[]>(DEFAULT_OFFICES);
  const [officeInput, setOfficeInput] = useState("");
  const [editingOffice, setEditingOffice] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [subOfficeOpen, setSubOfficeOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [courseSettings, setCourseSettings] =
    useState<StoredCourseSetting[]>(DEFAULT_COURSES);
  const [session, setSession] = useState<Session | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMessage, setCloudMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) =>
      setSession(nextSession),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const savedOffices = localStorage.getItem(OFFICES_STORAGE_KEY);
    if (savedOffices) {
      try {
        const parsedOffices = JSON.parse(savedOffices) as string[];
        if (parsedOffices.length) setOffices(parsedOffices);
      } catch {
        setOffices(DEFAULT_OFFICES);
      }
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    const savedCourses = localStorage.getItem(COURSE_SETTINGS_KEY);
    if (savedCourses) {
      try {
        const parsedCourses = JSON.parse(savedCourses) as StoredCourseSetting[];
        if (parsedCourses.length) setCourseSettings(parsedCourses);
      } catch {
        setCourseSettings(DEFAULT_COURSES);
      }
    }
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Driver[];
        const normalized = parsed.map((driver) => ({
          ...driver,
          subOffices: Array.from(
            new Set([
              ...(driver.subOffices ?? []),
              ...(driver.subOffice ? [driver.subOffice] : []),
            ]),
          ),
          supportedCourses: driver.supportedCourses ?? [],
          fixedCourse: driver.fixedCourse ?? "",
          assignmentMode: driver.assignmentMode ?? "通常",
        }));
        setDrivers(normalized.length ? normalized : DEFAULT_DRIVERS);
      } catch {
        setDrivers(DEFAULT_DRIVERS);
      }
    } else {
      setDrivers(DEFAULT_DRIVERS);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drivers));
  }, [drivers, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(OFFICES_STORAGE_KEY, JSON.stringify(offices));
  }, [offices, loaded]);

  const loadCloudMaster = async () => {
    if (!session)
      return setCloudMessage("シフト管理で管理者ログインしてください");
    setCloudBusy(true);
    const { data, error } = await supabase
      .from("fleet_master")
      .select("offices,drivers,course_settings")
      .eq("id", "default")
      .maybeSingle();
    if (error) setCloudMessage(`読込エラー：${error.message}`);
    else if (!data) setCloudMessage("クラウド設定はまだありません");
    else {
      const nextOffices = data.offices as string[];
      const nextDrivers = data.drivers as Driver[];
      const nextCourses = data.course_settings as StoredCourseSetting[];
      if (nextOffices?.length) setOffices(nextOffices);
      if (nextDrivers?.length) setDrivers(nextDrivers);
      if (nextCourses?.length) setCourseSettings(nextCourses);
      localStorage.setItem(OFFICES_STORAGE_KEY, JSON.stringify(nextOffices));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDrivers));
      localStorage.setItem(COURSE_SETTINGS_KEY, JSON.stringify(nextCourses));
      setCloudMessage("クラウド設定を読み込みました");
    }
    setCloudBusy(false);
  };

  const saveCloudMaster = async () => {
    if (!session)
      return setCloudMessage("シフト管理で管理者ログインしてください");
    setCloudBusy(true);
    const { error } = await supabase.from("fleet_master").upsert({
      id: "default",
      offices,
      drivers,
      course_settings: courseSettings,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    });
    setCloudMessage(
      error ? `保存エラー：${error.message}` : "設定をクラウド保存しました",
    );
    setCloudBusy(false);
  };

  const saveOffice = () => {
    const name = officeInput.trim();
    if (!name) return alert("営業所名を入力してください");
    if (offices.some((office) => office === name && office !== editingOffice)) {
      return alert("同じ営業所名がすでにあります");
    }

    if (editingOffice) {
      setOffices((previous) =>
        previous.map((office) => (office === editingOffice ? name : office)),
      );
      setDrivers((previous) =>
        previous.map((driver) => ({
          ...driver,
          office: driver.office === editingOffice ? name : driver.office,
          subOffices: (driver.subOffices ?? []).map((office) =>
            office === editingOffice ? name : office,
          ),
        })),
      );
      setForm((previous) => ({
        ...previous,
        office: previous.office === editingOffice ? name : previous.office,
        subOffices: (previous.subOffices ?? []).map((office) =>
          office === editingOffice ? name : office,
        ),
      }));
    } else {
      setOffices((previous) => [...previous, name]);
    }
    setOfficeInput("");
    setEditingOffice(null);
  };

  const startEditOffice = (office: string) => {
    setEditingOffice(office);
    setOfficeInput(office);
  };

  const deleteOffice = (office: string) => {
    if (offices.length <= 1) return alert("営業所は最低1つ必要です");
    if (drivers.some((driver) => driver.office === office)) {
      return alert("メイン営業所に登録中のドライバーがいるため削除できません");
    }
    if (!confirm(`${office}を削除しますか？`)) return;
    setOffices((previous) => previous.filter((item) => item !== office));
    setDrivers((previous) =>
      previous.map((driver) => ({
        ...driver,
        subOffices: (driver.subOffices ?? []).filter((item) => item !== office),
      })),
    );
  };

  const filteredDrivers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return drivers.filter((driver) =>
      [
        driver.office,
        ...(driver.subOffices ?? []),
        driver.name,
        driver.phone,
        driver.vehicle,
        driver.status,
        ...(driver.supportedCourses ?? []),
        driver.fixedCourse ?? "",
        driver.assignmentMode ?? "通常",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [drivers, search]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setSubOfficeOpen(false);
    setAssignmentOpen(false);
  };

  const eligibleRegions = useMemo(
    () =>
      [form.office, ...(form.subOffices ?? [])]
        .filter(Boolean)
        .map((office) => office.replace("営業所", "")),
    [form.office, form.subOffices],
  );

  const availableCourses = useMemo(
    () =>
      courseSettings.filter((course) =>
        eligibleRegions.includes(course.region),
      ),
    [courseSettings, eligibleRegions],
  );

  const saveDriver = () => {
    if (!form.office || !form.name.trim()) {
      alert("メイン営業所・氏名は必須です");
      return;
    }
    const normalized = {
      ...form,
      name: form.name.trim(),
      subOffices: (form.subOffices ?? []).filter(
        (office) => office !== form.office,
      ),
      supportedCourses: form.supportedCourses ?? [],
      fixedCourse: form.fixedCourse ?? "",
      assignmentMode: form.assignmentMode ?? "通常",
    };
    if (editingId !== null) {
      setDrivers((previous) =>
        previous.map((driver) =>
          driver.id === editingId ? { ...driver, ...normalized } : driver,
        ),
      );
    } else {
      setDrivers((previous) => [
        ...previous,
        { id: Date.now(), ...normalized },
      ]);
    }
    resetForm();
  };

  const editDriver = (driver: Driver) => {
    setEditingId(driver.id);
    setForm({
      office: driver.office,
      subOffices:
        driver.subOffices ?? (driver.subOffice ? [driver.subOffice] : []),
      name: driver.name,
      phone: driver.phone,
      vehicle: driver.vehicle,
      status: driver.status,
      supportedCourses: driver.supportedCourses ?? [],
      fixedCourse: driver.fixedCourse ?? "",
      assignmentMode: driver.assignmentMode ?? "通常",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteDriver = (id: number) => {
    if (!confirm("削除しますか？")) return;
    setDrivers((previous) => previous.filter((driver) => driver.id !== id));
    if (editingId === id) resetForm();
  };

  return (
    <main className="p-6">
      <h1 className="mb-6 text-2xl font-bold">ドライバー管理</h1>

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border bg-blue-50 p-3">
        <span className="font-semibold">☁️ マスター設定</span>
        <button
          type="button"
          disabled={cloudBusy}
          onClick={loadCloudMaster}
          className="rounded border bg-white px-4 py-2 font-semibold disabled:opacity-50"
        >
          クラウドから読込
        </button>
        <button
          type="button"
          disabled={cloudBusy}
          onClick={saveCloudMaster}
          className="rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          クラウドへ保存
        </button>
        <span className="text-sm font-semibold text-blue-800">
          {cloudMessage}
        </span>
      </div>

      <details className="mb-5 rounded-xl border bg-white p-4">
        <summary className="cursor-pointer font-bold">
          営業所を追加・編集
        </summary>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={officeInput}
            onChange={(event) => setOfficeInput(event.target.value)}
            placeholder="例：津営業所"
            className="min-w-60 flex-1 rounded border px-3 py-2"
          />
          <button
            type="button"
            onClick={saveOffice}
            className="rounded bg-blue-600 px-4 py-2 font-semibold text-white"
          >
            {editingOffice ? "営業所名を更新" : "営業所を追加"}
          </button>
          {editingOffice && (
            <button
              type="button"
              onClick={() => {
                setEditingOffice(null);
                setOfficeInput("");
              }}
              className="rounded border px-4 py-2"
            >
              キャンセル
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {offices.map((office) => (
            <div
              key={office}
              className="flex items-center gap-1 rounded-full border bg-gray-50 px-3 py-1.5 text-sm"
            >
              <span>{office}</span>
              <button
                type="button"
                onClick={() => startEditOffice(office)}
                className="ml-1 font-semibold text-orange-600"
              >
                編集
              </button>
              <button
                type="button"
                onClick={() => deleteOffice(office)}
                className="font-semibold text-red-600"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </details>

      <div className="overflow-x-auto">
        <div className="min-w-[1050px]">
          <div className="mb-3 grid grid-cols-[140px_190px_130px_150px_140px_90px_150px] gap-2">
            <select
              className="min-w-0 rounded border p-2"
              value={form.office}
              onChange={(event) =>
                setForm({ ...form, office: event.target.value })
              }
            >
              <option value="">メイン営業所</option>
              {offices.map((office) => (
                <option key={office} value={office}>
                  {office}
                </option>
              ))}
            </select>

            <details
              open={subOfficeOpen}
              onToggle={(event) => setSubOfficeOpen(event.currentTarget.open)}
              className="relative min-w-0 rounded border bg-white"
            >
              <summary className="flex h-full min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm">
                <span className="truncate">
                  {(form.subOffices ?? []).length === 0
                    ? "サブ営業所"
                    : (form.subOffices ?? []).length === 1
                      ? form.subOffices?.[0]
                      : `${form.subOffices?.[0]} etc. +${(form.subOffices ?? []).length - 1}`}
                </span>
                <span>▼</span>
              </summary>
              <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border bg-white p-3 shadow-lg">
                <p className="mb-3 border-b pb-2 text-sm font-semibold">
                  サブ営業所（複数選択可）
                </p>
                <div className="space-y-2">
                  {offices
                    .filter((office) => office !== form.office)
                    .map((office) => (
                      <label
                        key={office}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={(form.subOffices ?? []).includes(office)}
                          onChange={(event) => {
                            const current = form.subOffices ?? [];
                            setForm({
                              ...form,
                              subOffices: event.target.checked
                                ? [...current, office]
                                : current.filter((item) => item !== office),
                            });
                          }}
                          className="h-4 w-4"
                        />
                        {office}
                      </label>
                    ))}
                </div>
              </div>
            </details>

            <input
              className="min-w-0 rounded border p-2"
              placeholder="氏名"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
            <input
              className="min-w-0 rounded border p-2"
              placeholder="電話番号"
              value={form.phone}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
            />
            <input
              className="min-w-0 rounded border p-2"
              placeholder="担当車両"
              value={form.vehicle}
              onChange={(event) =>
                setForm({ ...form, vehicle: event.target.value })
              }
            />
            <select
              className="min-w-0 rounded border p-2"
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value as DriverStatus })
              }
            >
              <option value="稼働">稼働</option>
              <option value="休み">休み</option>
              <option value="応援">応援</option>
              <option value="退職">退職</option>
            </select>

            <button
              type="button"
              onClick={saveDriver}
              className="rounded bg-blue-600 px-3 py-2 font-semibold text-white"
            >
              {editingId !== null ? "更新" : "登録"}
            </button>
            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="col-span-7 rounded border px-4 py-2"
              >
                編集をキャンセル
              </button>
            )}
          </div>

          <details
            open={assignmentOpen}
            onToggle={(event) => setAssignmentOpen(event.currentTarget.open)}
            className="mb-4 rounded-xl border bg-white"
          >
            <summary className="cursor-pointer px-4 py-3 font-semibold">
              配車条件（対応コース・固定コース・優先度）
            </summary>
            <div className="border-t p-4">
              <p className="mb-3 text-sm text-gray-600">
                対応コースを未選択にすると、登録営業所の全コースに配置できます。
              </p>
              <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
                {availableCourses.length ? (
                  availableCourses.map((course) => (
                    <label
                      key={`${course.region}-${course.name}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={(form.supportedCourses ?? []).includes(
                          course.name,
                        )}
                        onChange={(event) => {
                          const current = form.supportedCourses ?? [];
                          setForm({
                            ...form,
                            supportedCourses: event.target.checked
                              ? [...current, course.name]
                              : current.filter((name) => name !== course.name),
                            fixedCourse:
                              !event.target.checked &&
                              form.fixedCourse === course.name
                                ? ""
                                : form.fixedCourse,
                          });
                        }}
                      />
                      {course.region}・{course.name}
                    </label>
                  ))
                ) : (
                  <span className="text-sm text-gray-500">
                    先にメイン営業所を選択してください
                  </span>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-semibold">
                  固定コース
                  <select
                    className="mt-1 w-full rounded border p-2 font-normal"
                    value={form.fixedCourse ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, fixedCourse: event.target.value })
                    }
                  >
                    <option value="">固定なし</option>
                    {availableCourses.map((course) => (
                      <option
                        key={`${course.region}-${course.name}`}
                        value={course.name}
                      >
                        {course.region}・{course.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  自動作成での扱い
                  <select
                    className="mt-1 w-full rounded border p-2 font-normal"
                    value={form.assignmentMode ?? "通常"}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        assignmentMode: event.target.value as AssignmentMode,
                      })
                    }
                  >
                    <option value="通常">通常</option>
                    <option value="応援のみ">応援先だけ</option>
                    <option value="最終候補">足りない時だけ</option>
                    <option value="自動除外">自動作成から除外</option>
                  </select>
                </label>
              </div>
            </div>
          </details>

          <div className="mb-5 flex gap-3">
            <select
              className="rounded border p-2"
              value=""
              onChange={(event) => setSearch(event.target.value)}
            >
              <option value="">全営業所</option>
              {offices.map((office) => (
                <option key={office} value={office}>
                  {office}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded border p-2"
              placeholder="名前・電話・車両・営業所を検索"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <table className="w-full table-fixed border-collapse border">
            <colgroup>
              <col className="w-[140px]" />
              <col className="w-[190px]" />
              <col className="w-[130px]" />
              <col className="w-[150px]" />
              <col className="w-[140px]" />
              <col className="w-[90px]" />
              <col className="w-[150px]" />
            </colgroup>
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">メイン営業所</th>
                <th className="border p-2">サブ営業所</th>
                <th className="border p-2">氏名</th>
                <th className="border p-2">電話番号</th>
                <th className="border p-2">担当車両</th>
                <th className="border p-2">状態</th>
                <th className="border p-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.map((driver) => {
                const subOffices = driver.subOffices?.length
                  ? driver.subOffices
                  : driver.subOffice
                    ? [driver.subOffice]
                    : [];

                return (
                  <tr key={driver.id}>
                    <td className="border p-2">{driver.office}</td>
                    <td className="relative border p-2">
                      {subOffices.length === 0 ? (
                        "なし"
                      ) : subOffices.length === 1 ? (
                        subOffices[0]
                      ) : (
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                            <span>{subOffices[0]}</span>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                              etc. +{subOffices.length - 1}
                            </span>
                          </summary>
                          <div className="mt-2 rounded-lg border bg-white p-2 text-sm shadow-sm">
                            {subOffices.map((office) => (
                              <div
                                key={office}
                                className="border-b py-1 last:border-b-0"
                              >
                                {office}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </td>
                    <td className="border p-2">{driver.name}</td>
                    <td className="border p-2">{driver.phone}</td>
                    <td className="border p-2">{driver.vehicle}</td>
                    <td className="border p-2 text-center">
                      <span
                        className={`rounded px-3 py-1 text-white ${
                          driver.status === "稼働"
                            ? "bg-green-600"
                            : driver.status === "応援"
                              ? "bg-yellow-500"
                              : driver.status === "休み"
                                ? "bg-gray-500"
                                : "bg-red-600"
                        }`}
                      >
                        {driver.status}
                      </span>
                    </td>
                    <td className="space-x-2 border p-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => editDriver(driver)}
                        className="rounded bg-orange-500 px-3 py-1 text-white"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDriver(driver.id)}
                        className="rounded bg-red-600 px-3 py-1 text-white"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredDrivers.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="border p-4 text-center text-gray-500"
                  >
                    ドライバーが登録されていません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}