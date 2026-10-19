import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SignJWT, jwtVerify } from "jose";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { HANDOVER_COOKIE_NAME, verifyHandoverSession } from "@/lib/handoverSession";

const ADMIN_COOKIE = "handover_admin_session";

function secret() {
  const value = process.env.HANDOVER_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("Session secret is missing");
  return new TextEncoder().encode(value);
}

async function adminFromCookie(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.scope !== "handover_admin" || typeof payload.sub !== "string") return false;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("handover_members")
      .select("role").eq("user_id", payload.sub).eq("role", "admin").maybeSingle();
    return !error && !!data;
  } catch { return false; }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ admin: await adminFromCookie(request) },
    { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    // Driver PIN authentication is required before entering admin mode.
    const driverToken = request.cookies.get(HANDOVER_COOKIE_NAME)?.value;
    if (!driverToken || !(await verifyHandoverSession(driverToken))) {
      return NextResponse.json({ error: "PIN認証が必要です。" }, { status: 401 });
    }
    const body = await request.json();
    const email = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");
    if (!email || email.length > 254 || !password || password.length > 1024) {
      return NextResponse.json({ error: "入力を確認してください。" }, { status: 400 });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new Error("Supabase configuration missing");
    const authClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: auth, error: authError } = await authClient.auth.signInWithPassword({ email, password });
    if (authError || !auth.user) {
      return NextResponse.json({ error: "管理者認証に失敗しました。" }, { status: 401 });
    }
    const supabase = getSupabaseAdmin();
    const { data: member, error: memberError } = await supabase
      .from("handover_members").select("role")
      .eq("user_id", auth.user.id).eq("role", "admin").maybeSingle();
    if (memberError || !member) {
      return NextResponse.json({ error: "管理者認証に失敗しました。" }, { status: 403 });
    }
    const token = await new SignJWT({ scope: "handover_admin" })
      .setProtectedHeader({ alg: "HS256" }).setSubject(auth.user.id)
      .setIssuedAt().setExpirationTime("1h").sign(secret());
    const response = NextResponse.json({ admin: true });
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "strict", path: "/api/handover", maxAge: 3600,
    });
    return response;
  } catch (error) {
    console.error("Admin authentication error:", error);
    return NextResponse.json({ error: "認証処理に失敗しました。" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ admin: false });
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api/handover", maxAge: 0,
  });
  return response;
}
