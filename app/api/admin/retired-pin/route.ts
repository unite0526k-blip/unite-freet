import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const normalizeName = (value: string) => value.replace(/[\s　]+/g, "").trim();

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "ログインを確認できません。" }, { status: 401 });

    // 登録された管理者のメールアドレスのみ許可する。環境変数が未設定なら拒否する。
    const allowed = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
    if (!auth.user.email || auth.user.email.toLowerCase() !== allowed) {
      return NextResponse.json({ error: "PINを確認する権限がありません。" }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("driverId" in body)) {
      return NextResponse.json({ error: "ドライバーIDが必要です。" }, { status: 400 });
    }
    const driverId = (body as { driverId: unknown }).driverId;
    if (typeof driverId !== "number" || !Number.isSafeInteger(driverId)) {
      return NextResponse.json({ error: "ドライバーIDが正しくありません。" }, { status: 400 });
    }

    const { data: master, error: masterError } = await admin.from("fleet_master")
      .select("drivers").eq("id", "default").single();
    if (masterError) throw masterError;
    const drivers = Array.isArray(master?.drivers) ? master.drivers : [];
    const driver = drivers.find((item: { id?: number }) => item.id === driverId);
    if (!driver || driver.status !== "退職" || typeof driver.name !== "string") {
      return NextResponse.json({ error: "退職者が見つかりません。" }, { status: 404 });
    }

    const { data: rows, error: pinError } = await admin.from("shift_driver_settings")
      .select("driver_name,pin_code");
    if (pinError) throw pinError;
    const matches = (rows ?? []).filter((row) =>
      normalizeName(String(row.driver_name ?? "")) === normalizeName(driver.name)
    );
    if (matches.length !== 1) {
      return NextResponse.json({ error: matches.length ? "同名のPIN設定が複数あります。" : "PIN設定が見つかりません。" }, { status: 404 });
    }
    const pin = String(matches[0].pin_code ?? "");
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "保存済みPINの形式を確認してください。" }, { status: 422 });
    }
    return NextResponse.json({ pin }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("retired-pin:", error);
    return NextResponse.json({ error: "PINの取得に失敗しました。" }, { status: 500 });
  }
}
