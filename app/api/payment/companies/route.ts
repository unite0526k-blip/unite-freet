
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  if (!token) {
    return { error: "ログインしてください。", status: 401 } as const;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminId = process.env.PAYMENT_ADMIN_USER_ID?.trim();

  if (!url || !key || !adminId) {
    return {
      error: "サーバー設定が不足しています。",
      status: 500,
    } as const;
  }

  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    return {
      error: "再ログインしてください。",
      status: 401,
    } as const;
  }

  if (data.user.id !== adminId) {
    return {
      error: "管理者権限がありません。",
      status: 403,
    } as const;
  }

  return { ok: true } as const;
}

type Driver = {
  name?: string;
};

function normalize(value: string) {
  return value.replace(/[\s　]+/g, "").trim();
}

// 協力会社一覧
export async function GET(request: NextRequest) {
  const auth = await authorize(request);

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from("payment_companies")
      .select(
        "id,company_name,representative_driver_name,created_at,updated_at"
      )
      .order("company_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json(
      { companies: data ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Company list error:", error);

    return NextResponse.json(
      { error: "協力会社一覧を取得できませんでした。" },
      { status: 500 }
    );
  }
}

// 協力会社を登録
export async function POST(request: NextRequest) {
  const auth = await authorize(request);

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const body = await request.json().catch(() => null);

    const companyName = String(
      body?.companyName ?? ""
    ).trim();

    const representativeName = String(
      body?.representativeDriverName ?? ""
    ).trim();

    if (
      !companyName ||
      companyName.length > 100 ||
      !representativeName ||
      representativeName.length > 100
    ) {
      return NextResponse.json(
        { error: "会社名と代表者を確認してください。" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // 代表者が登録済みドライバーか確認
    const { data: master, error: masterError } = await admin
      .from("fleet_master")
      .select("drivers")
      .eq("id", "default")
      .single();

    if (masterError) throw masterError;

    const drivers: Driver[] = Array.isArray(master?.drivers)
      ? master.drivers
      : [];

    const matches = drivers.filter(
      (driver) =>
        normalize(String(driver.name ?? "")) ===
        normalize(representativeName)
    );

    if (matches.length !== 1 || !matches[0].name) {
      return NextResponse.json(
        { error: "登録済みの代表者を確認できません。" },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("payment_companies")
      .insert({
        company_name: companyName,
        representative_driver_name: matches[0].name,
      })
      .select(
        "id,company_name,representative_driver_name"
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "この協力会社はすでに登録されています。" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      company: data,
      message: "協力会社を登録しました。",
    });
  } catch (error) {
    console.error("Company registration error:", error);

    return NextResponse.json(
      { error: "協力会社の登録に失敗しました。" },
      { status: 500 }
    );
  }
}

// 代表者を変更
export async function PATCH(request: NextRequest) {
  const auth = await authorize(request);

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const body = await request.json().catch(() => null);

    const id = String(body?.id ?? "");
    const representativeName = String(
      body?.representativeDriverName ?? ""
    ).trim();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
      !representativeName ||
      representativeName.length > 100
    ) {
      return NextResponse.json(
        { error: "入力内容を確認してください。" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: master, error: masterError } = await admin
      .from("fleet_master")
      .select("drivers")
      .eq("id", "default")
      .single();

    if (masterError) throw masterError;

    const drivers: Driver[] = Array.isArray(master?.drivers)
      ? master.drivers
      : [];

    const matches = drivers.filter(
      (driver) =>
        normalize(String(driver.name ?? "")) ===
        normalize(representativeName)
    );

    if (matches.length !== 1 || !matches[0].name) {
      return NextResponse.json(
        { error: "登録済みの代表者を確認できません。" },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("payment_companies")
      .update({
        representative_driver_name: matches[0].name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        "id,company_name,representative_driver_name"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      company: data,
      message: "代表者を変更しました。",
    });
  } catch (error) {
    console.error("Company representative update error:", error);

    return NextResponse.json(
      { error: "代表者の変更に失敗しました。" },
      { status: 500 }
    );
  }
}
