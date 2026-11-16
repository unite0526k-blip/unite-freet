import { NextRequest, NextResponse } from "next/server";
import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "unite_payment_session";

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function normalize(value: string) {
  return value.replace(/[\s　]/g, "");
}

function officeName(value: string) {
  return value.trim().replace(/営業所$/, "");
}

function getSecret() {
  const secret = process.env.HANDOVER_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("認証用の秘密鍵が設定されていません。");
  }

  return secret;
}

function makeSession(driverName: string, secret: string) {
  const payload = Buffer.from(
    JSON.stringify({
      driverName,
      expires: Date.now() + 30 * 60 * 1000,
    }),
  ).toString("base64url");

  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function safePinMatch(actual: string, entered: string) {
  const a = createHash("sha256").update(actual).digest();
  const b = createHash("sha256").update(entered).digest();

  return timingSafeEqual(a, b);
}

type Driver = {
  name?: string;
  office?: string;
};

export async function POST(request: NextRequest) {
  try {
    const secret = getSecret();

    const body = await request.json().catch(() => null);

    const office = String(body?.office ?? "").trim();
    const driverName = String(body?.driverName ?? "").trim();
    const pin = String(body?.pin ?? "");

    if (
      !office ||
      !driverName ||
      office.length > 100 ||
      driverName.length > 100 ||
      !/^\d{4}$/.test(pin)
    ) {
      return json(
        { error: "営業所・名前・4桁PINを確認してください。" },
        400,
      );
    }

    const supabase = getSupabaseAdmin();

    // 同じ名前・アクセス元からの連続試行を制限
    const ip =
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const attemptKey = createHmac("sha256", secret)
      .update(`${normalize(driverName)}:${ip}`)
      .digest("hex");

    const { data: allowed, error: limitError } =
      await supabase.rpc("payment_check_login_limit", {
        p_key: attemptKey,
      });

    if (limitError) {
      console.error("Login limit error:", limitError.message);
      return json(
        { error: "現在ログインできません。しばらくしてからお試しください。" },
        503,
      );
    }

    if (allowed !== true) {
      return json(
        { error: "入力回数の上限です。15分後に再度お試しください。" },
        429,
      );
    }

    // 登録済みドライバーを確認
    const { data: master, error: masterError } = await supabase
      .from("fleet_master")
      .select("drivers")
      .eq("id", "default")
      .single();

    if (masterError) throw masterError;

    const drivers: Driver[] = Array.isArray(master?.drivers)
      ? master.drivers
      : [];

    const driver = drivers.find(
      (item) =>
        normalize(String(item.name ?? "")) ===
          normalize(driverName) &&
        officeName(String(item.office ?? "")) ===
          officeName(office),
    );

    if (!driver?.name) {
      return json(
        { error: "名前またはPINが正しくありません。" },
        401,
      );
    }

    // PINはサーバー側だけで照合
    const { data: settings, error: pinError } = await supabase
      .from("shift_driver_settings")
      .select("pin_code")
      .eq("driver_name", driver.name)
      .maybeSingle();

    if (pinError) throw pinError;

    if (
      !settings ||
      !safePinMatch(String(settings.pin_code ?? ""), pin)
    ) {
      return json(
        { error: "名前またはPINが正しくありません。" },
        401,
      );
    }

    // 本人の公開済み明細のみ取得
    const { data: statements, error: statementsError } =
      await supabase
        .from("payment_statements")
        .select("id,target_month")
        .eq("driver_name", driver.name)
        .eq("is_published", true)
        .order("target_month", { ascending: false });

    if (statementsError) throw statementsError;

    // 代表者として登録されている協力会社の公開済み明細を取得
    const { data: companies, error: companiesError } = await supabase
      .from("payment_companies")
      .select("id,company_name")
      .eq("representative_driver_name", driver.name);

    if (companiesError) throw companiesError;

    const companyIds = (companies ?? []).map((company) => company.id);
    let companyStatements: Array<{
      id: string;
      company_id: string;
      target_month: string;
      company_name: string;
    }> = [];

    if (companyIds.length > 0) {
      const { data: rows, error: companyStatementsError } = await supabase
        .from("payment_company_statements")
        .select("id,company_id,target_month")
        .in("company_id", companyIds)
        .eq("is_published", true)
        .order("target_month", { ascending: false });

      if (companyStatementsError) throw companyStatementsError;

      const companyNames = new Map(
        (companies ?? []).map((company) => [company.id, company.company_name]),
      );

      companyStatements = (rows ?? []).map((row) => ({
        id: row.id,
        company_id: row.company_id,
        target_month: row.target_month,
        company_name: companyNames.get(row.company_id) ?? "協力会社",
      }));
    }

    const response = json({
      success: true,
      statements: statements ?? [],
      companyStatements,
    });

    // PDF閲覧用の短時間セッション
    response.cookies.set(
      COOKIE_NAME,
      makeSession(driver.name, secret),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/payment",
        maxAge: 30 * 60,
      },
    );

    return response;
  } catch (error) {
    console.error("Payment login error:", error);

    return json(
      { error: "ログイン処理でエラーが発生しました。" },
      500,
    );
  }
}
