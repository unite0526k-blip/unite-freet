
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 10 * 1024 * 1024;

function json(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

async function authorize(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  if (!token) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminId = process.env.PAYMENT_ADMIN_USER_ID?.trim();

  if (!url || !key || !adminId) {
    throw new Error("認証設定が不足しています。");
  }

  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await client.auth.getUser(token);

  return (
    !error &&
    data.user !== null &&
    data.user.id === adminId
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!(await authorize(request))) {
      return json("管理者権限がありません。", 403);
    }

    const form = await request.formData();

    const companyId = String(
      form.get("companyId") ?? ""
    ).trim();

    const targetMonth = String(
      form.get("targetMonth") ?? ""
    ).trim();

    const file = form.get("file");

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(companyId)) {
      return json("協力会社を選択してください。", 400);
    }

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
      return json("対象年月が不正です。", 400);
    }

    if (!(file instanceof File)) {
      return json("PDFを選択してください。", 400);
    }

    if (
      file.size === 0 ||
      file.size > MAX_SIZE ||
      file.type !== "application/pdf"
    ) {
      return json("10MB以下のPDFを選択してください。", 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    if (bytes.subarray(0, 5).toString() !== "%PDF-") {
      return json("PDFの形式が不正です。", 400);
    }

    const admin = getSupabaseAdmin();

    // 協力会社が存在するか確認
    const { data: company, error: companyError } =
      await admin
        .from("payment_companies")
        .select("id")
        .eq("id", companyId)
        .maybeSingle();

    if (companyError) throw companyError;

    if (!company) {
      return json("協力会社が見つかりません。", 404);
    }

    // 個人用PDFとは別のフォルダに保存
    const path =
      `companies/${companyId}/${targetMonth}/${randomUUID()}.pdf`;

    const bucket = admin.storage.from("payment-statements");

    const { error: uploadError } = await bucket.upload(
      path,
      bytes,
      {
        contentType: "application/pdf",
        upsert: false,
      }
    );

    if (uploadError) throw uploadError;

    // 以前のPDFを確認
    const { data: previous, error: previousError } =
      await admin
        .from("payment_company_statements")
        .select("file_path")
        .eq("company_id", companyId)
        .eq("target_month", targetMonth)
        .maybeSingle();

    if (previousError) {
      await bucket.remove([path]);
      throw previousError;
    }

    // 同じ会社・同じ月なら置き換える
    const { error: saveError } = await admin
      .from("payment_company_statements")
      .upsert(
        {
          company_id: companyId,
          target_month: targetMonth,
          file_path: path,
          is_published: false,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "company_id,target_month",
        }
      );

    if (saveError) {
      await bucket.remove([path]);
      throw saveError;
    }

    // 登録成功後に古いPDFを削除
    if (
      previous?.file_path &&
      previous.file_path !== path
    ) {
      const { error: removeError } = await bucket.remove([
        previous.file_path,
      ]);

      if (removeError) {
        console.error(
          "Old company PDF cleanup error:",
          removeError
        );
      }
    }

    return NextResponse.json({
      success: true,
      message:
        "協力会社のPDFを非公開で登録しました。",
    });
  } catch (error) {
    console.error("Company PDF upload error:", error);

    return json(
      "協力会社のPDF登録に失敗しました。",
      500
    );
  }
}
