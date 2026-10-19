"use client";

import { useEffect, useMemo, useState } from "react";


const INITIAL_COURSES: Record<string, string[]> = {
  "松阪営業所": ["A", "B", "C", "D", "E", "F", "G", "H"],
  "伊勢営業所": ["神久", "朝熊", "御薗", "高向"],
  "鈴鹿営業所": [],
  "伊賀営業所": [],
  "浜松営業所": [],
  "京都営業所": [],
};

type ManagedOffice = {
  id: string;
  name: string;
  is_active: boolean;
};

type ManagedCourse = {
  id: string;
  office_id: string | null;
  office: string;
  name: string;
  is_active: boolean;
};

type Note = {
  id: string;
  office: string;
  course: string;
  customer: string;
  address: string;
  content: string;
  important: boolean;
  driver: string;
  createdAt: string;
};

export default function HandoverSharePage() {
  const [adminFormOpen, setAdminFormOpen] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loginOffice, setLoginOffice] = useState("");
  const [loginName, setLoginName] = useState("");
  const [driverDirectory, setDriverDirectory] = useState<Record<string, string[]>>({});
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState("");
  const [pin, setPin] = useState("");
  const [loggedInDriver, setLoggedInDriver] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

const [managedOffices, setManagedOffices] = useState<ManagedOffice[]>([]);
const [managedCourses, setManagedCourses] = useState<ManagedCourse[]>([]);
const [showOfficeManager, setShowOfficeManager] = useState(false);
const [showCourseManager, setShowCourseManager] = useState(false);
  const [office, setOffice] = useState("松阪営業所");
  const [course, setCourse] = useState("A");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [customer, setCustomer] = useState("");
  const [address, setAddress] = useState("");
  const [content, setContent] = useState("");
  const [important, setImportant] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
const [availableCourses, setAvailableCourses] = useState<ManagedCourse[]>([]);
const [savingNote, setSavingNote] = useState(false);
useEffect(() => {
  if (!loggedInDriver || !course) {
    setNotes([]);
    return;
  }

  const selectedCourse = availableCourses.find(
    (item) => item.office === office && item.name === course
  );

  if (!selectedCourse) {
    setNotes([]);
    return;
  }

  let cancelled = false;

  async function loadNotes() {
    try {
      const response = await fetch(
        `/api/handover/notes?courseId=${encodeURIComponent(selectedCourse!.id)}`,
        {
          cache: "no-store",
          credentials: "same-origin",
        }
      );

      if (!response.ok) {
        throw new Error("引き継ぎ事項を取得できませんでした");
      }

      const result = await response.json();

      if (cancelled) return;

      setNotes(
        (result.notes ?? []).map((item: {
          id: string;
          customer_name: string;
          address: string;
          content: string;
          is_important: boolean;
          driver_name: string;
          created_at: string;
        }) => ({
          id: item.id,
          office,
          course,
          customer: item.customer_name,
          address: item.address,
          content: item.content,
          important: item.is_important,
          driver: item.driver_name,
          createdAt: item.created_at,
        }))
      );
    } catch (error) {
      console.error("引き継ぎ事項の読み込みエラー:", error);
    }
  }

  void loadNotes();

  return () => {
    cancelled = true;
  };
}, [loggedInDriver, office, course, availableCourses]);
useEffect(() => {
  if (!loggedInDriver) return;

  async function loadCourses() {
    try {
      const response = await fetch("/api/handover/courses", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("コース一覧の取得に失敗しました");
      }

      const result = await response.json();
      setAvailableCourses(result.courses ?? []);
    } catch (error) {
      console.error("コース取得エラー:", error);
    }
  }

  void loadCourses();
}, [loggedInDriver]);
  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900";
