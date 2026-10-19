
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createHandoverSession,
  HANDOVER_COOKIE_NAME,
} from "@/lib/handoverSession";

function normalizeName(name: string) {
  return name.normalize("NFKC").replace(/\s+/g, "");
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("handover_offices")
      .select("id", { head: true, count: "exact" });

    if (error) {
      console.error("Handover connection error:", error.message);

      return NextResponse.json(
        { status: "connection_error" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "connected",
      message: "Supabase接続成功。引き継ぎデータは非公開です。",
    });
  } catch {
    return NextResponse.json(
      { status: "configuration_error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const driverName = String(body?.driverName ?? "").trim();
    const pin = String(body?.pin ?? "");

    if (
      !driverName ||
      driverName.length > 100 ||
      !/^\d{4}$/.test(pin)
    ) {
      return NextResponse.json(
        { error: "ドライバー名と4桁PINを入力してください。" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // シフト管理のPIN設定を取得
    const { data: settings, error: settingError } =
      await supabase
        .from("shift_driver_settings")
        .select("driver_name, pin_code");

    if (settingError) {
      console.error("PIN lookup error:", settingError.message);

      return NextResponse.json(
        { error: "認証処理に失敗しました。" },
        { status: 500 }
      );
    }

    // 名前のスペース表記を統一して照合
    const normalizedDriverName = normalizeName(driverName);

    const matches = (settings ?? []).filter(
      (item) =>
        normalizeName(String(item.driver_name ?? "")) ===
        normalizedDriverName
    );

    // 同名の登録が複数ある場合は認証しない
    const setting = matches.length === 1 ? matches[0] : null;

    // PINをサーバー側で照合
    const storedPin = String(setting?.pin_code ?? "");

    const pinMatches =
      /^\d{4}$/.test(storedPin) &&
      timingSafeEqual(
        Buffer.from(pin),
        Buffer.from(storedPin)
      );

    // PINの試行回数を制限
    const { data: allowed, error: attemptError } =
      await supabase.rpc("handover_pin_attempt", {
        p_driver_name: normalizedDriverName,
        p_success: pinMatches,
      });

    if (attemptError) {
      console.error("PIN attempt error:", attemptError.message);

      return NextResponse.json(
        { error: "認証処理に失敗しました。" },
        { status: 500 }
      );
    }

    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "認証を一時制限しています。15分後に再試行してください。",
        },
        { status: 429 }
      );
    }

    if (!pinMatches) {
      return NextResponse.json(
        { error: "ドライバー名またはPINが違います。" },
        { status: 401 }
      );
    }

    // DBに登録されている正式な名前を使用
    const authenticatedName = String(setting!.driver_name);

    // 署名付きセッションを作成
    const token = await createHandoverSession(
      authenticatedName
    );

    const response = NextResponse.json({
      status: "authenticated",
      driverName: authenticatedName,
    });

    response.cookies.set(HANDOVER_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    console.error("Handover authentication error:", error);

    return NextResponse.json(
      { error: "認証処理に失敗しました。" },
      { status: 500 }
    );
  }
}
