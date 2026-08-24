"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import Sidebar from "./Sidebar";
import { supabase as maybeSupabase } from "../../lib/supabase";

const supabase = maybeSupabase!;
export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDriverSharePage =
    pathname === "/shift/share" ||
    pathname.startsWith("/shift/share/");

  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isDriverSharePage) {
      setChecking(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setChecking(false);
      }
    );

    return () => data.subscription.unsubscribe();
  }, [isDriverSharePage]);

  const login = async () => {
    if (!email || !password) {
      setMessage("メールアドレスとパスワードを入力してください。");
      return;
    }

    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(`ログインできません：${error.message}`);
    }

    setBusy(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  // ドライバーには共有シフトだけを表示
  if (isDriverSharePage) {
    return (
      <main className="min-h-screen bg-white">
        {children}
      </main>
    );
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p>ログイン状態を確認中...</p>
      </main>
    );
  }

  // 未ログインでは管理画面を一切表示しない
  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold">UNITE Fleet</h1>
          <p className="mt-2 text-gray-600">管理者ログイン</p>

          <input
            type="email"
            className="mt-6 w-full rounded border p-3"
            placeholder="メールアドレス"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <input
            type="password"
            className="mt-3 w-full rounded border p-3"
            placeholder="パスワード"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <button
            type="button"
            onClick={login}
            disabled={busy}
            className="mt-4 w-full rounded bg-blue-600 p-3 font-bold text-white disabled:opacity-50"
          >
            {busy ? "ログイン中..." : "管理者ログイン"}
          </button>

          {message && (
            <p className="mt-3 text-sm text-red-600">{message}</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 bg-gray-100 p-6">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={logout}
            className="rounded bg-gray-700 px-4 py-2 text-sm text-white"
          >
            ログアウト
          </button>
        </div>

        {children}
      </main>
    </div>
  );
}