useEffect(() => {
  if (!adminMode || !loggedInDriver) return;

  let cancelled = false;

  async function loadManagedData() {
    try {
      const response = await fetch("/api/handover/manage", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("管理データの取得に失敗しました");
      }

      const result = await response.json();

      if (!cancelled) {
        setManagedOffices(result.offices ?? []);
        setManagedCourses(result.courses ?? []);
      }
    } catch (error) {
      console.error("管理データ取得エラー:", error);
    }
  }

  void loadManagedData();

  return () => {
    cancelled = true;
  };
}, [adminMode, loggedInDriver]);
  useEffect(() => {
    let cancelled = false;

    async function loadDriverDirectory() {
      try {
        const response = await fetch("/api/handover/drivers", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("ドライバー一覧の取得に失敗しました");

        const result: { offices?: Record<string, string[]> } =
          await response.json();
        if (!result.offices || typeof result.offices !== "object") {
          throw new Error("ドライバー一覧の形式が正しくありません");
        }

        const directory: Record<string, string[]> = {};
        for (const [officeName, names] of Object.entries(result.offices)) {
          directory[officeName] = Array.isArray(names)
            ? names.filter((name): name is string => typeof name === "string")
            : [];
        }

        if (!cancelled) {
          setDriverDirectory(directory);
          setLoginOffice((previous) =>
            previous && Object.hasOwn(directory, previous)
              ? previous
              : Object.keys(directory)[0] || ""
          );
        }
      } catch {
        if (!cancelled) {
          setDirectoryError("ドライバー一覧を取得できません。画面を更新してください。");
        }
      } finally {
        if (!cancelled) setDirectoryLoading(false);
      }
    }

    void loadDriverDirectory();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Reloads do not silently restore the editor UI without server verification.
    let cancelled = false;
    fetch("/api/handover/admin", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setAdminMode(data.admin === true); })
      .catch(() => { if (!cancelled) setAdminMode(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleAdminLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAdminError("");
    setAdminBusy(true);
    try {
      const response = await fetch("/api/handover/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      if (!response.ok) {
        setAdminError(response.status === 429
          ? "試行回数が多いため、しばらく待ってください。"
          : "管理者認証に失敗しました。メールアドレスとパスワードを確認してください。");
        return;
      }
      setAdminMode(true);
      setAdminFormOpen(false);
      setAdminPassword("");
    } catch {
      setAdminError("通信に失敗しました。もう一度お試しください。");
    } finally {
      setAdminBusy(false);
    }
  }

  async function handleAdminLogout() {
    setAdminMode(false);
    setAdminFormOpen(false);
    setEditingId(null);
    await fetch("/api/handover/admin", { method: "DELETE" }).catch(() => {});
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError("");

    if (
      !loginOffice ||
      !driverDirectory[loginOffice]?.includes(loginName) ||
      !/^\d{4}$/.test(pin)
    ) {
      setLoginError("営業所・ドライバー名・4桁PINを確認してください。");
      return;
    }

    setLoggingIn(true);

    try {
      const response = await fetch("/api/handover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          driverName: loginName.trim(),
          pin,
        }),
      });

      if (!response.ok) {
        setLoginError(
          response.status === 429
            ? "試行回数が多すぎます。しばらく待ってください。"
            : "ドライバー名またはPINが違います。"
        );
        return;
      }

      const result = await response.json();

      if (result.status !== "authenticated") {
        setLoginError("ログインを確認できませんでした。");
        return;
      }

      setLoggedInDriver(loginName.trim());
      setPin("");
    } catch {
      setLoginError("通信に失敗しました。もう一度お試しください。");
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    // ログアウト時は画面内の情報を破棄する
    // サーバー側Cookieの削除は別途APIを実装する
    void handleAdminLogout();
    setLoggedInDriver("");
    setLoginName("");
    setPin("");
    setNotes([]);
    setShowForm(false);
    setCustomer("");
    setAddress("");
    setContent("");
  }

  const [selectedTown, setSelectedTown] = useState("");

  const visibleNotes = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return notes
      .filter(
        (note) =>
          note.office === office &&
          note.course === course &&
          [note.customer, note.address, note.content]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
      )
      .sort(
        (a, b) =>
          Number(b.important) - Number(a.important) ||
          b.createdAt.localeCompare(a.createdAt)
      );
  }, [notes, office, course, search]);

  const getTown = (address: string) => {
  const value = address.trim().replace(/\s+/g, "");

  const match = value.match(
    /^(.+?(?:市|区|町|村))(.+?(?:町|丁目|台|丘|野|田|原|浜|浦|島|谷|台地))/
  );

  if (match) {
    return `${match[1]}${match[2]}`;
  }

  return value
    .replace(/[０-９]/g, (n) =>
      String(n.charCodeAt(0) - 0xff10)
    )
    .replace(/[0-9]+(?:丁目|番地|番|号)?(?:[-－ー−‐][0-9]+)*/g, "")
    .replace(/[-－ー−‐]+$/, "") || "町名未設定";
};

  const townGroups = useMemo(() => {
    const groups: Record<string, Note[]> = {};

    visibleNotes.forEach((note) => {
      const town = getTown(note.address);

      if (!groups[town]) {
        groups[town] = [];
      }

      groups[town].push(note);
    });

    return groups;
  }, [visibleNotes]);

 async function addNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (
      !course ||
      !customer.trim() ||
      !address.trim() ||
      !content.trim() ||
      !loggedInDriver
    ) {
      return;
    }
