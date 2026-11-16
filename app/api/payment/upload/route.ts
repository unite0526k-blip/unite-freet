
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) {
      return NextResponse.json(
        { error: "管理者ログインが必要です" },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const adminId = process.env.PAYMENT_ADMIN_USER_ID;

    if (!url || !anonKey || !adminId) {
      throw new Error("サーバー設定が不足しています");
    }

    const authClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

if (authError || !authData.user) {
  console.error("Payment auth verification failed:", authError?.message);

  return NextResponse.json(
    {
      error: "ログイン認証に失敗しました。再ログインしてください。",
    },
    { status: 401 }
  );
}

if (authData.user.id !== adminId.trim()) {
  console.error("Payment admin UID mismatch");

  return NextResponse.json(
    {
      error: "管理者UIDが一致していません。設定を確認してください。",
    },
    { status: 403 }
  );
}
    const form = await request.formData();
    const driverName = String(form.get("driverName") ?? "").trim();
    const targetMonth = String(form.get("targetMonth") ?? "");
    const file = form.get("file");

    if (!driverName || driverName.length > 100) {
      return NextResponse.json(
        { error: "ドライバー名が不正です" },
        { status: 400 }
      );
    }

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
      return NextResponse.json(
        { error: "対象年月が不正です" },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "PDFファイルを選択してください" },
        { status: 400 }
      );
    }

    if (
      file.size === 0 ||
      file.size > MAX_SIZE ||
      file.type !== "application/pdf"
    ) {
      return NextResponse.json(
        { error: "10MB以下のPDFを選択してください" },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    if (bytes.subarray(0, 5).toString() !== "%PDF-") {
      return NextResponse.json(
        { error: "PDFファイルの形式が不正です" },
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

    const drivers = Array.isArray(master?.drivers)
      ? master.drivers
      : [];

    const matched = drivers.filter(
      (driver: { name?: string }) =>
        driver.name === driverName
    );

    if (matched.length !== 1) {
      return NextResponse.json(
        { error: "登録済みドライバーを確認できません" },
        { status: 400 }
      );
    }

    const path = `${targetMonth}/${randomUUID()}.pdf`;

    const { error: uploadError } = await admin.storage
      .from("payment-statements")
      .upload(path, bytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: previous, error: previousError } = await admin
      .from("payment_statements")
      .select("file_path")
      .eq("driver_name", driverName)
      .eq("target_month", targetMonth)
      .maybeSingle();

    if (previousError) {
      await admin.storage.from("payment-statements").remove([path]);
      throw previousError;
    }

    const { error: saveError } = await admin
      .from("payment_statements")
      .upsert(
        {
          driver_name: driverName,
          target_month: targetMonth,
          file_path: path,
          is_published: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "driver_name,target_month" }
      );

    if (saveError) {
      await admin.storage.from("payment-statements").remove([path]);
      throw saveError;
    }

    // 古いファイルはDB更新成功後に削除
    if (previous?.file_path && previous.file_path !== path) {
      await admin.storage
        .from("payment-statements")
        .remove([previous.file_path]);
    }

    return NextResponse.json({
      success: true,
      message: "PDFを非公開で保存しました。まだ公開されていません。",
    });
  } catch (error) {
    console.error("Payment upload error:", error);

    return NextResponse.json(
      { error: "PDFの登録に失敗しました" },
      { status: 500 }
    );
  }
}
