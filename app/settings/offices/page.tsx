"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Office = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
};

const STORAGE_KEY = "unite-fleet-offices";

const DEFAULT_OFFICES: Office[] = [
  {
    id: "matsusaka",
    name: "松阪営業所",
    active: true,
    createdAt: "",
  },
  {
    id: "ise",
    name: "伊勢営業所",
    active: true,
    createdAt: "",
  },
  {
    id: "suzuka",
    name: "鈴鹿営業所",
    active: true,
    createdAt: "",
  },
  {
    id: "iga",
    name: "伊賀営業所",
    active: true,
    createdAt: "",
  },
  {
    id: "hamamatsu",
    name: "浜松営業所",
    active: true,
    createdAt: "",
  },
  {
    id: "kyoto",
    name: "京都営業所",
    active: true,
    createdAt: "",
  },
];

export default function OfficeManagementPage() {
  const [offices, setOffices] =
    useState<Office[]>([]);

  const [loaded, setLoaded] =
    useState(false);

  const [newOfficeName, setNewOfficeName] =
    useState("");

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [editingName, setEditingName] =
    useState("");

  // =========================
  // 初回読み込み
  // =========================

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setOffices(parsed);
          setLoaded(true);
          return;
        }
      }

      // 初回だけ既存営業所を登録
      const initialOffices =
        DEFAULT_OFFICES.map((office) => ({
          ...office,
          createdAt:
            new Date().toISOString(),
        }));

      setOffices(initialOffices);

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(initialOffices)
      );
    } catch (error) {
      console.error(
        "営業所データの読み込みに失敗しました",
        error
      );

      setOffices(DEFAULT_OFFICES);
    } finally {
      setLoaded(true);
    }
  }, []);

  // =========================
  // 自動保存
  // =========================

  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(offices)
    );
  }, [offices, loaded]);

  // =========================
  // 営業所追加
  // =========================

  const addOffice = () => {
    const name = newOfficeName.trim();

    if (!name) {
      alert(
        "営業所名を入力してください"
      );
      return;
    }

    const duplicate =
      offices.some(
        (office) =>
          office.name === name
      );

    if (duplicate) {
      alert(
        "同じ名前の営業所がすでにあります"
      );
      return;
    }

    const newOffice: Office = {
      id: `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`,
      name,
      active: true,
      createdAt:
        new Date().toISOString(),
    };

    setOffices((prev) => [
      ...prev,
      newOffice,
    ]);

    setNewOfficeName("");
  };

  // =========================
  // 編集開始
  // =========================

  const startEdit = (
    office: Office
  ) => {
    setEditingId(office.id);
    setEditingName(office.name);
  };

  // =========================
  // 営業所名変更
  // =========================

  const saveEdit = () => {
    if (!editingId) return;

    const name =
      editingName.trim();

    if (!name) {
      alert(
        "営業所名を入力してください"
      );
      return;
    }

    const duplicate =
      offices.some(
        (office) =>
          office.id !== editingId &&
          office.name === name
      );

    if (duplicate) {
      alert(
        "同じ名前の営業所がすでにあります"
      );
      return;
    }

    setOffices((prev) =>
      prev.map((office) =>
        office.id === editingId
          ? {
              ...office,
              name,
            }
          : office
      )
    );

    setEditingId(null);
    setEditingName("");
  };

  // =========================
  // 有効・非表示切替
  // =========================

  const toggleOffice = (
    id: string
  ) => {
    setOffices((prev) =>
      prev.map((office) =>
        office.id === id
          ? {
              ...office,
              active:
                !office.active,
            }
          : office
      )
    );
  };

  // =========================
  // 完全削除
  // =========================

  const deleteOffice = (
    office: Office
  ) => {
    const ok =
      window.confirm(
        `${office.name}を完全に削除しますか？\n\n` +
          "車両・ドライバー・シフト・資金管理で使用中の場合は、削除ではなく「非表示」をおすすめします。"
      );

    if (!ok) return;

    setOffices((prev) =>
      prev.filter(
        (item) =>
          item.id !== office.id
      )
    );
  };

  if (!loaded) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        読み込み中...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        {/* タイトル */}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              🏢 営業所管理
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              営業所の追加・名称変更・非表示・削除ができます
            </p>
          </div>

          <Link
            href="/settings"
            className="rounded-lg bg-gray-700 px-4 py-2 text-center font-bold text-white"
          >
            設定へ戻る
          </Link>
        </div>

        {/* 新規追加 */}

        <div className="mb-6 rounded-2xl bg-white p-5 shadow">
          <h2 className="text-lg font-bold">
            ＋ 営業所を追加
          </h2>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={newOfficeName}
              onChange={(e) =>
                setNewOfficeName(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter"
                ) {
                  addOffice();
                }
              }}
              placeholder="例：豊田営業所"
              className="flex-1 rounded-lg border px-4 py-3"
            />

            <button
              type="button"
              onClick={addOffice}
              className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
            >
              ＋ 追加
            </button>
          </div>
        </div>

        {/* 営業所一覧 */}

        <div className="overflow-hidden rounded-2xl bg-white shadow">
          <div className="border-b p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  営業所一覧
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  全 {offices.length} 営業所
                </p>
              </div>

              <div className="text-sm text-gray-500">
                有効{" "}
                {
                  offices.filter(
                    (office) =>
                      office.active
                  ).length
                }
                件
              </div>
            </div>
          </div>

          {offices.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              営業所が登録されていません
            </div>
          ) : (
            <div>
              {offices.map(
                (office) => (
                  <div
                    key={office.id}
                    className="flex flex-col gap-4 border-b p-5 last:border-b-0 md:flex-row md:items-center md:justify-between"
                  >
                    {/* 営業所名 */}

                    <div className="flex-1">
                      {editingId ===
                      office.id ? (
                        <div className="flex max-w-xl flex-col gap-2 sm:flex-row">
                          <input
                            autoFocus
                            type="text"
                            value={
                              editingName
                            }
                            onChange={(
                              e
                            ) =>
                              setEditingName(
                                e.target
                                  .value
                              )
                            }
                            onKeyDown={(
                              e
                            ) => {
                              if (
                                e.key ===
                                "Enter"
                              ) {
                                saveEdit();
                              }

                              if (
                                e.key ===
                                "Escape"
                              ) {
                                setEditingId(
                                  null
                                );

                                setEditingName(
                                  ""
                                );
                              }
                            }}
                            className="flex-1 rounded-lg border px-3 py-2"
                          />

                          <button
                            type="button"
                            onClick={
                              saveEdit
                            }
                            className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white"
                          >
                            保存
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(
                                null
                              );

                              setEditingName(
                                ""
                              );
                            }}
                            className="rounded-lg bg-gray-200 px-4 py-2 font-bold text-gray-700"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-lg font-bold text-gray-900">
                              {
                                office.name
                              }
                            </p>

                            {office.active ? (
                              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                                使用中
                              </span>
                            ) : (
                              <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-bold text-gray-600">
                                非表示
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-gray-400">
                            ID：
                            {office.id}
                          </p>
                        </>
                      )}
                    </div>

                    {/* 操作 */}

                    {editingId !==
                      office.id && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            startEdit(
                              office
                            )
                          }
                          className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-500"
                        >
                          編集
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleOffice(
                              office.id
                            )
                          }
                          className={`rounded-lg px-4 py-2 text-sm font-bold text-white ${
                            office.active
                              ? "bg-gray-500 hover:bg-gray-600"
                              : "bg-green-600 hover:bg-green-700"
                          }`}
                        >
                          {office.active
                            ? "非表示"
                            : "再表示"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteOffice(
                              office
                            )
                          }
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* 説明 */}

        <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-gray-700">
          <p className="font-bold">
            ⚠️ 削除について
          </p>

          <p className="mt-1">
            すでに車両・ドライバー・シフト・入出金データで使用している営業所は、
            完全削除せず「非表示」にするのがおすすめです。
          </p>
        </div>
      </div>
    </main>
  );
}