const selectedCourse = availableCourses.find(
  (item) => item.office === office && item.name === course
);

if (!selectedCourse) {
  alert("コース情報を取得できませんでした。再ログインしてください。");
  return;
}
if (savingNote) return;

setSavingNote(true);

try {
  const response = await fetch("/api/handover/notes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      courseId: selectedCourse.id,
      customerName: customer.trim(),
      address: address.trim(),
      content: content.trim(),
      isImportant: important,
    }),
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error ?? "保存に失敗しました。");
  }

    const result = await response.json();
  const saved = result.note;

  if (!saved) {
    throw new Error("保存データを取得できませんでした。");
  }

  const note: Note = {
    id: saved.id,
    office,
    course,
    customer: saved.customer_name,
    address: saved.address,
    content: saved.content,
    important: saved.is_important,
    driver: saved.driver_name,
    createdAt: saved.created_at,
  };

  setNotes((previous) => [note, ...previous]);

  setEditingId(null);
  setCustomer("");
  setAddress("");
  setContent("");
  setImportant(false);
  setShowForm(false);

  alert("Supabaseへの保存が完了しました！");
} catch (error) {
  alert(
    error instanceof Error
      ? error.message
      : "保存中にエラーが発生しました。"
  );
} finally {
  setSavingNote(false);
}
}
if (!loggedInDriver) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-gray-900">
        <div className="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-sm">
          <div className="text-center">
            <h1 className="text-2xl font-bold">
              UNITE 引き継ぎノート
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              ドライバー認証
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1 block font-semibold">営業所</label>
              <select
                className={inputClass}
                value={loginOffice}
                onChange={(e) => {
                  setLoginOffice(e.target.value);
                  setLoginName("");
                  setLoginError("");
                }}
                disabled={directoryLoading || !!directoryError}
                required
              >
                <option value="">営業所を選択</option>
                {Object.keys(driverDirectory).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-semibold">ドライバー名</label>
              <select
                className={inputClass}
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                disabled={!loginOffice || directoryLoading || !!directoryError}
                required
              >
                <option value="">名前を選択</option>
                {(driverDirectory[loginOffice] || []).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {loginOffice && !directoryLoading && !directoryError &&
                (driverDirectory[loginOffice] || []).length === 0 && (
                  <p className="mt-1 text-sm text-gray-500">この営業所には登録者がいません。</p>
                )}
            </div>

            <div>
              <label className="mb-1 block font-semibold">
                4桁PIN
              </label>
              <input
                className={inputClass}
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="4桁の数字"
                autoComplete="off"
                required
              />
            </div>

            {directoryLoading && (
              <p className="text-sm text-gray-500">ドライバー一覧を読み込み中...</p>
            )}
            {directoryError && (
              <p role="alert" className="text-sm text-red-600">{directoryError}</p>
            )}
            {loginError && (
              <p role="alert" className="text-sm text-red-600">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loggingIn || directoryLoading || !!directoryError || !loginName}
              className="w-full rounded-xl bg-blue-700 px-4 py-4 font-bold text-white disabled:opacity-50"
            >
              {loggingIn ? "確認中..." : "ログイン"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500">
            シフト管理で設定したPINを入力してください。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 text-gray-900">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              UNITE 引き継ぎノート
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              ログイン中：{loggedInDriver}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          >
            ログアウト
          </button>
        </header>

        <section className="rounded-xl border bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">管理者編集</h2>
              <p className="text-xs text-gray-500">管理者だけ編集・削除できます</p>
            </div>
            {adminMode ? (
              <button type="button" onClick={() => void handleAdminLogout()}
                className="rounded-lg border px-3 py-2 text-sm">編集を終了</button>
            ) : (
              <button type="button" onClick={() => { setAdminFormOpen((v) => !v); setAdminError(""); }}
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-bold text-white">管理者編集</button>
            )}
          </div>
         {adminMode && (
  <div className="space-y-3">
    <p className="text-sm font-semibold text-green-700">
      管理者編集モードです
    </p>

    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => {
  alert("営業所管理ボタンが押されました");
  setShowOfficeManager(true);
}}
        className="rounded-lg bg-blue-700 px-3 py-3 font-bold text-white"
      >
        営業所管理
      </button>

      <button
        type="button"
        onClick={() => {
  alert("コース管理ボタンが押されました");
  setShowCourseManager(true);
}}
        className="rounded-lg bg-blue-700 px-3 py-3 font-bold text-white"
      >
        コース管理
      </button>
    </div>
  </div>
)}
          {adminFormOpen && !adminMode && (
            <form onSubmit={handleAdminLogin} className="space-y-3 border-t pt-3">
              <label className="block text-sm font-semibold">メールアドレス</label>
              <input className={inputClass} type="email" autoComplete="username"
                value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
              <label className="block text-sm font-semibold">パスワード</label>
              <input className={inputClass} type="password" autoComplete="current-password"
                value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required />
              {adminError && <p role="alert" className="text-sm text-red-600">{adminError}</p>}
              <button disabled={adminBusy} className="w-full rounded-lg bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-50">
                {adminBusy ? "確認中..." : "ログインして編集する"}
              </button>
            </form>
          )}
        </section>

        <section className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block font-semibold">
              営業所
            </label>
            <select
              className={inputClass}
              value={office}
              onChange={(e) => {
                const nextOffice = e.target.value;
                setOffice(nextOffice);
               setCourse(
  managedCourses
    .filter(
      (item) =>
        item.office === nextOffice && item.is_active
    )[0]?.name ?? ""
);
                setSearch("");
              }}
            >
{(managedOffices.length > 0
  ? managedOffices.filter((item) => item.is_active).map((item) => item.name)
  : Object.keys(INITIAL_COURSES)
).map((name) => (
  <option key={name} value={name}>
    {name}
  </option>
))}            </select>
          </div>

          <div>
            <label className="mb-1 block font-semibold">
              コース
            </label>
            <select
              className={inputClass}
              value={course}
              onChange={(e) => {
                setCourse(e.target.value);
                setSearch("");
              }}
            >

{(() => {
  const courseNames =
    managedCourses.length > 0
      ? managedCourses
          .filter(
            (item) =>
              item.office === office && item.is_active
          )
          .map((item) => item.name)
      : INITIAL_COURSES[office] ?? [];

  return (
    <>
      {courseNames.length === 0 && (
        <option value="">コース未登録</option>
      )}
      {courseNames.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </>
  );
})()}
            </select>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              引き継ぎ事項
            </h2>
            <span className="text-sm text-gray-500">
              {visibleNotes.length}件
            </span>
          </div>

          <input
            className={inputClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="お客様名・住所・内容で検索"
          />
{visibleNotes.length > 0 && (
  <div className="rounded-xl border bg-white p-4">
    <h3 className="mb-3 font-bold">町名から選ぶ</h3>

    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setSelectedTown("")}
        className={`w-full rounded-lg border p-3 text-left ${
          selectedTown === "" ? "bg-blue-100 border-blue-500" : "bg-white"
        }`}
      >
        すべて表示（{visibleNotes.length}件）
      </button>

      {Object.entries(townGroups).map(([town, items]) => (
        <button
          key={town}
          type="button"
          onClick={() => setSelectedTown(town)}
          className={`w-full rounded-lg border p-3 text-left ${
            selectedTown === town ? "bg-blue-100 border-blue-500" : "bg-white"
          }`}
        >
          {town}（{items.length}件）
        </button>
      ))}
    </div>
  </div>
)}
          {visibleNotes.length === 0 ? (
            <div className="rounded-xl bg-white p-6 text-center text-gray-500">
              登録された引き継ぎ事項はありません
            </div>
          ) : (
           visibleNotes
  .filter(
    (note) =>
      !selectedTown || getTown(note.address) === selectedTown
  )
  .map((note) => (
              <article
                key={note.id}
                className="space-y-2 rounded-xl border bg-white p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold">{note.customer}</h3>
                  {note.important && (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                      重要
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600">
                  {note.address}
                </p>
                <p className="whitespace-pre-wrap">
                  {note.content}
                </p>
                <p className="text-xs text-gray-500">
                  登録者：{note.driver}
                </p>
                {adminMode && (
                  <div className="flex gap-2 pt-2">
                    <button type="button" className="rounded-lg border px-3 py-2 text-sm"
                      onClick={() => {
                        setEditingId(note.id);
                        setCustomer(note.customer);
                        setAddress(note.address);
                        setContent(note.content);
                        setImportant(note.important);
                        setShowForm(true);
                      }}>編集</button>
                    <button type="button" className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700"
                      onClick={async () => {
  if (!window.confirm("この引き継ぎ事項を削除しますか？")) return;

  try {
    const response = await fetch("/api/handover/notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ noteId: note.id }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "削除できませんでした。");
    }

    setNotes((previous) =>
      previous.filter((item) => item.id !== note.id)
    );
  } catch (error) {
    alert(error instanceof Error ? error.message : "削除に失敗しました。");
  }
}}>
  削除
</button>
                  </div>
                )}
              </article>
            ))
          )}
        </section>

        {!showForm ? (
          <button
            type="button"
            disabled={!course}
            onClick={() => setShowForm(true)}
            className="w-full rounded-xl bg-blue-700 px-4 py-4 font-bold text-white disabled:opacity-50"
          >
            ＋ 引き継ぎ事項を登録
          </button>
        ) : (
          <form
            onSubmit={addNote}
            className="space-y-4 rounded-xl bg-white p-4 shadow-sm"
          >
            <h2 className="text-lg font-bold">
              {editingId ? "引き継ぎ事項を編集" : "新しい引き継ぎ事項"}
            </h2>

            <div>
              <label className="mb-1 block font-semibold">
                お客様名
              </label>
              <input
                required
                className={inputClass}
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold">
                住所
              </label>
              <input
                required
                className={inputClass}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold">
                特記事項の内容
              </label>
              <textarea
                required
                rows={4}
                className={inputClass}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={important}
                onChange={(e) => setImportant(e.target.checked)}
                className="h-5 w-5"
              />
              <span className="font-semibold">
                重要事項として登録
              </span>
            </label>

            <p className="text-sm text-gray-600">
              登録者：{loggedInDriver}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="flex-1 rounded-lg border px-4 py-3"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-blue-700 px-4 py-3 font-bold text-white"
              >
                {editingId ? "変更する" : "登録する"}
              </button>
            </div>
          </form>
        )}

       {adminMode && showOfficeManager && (
  <div className="rounded-xl border bg-white p-4 space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="font-bold text-lg">営業所管理</h2>
      <button
        type="button"
        onClick={() => setShowOfficeManager(false)}
        className="rounded border px-3 py-2"
      >
        閉じる
      </button>
    </div>

    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const name = window.prompt("追加する営業所名を入力してください");
        if (!name?.trim()) return;

        const response = await fetch("/api/handover/manage", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "office", name: name.trim() }),
        });

        if (!response.ok) {
          const result = await response.json();
          alert(result.error || "追加できませんでした");
          return;
        }

        const result = await fetch("/api/handover/manage", {
          credentials: "same-origin",
          cache: "no-store",
        });

        if (result.ok) {
          const data = await result.json();
          setManagedOffices(data.offices ?? []);
          setManagedCourses(data.courses ?? []);
        }
      }}
    >
      <button
        type="submit"
        className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white"
      >
        ＋ 営業所を追加
      </button>
    </form>
        {managedOffices
      .filter((item) => item.is_active)
      .map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded border p-3"
        >
          <span>{item.name}</span>
          <button
            type="button"
            className="rounded border border-red-300 px-3 py-1 text-red-600"
            onClick={async () => {
              if (!confirm(`${item.name}を無効にしますか？`)) return;

              const response = await fetch("/api/handover/manage", {
                method: "DELETE",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "office", id: item.id }),
              });

              if (!response.ok) {
                alert("削除できませんでした");
                return;
              }

              setManagedOffices((previous) =>
                previous.map((office) =>
                  office.id === item.id
                    ? { ...office, is_active: false }
                    : office
                )
              );
            }}
          >
            削除
          </button>
        </div>
      ))}
  </div>
)}
      </div>
      {adminMode && showCourseManager && (
  <div className="rounded-xl border bg-white p-4 space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-bold">コース管理</h2>
      <button
        type="button"
        onClick={() => setShowCourseManager(false)}
        className="rounded border px-3 py-2"
      >
        閉じる
      </button>
    </div>

    <form
      onSubmit={async (e) => {
        e.preventDefault();

        const name = window.prompt("追加するコース名を入力してください");
        if (!name?.trim()) return;

        const selectedOffice = managedOffices.find(
          (item) => item.name === office && item.is_active
        );

        if (!selectedOffice) {
          alert("営業所が見つかりません");
          return;
        }

        try {
          const response = await fetch("/api/handover/manage", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "course",
              officeId: selectedOffice.id,
              name: name.trim(),
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            alert(result.error || "追加できませんでした");
            return;
          }

          const reload = await fetch("/api/handover/manage", {
            credentials: "same-origin",
            cache: "no-store",
          });

          if (!reload.ok) {
            alert("追加しましたが、一覧の更新に失敗しました");
            return;
          }

          const data = await reload.json();
          setManagedOffices(data.offices ?? []);
          setManagedCourses(data.courses ?? []);
          alert("コースを追加しました");
        } catch {
          alert("通信エラーが発生しました");
        }
      }}
    >
      <p className="mb-3 text-sm">
        対象営業所：{office}
      </p>

      <button
        type="submit"
        className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white"
      >
        ＋ コースを追加
      </button>
       </form>

    <div className="space-y-2">
      <h3 className="font-bold">登録済みコース</h3>

      {managedCourses
        .filter(
          (item) => item.office === office && item.is_active
        )
        .map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded border p-3"
          >
            <span>{item.name}</span>

            <button
              type="button"
              className="rounded border border-red-300 px-3 py-1 text-red-600"
              onClick={async () => {
                if (!confirm(`${item.name}を削除しますか？`)) return;

                const response = await fetch("/api/handover/manage", {
                  method: "DELETE",
                  credentials: "same-origin",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    type: "course",
                    id: item.id,
                  }),
                });

                if (!response.ok) {
                  alert("削除に失敗しました");
                  return;
                }

                setManagedCourses((prev) =>
                  prev.map((course) =>
                    course.id === item.id
                      ? { ...course, is_active: false }
                      : course
                  )
                );
              }}
            >
              削除
            </button>
          </div>
        ))}

      {managedCourses.filter(
        (item) => item.office === office && item.is_active
      ).length === 0 && (
        <p className="text-sm text-gray-500">
          登録済みコースはありません。
        </p>
      )}
    </div>
  </div>
)}
    </main>
  );
}