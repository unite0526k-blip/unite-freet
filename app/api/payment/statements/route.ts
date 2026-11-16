import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authorize(
  request: NextRequest
): Promise<
  | { ok: true }
  | { error: string; status: number }
> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return { error: "ログインしてください。", status: 401 } as const;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminId = process.env.PAYMENT_ADMIN_USER_ID?.trim();

  if (!url || !key || !adminId) {
    return { error: "サーバー設定が不足しています。", status: 500 } as const;
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    return { error: "再ログインしてください。", status: 401 } as const;
  }

  if (data.user.id !== adminId) {
    return { error: "管理者権限がありません。", status: 403 } as const;
  }

  return { ok: true } as const;
}

function authError(auth: { error: string; status: number }) {
  return NextResponse.json(
    { error: auth.error },
    { status: auth.status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if ("error" in auth) return authError(auth);

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("payment_statements")
      .select("id,driver_name,target_month,is_published,created_at,updated_at")
      .order("target_month", { ascending: false })
      .order("driver_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json(
      { statements: data ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Payment list error", error);
    return NextResponse.json(
      { error: "一覧の取得に失敗しました。" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize(request);
  if ("error" in auth) return authError(auth);

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "入力が不正です。" }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    // 複数選択の一括公開・非公開（管理者認証済み）
    if (Array.isArray(payload.ids)) {
      const ids = payload.ids;
      if (
        typeof payload.isPublished !== "boolean" ||
        ids.length === 0 ||
        ids.length > 500 ||
        !ids.every((id) => typeof id === "string" && UUID_PATTERN.test(id)) ||
        new Set(ids).size !== ids.length
      ) {
        return NextResponse.json({ error: "一括変更の入力が不正です（最大500件）。" }, { status: 400 });
      }
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from("payment_statements")
        .update({ is_published: payload.isPublished, updated_at: new Date().toISOString() })
        .in("id", ids as string[])
        .select("id");
      if (error) throw error;
      if ((data?.length ?? 0) !== ids.length) {
        return NextResponse.json({ error: "一部の明細が見つかりません。一覧を更新してください。" }, { status: 409 });
      }
      return NextResponse.json({ success: true, updatedCount: data?.length ?? 0 });
    }

    if (
      typeof payload.id !== "string" ||
      !UUID_PATTERN.test(payload.id) ||
      typeof payload.isPublished !== "boolean"
    ) {
      return NextResponse.json({ error: "入力が不正です。" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("payment_statements")
      .update({
        is_published: payload.isPublished,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.id)
      .select("id,is_published")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, statement: data });
  } catch (error) {
    console.error("Payment publish error", error);
    return NextResponse.json(
      { error: "公開設定の変更に失敗しました。" },
      { status: 500 },
    );
  }
}

// 個人ドライバーの支払明細を削除（管理者専用）
export async function DELETE(request: NextRequest) {
  const auth = await authorize(request);
  if ("error" in auth) return authError(auth);

  try {
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "入力が不正です。" }, { status: 400 });
    }

    const { id } = body as Record<string, unknown>;
    if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: "明細IDが不正です。" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: statement, error: lookupError } = await admin
      .from("payment_statements")
      .select("id,file_path")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!statement) {
      return NextResponse.json(
        { error: "対象の明細が見つかりません。" },
        { status: 404 },
      );
    }

    // DBから先に削除し、閲覧不能にする
    const { data: deleted, error: deleteError } = await admin
      .from("payment_statements")
      .delete()
      .eq("id", id)
      .select("id,file_path")
      .maybeSingle();

    if (deleteError) throw deleteError;
    if (!deleted) {
      return NextResponse.json(
        { error: "明細が既に削除されています。" },
        { status: 404 },
      );
    }

    // DB削除後、非公開StorageのPDFを削除
    const { error: storageError } = await admin.storage
      .from("payment-statements")
      .remove([deleted.file_path]);

    if (storageError) {
      console.error("Payment PDF cleanup error:", storageError);
      return NextResponse.json({
        success: true,
        message: "明細は削除しましたが、PDFファイルの削除に失敗しました。管理者に確認してください。",
        storageCleanupFailed: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: "支払明細を削除しました。",
    });
  } catch (error) {
    console.error("Payment delete error", error);
    return NextResponse.json(
      { error: "支払明細の削除に失敗しました。" },
      { status: 500 },
    );
  }
}
