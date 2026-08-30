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

    let mounted = true;

    // 万一 Supabase の getSession が止まっても
    // 「ログイン状態を確認中...」のまま永久停止させない
    const timeout = window.setTimeout(() => {
      if (mounted) {
        console.warn("Supabase getSession timeout");
        setChecking(false);
      }
    }, 5000);

    const checkSession = async () => {
      try {
        const {
          data,
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error("getSession error:", error);
          setSession(null);
        } else {
          setSession(data.session);
        }
      } catch (error) {
        console.error("getSession exception:", error);

        if (mounted) {
          setSession(null);
        }
      } finally {
        if (mounted) {
          window.clearTimeout(timeout);
          setChecking(false);
        }
      }
    };

    void checkSession();

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!mounted) return;

        setSession(nextSession);
        setChecking(false);
      }
    );

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      authListener.subscription.unsubscribe();
    };
  }, [isDriverSharePage]);

  const login = async () => {
    if (!email || !password) {
      setMessage(
        "メールアドレスとパスワードを入力してください。"
      );
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const {
        data,
        error,
      } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(
          `ログインできません：${error.message}`
        );
        return;
      }

      setSession(data.session);
    } catch (error) {
      console.error("login error:", error);

      setMessage(
        "ログイン処理でエラーが発生しました。"
      );
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
    } catch (error) {
      console.error("logout error:", error);
    }
  };

  // ドライバー共有ページはログイン不要
  if (isDriverSharePage) {
    return (
      <main className="min-h-screen bg-white">
        {children}
      </main>
    );
  }

 if (checking) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 bg-gray-100 p-6">
        {children}
      </main>
    </div>
  );
}

  // 未ログイン
  if (false) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold">
            UNITE Fleet
          </h1>

          <p className="mt-2 text-gray-600">
            管理者ログイン
          </p>

          <input
            type="email"
            className="mt-6 w-full rounded border p-3"
            placeholder="メールアドレス"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
          />

          <input
            type="password"
            className="mt-3 w-full rounded border p-3"
            placeholder="パスワード"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
          />

          <button
            type="button"
            onClick={login}
            disabled={busy}
            className="mt-4 w-full rounded bg-blue-600 p-3 font-bold text-white disabled:opacity-50"
          >
            {busy
              ? "ログイン中..."
              : "管理者ログイン"}
          </button>

          {message && (
            <p className="mt-3 text-sm text-red-600">
              {message}
            </p>
          )}
        </div>
      </main>
    );
  }

  // ログイン済み
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