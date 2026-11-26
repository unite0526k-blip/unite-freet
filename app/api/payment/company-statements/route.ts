import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

async function authorize(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminId = process.env.PAYMENT_ADMIN_USER_ID?.trim();
  if (!url || !key || !adminId) throw new Error("認証設定が不足しています。");

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  return !error && data.user?.id === adminId;
}

export async function GET(request: NextRequest) {
  try {
    if (!(await authorize(request))) return fail("管理者権限がありません。", 403);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("payment_company_statements")
      .select("id,company_id,target_month,is_published")
      .order("target_month", { ascending: false });
    if (error) throw error;
    return NextResponse.json(
      { statements: data ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Company statements GET error:", error);
    return fail("会社明細の取得に失敗しました。", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await authorize(request))) return fail("管理者権限がありません。", 403);
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("入力が不正です。", 400);
    const { id, isPublished } = body as Record<string, unknown>;
    if (typeof id !== "string" || !UUID_PATTERN.test(id) || typeof isPublished !== "boolean") {
      return fail("入力が不正です。", 400);
    }
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("payment_company_statements")
      .update({ is_published: isPublished, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id,is_published")
      .single();
    if (error) throw error;
    return NextResponse.json(
      { success: true, statement: data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Company statements PATCH error:", error);
    return fail("会社明細の公開設定変更に失敗しました。", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await authorize(request))) return fail("管理者権限がありません。", 403);

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("入力が不正です。", 400);
    const { id } = body as Record<string, unknown>;
    if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
      return fail("明細IDが不正です。", 400);
    }

    const admin = getSupabaseAdmin();
    const { data: statement, error: lookupError } = await admin
      .from("payment_company_statements")
      .select("id,file_path")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!statement) return fail("対象の明細が見つかりません。", 404);

    // 先にDBから削除し、一覧や公開ページから確実に見えなくする。
    const { error: deleteError } = await admin
      .from("payment_company_statements")
      .delete()
      .eq("id", id);
    if (deleteError) throw deleteError;

    // DB削除後、保存されていたPDF本体も削除する。
    // Storage削除に失敗しても、DB削除は元に戻せないため成功として返し、ログに記録する。
    let storageRemoved = true;
    if (typeof statement.file_path === "string" && statement.file_path) {
      const { error: storageError } = await admin.storage
        .from("payment-statements")
        .remove([statement.file_path]);
      if (storageError) {
        storageRemoved = false;
        console.error("Company statement PDF cleanup error:", {
          id,
          filePath: statement.file_path,
          error: storageError,
        });
      }
    }

    return NextResponse.json(
      { success: true, storageRemoved },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Company statements DELETE error:", error);
    return fail("会社明細の削除に失敗しました。", 500);
  }
}
