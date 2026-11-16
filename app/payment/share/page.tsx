
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Driver = {
  name: string;
  office: string;
};

type Statement = {
  id: string;
  target_month: string;
};

type CompanyStatement = {
  id: string;
  company_id: string;
  company_name: string;
  target_month: string;
};

const OFFICES = [
  "松阪",
  "伊勢",
  "鈴鹿",
  "伊賀",
  "浜松",
  "京都",
];

function formatMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);

  if (!match) return value;

  return `${match[1]}年${Number(match[2])}月`;
}

export default function PaymentSharePage() {
  const [office, setOffice] = useState("");
  const [driverName, setDriverName] = useState("");
  const [pin, setPin] = useState("");

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [companyStatements, setCompanyStatements] = useState<
    CompanyStatement[]
  >([]);

  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDrivers() {
      try {
        const response = await fetch("/api/payment/driver-roster", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("ドライバー名簿を取得できませんでした。");
        }

        const data = await response.json();

        if (!cancelled) {
          setDrivers(
            Array.isArray(data.drivers) ? data.drivers : [],
          );
        }
      } catch {
        if (!cancelled) {
          setError("名簿を取得できませんでした。");
        }
      } finally {
        if (!cancelled) {
          setLoadingDrivers(false);
        }
      }
    }

    loadDrivers();

    return () => {
      cancelled = true;
    };
  }, []);

  const officeDrivers = drivers.filter((driver) => {
    const normalizedOffice = driver.office.replace(/営業所$/, "");
    return normalizedOffice === office;
  });

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!office || !driverName || !/^\d{4}$/.test(pin)) {
      setError("営業所・名前・4桁PINを入力してください。");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/payment/driver-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          office,
          driverName,
          pin,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "認証できませんでした。");
      }

      setStatements(
        Array.isArray(data.statements) ? data.statements : [],
      );

      setCompanyStatements(
        Array.isArray(data.companyStatements)
          ? data.companyStatements
          : [],
      );

      setPin("");
      setLoggedIn(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ログインに失敗しました。",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    setLoggedIn(false);
    setStatements([]);
    setCompanyStatements([]);
    setPin("");
    setDriverName("");
    setOffice("");
    setError("");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-lg">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-950 text-2xl font-bold text-white shadow-sm">
            U
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-blue-950">
            UNITE Fleet
          </h1>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            委託料金支払明細書
          </p>
        </header>

        {!loggedIn ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-blue-950">
              支払明細ログイン
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              営業所とお名前を選択し、4桁PINを入力してください。
            </p>

            <form onSubmit={handleLogin} className="mt-7 space-y-6">
              <div>
                <label
                  htmlFor="payment-office"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  ① 営業所
                </label>

                <select
                  id="payment-office"
                  value={office}
                  onChange={(event) => {
                    setOffice(event.target.value);
                    setDriverName("");
                    setPin("");
                    setError("");
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-base"
                >
                  <option value="">
                    営業所を選択してください
                  </option>

                  {OFFICES.map((item) => (
                    <option key={item} value={item}>
                      {item}営業所
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="payment-driver"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  ② ドライバー名
                </label>

                <select
                  id="payment-driver"
                  value={driverName}
                  disabled={!office || loadingDrivers}
                  onChange={(event) => {
                    setDriverName(event.target.value);
                    setPin("");
                    setError("");
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-base disabled:bg-slate-100"
                >
                  <option value="">
                    {loadingDrivers
                      ? "名簿を読み込み中..."
                      : !office
                        ? "先に営業所を選択してください"
                        : "お名前を選択してください"}
                  </option>

                  {officeDrivers.map((driver) => (
                    <option key={driver.name} value={driver.name}>
                      {driver.name}
                    </option>
                  ))}
                </select>

                {office &&
                  !loadingDrivers &&
                  officeDrivers.length === 0 && (
                    <p className="mt-2 text-sm text-amber-700">
                      この営業所のドライバーは登録されていません。
                    </p>
                  )}
              </div>

              <div>
                <label
                  htmlFor="payment-pin"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  ③ 4桁PIN
                </label>

                <input
                  id="payment-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={pin}
                  disabled={!driverName}
                  onChange={(event) =>
                    setPin(
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 4),
                    )
                  }
                  placeholder="4桁の数字"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-center text-xl tracking-widest disabled:bg-slate-100"
                />

                <p className="mt-2 text-xs text-slate-500">
                  シフト共有画面と同じPINを入力してください。
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  loading ||
                  loadingDrivers ||
                  !office ||
                  !driverName ||
                  pin.length !== 4
                }
                className="w-full rounded-xl bg-blue-900 px-5 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "認証中..." : "ログイン"}
              </button>
            </form>
          </section>
        ) : (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">
                    {office}営業所
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-blue-950">
                    {driverName} さん
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
                >
                  戻る
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-blue-950">
                個人の支払明細
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                ご本人の委託料金支払明細書
              </p>

              {statements.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-50 p-5 text-center text-slate-500">
                  公開されている支払明細はありません。
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {statements.map((statement) => (
                    <a
                      key={statement.id}
                      href={`/api/payment/driver-pdf/${encodeURIComponent(statement.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-5 font-bold text-blue-950"
                    >
                      <span>
                        {formatMonth(statement.target_month)}分
                      </span>
                      <span className="shrink-0 text-sm">
                        PDFを見る ›
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </section>

            {companyStatements.length > 0 && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-blue-950">
                  協力会社の支払明細
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  代表者として登録されている協力会社の明細
                </p>

                <div className="mt-4 space-y-3">
                  {companyStatements.map((statement) => (
                    <a
                      key={statement.id}
                      href={`/api/payment/company-pdf/${encodeURIComponent(statement.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-4 text-indigo-950"
                    >
                      <p className="text-sm font-bold">
                        {statement.company_name}
                      </p>

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="font-bold">
                          {formatMonth(statement.target_month)}分
                        </span>

                        <span className="shrink-0 text-sm font-bold">
                          PDFを見る ›
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          株式会社UNITE
        </p>
      </div>
    </main>
  );
}
