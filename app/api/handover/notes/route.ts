
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  HANDOVER_COOKIE_NAME,
  verifyHandoverSession,
} from "@/lib/handoverSession";

async function authenticate(request: NextRequest) {
  const token = request.cookies.get(HANDOVER_COOKIE_NAME)?.value;
  return token ? await verifyHandoverSession(token) : null;
}

// 引き継ぎ事項の取得
export async function GET(request: NextRequest) {
  try {
    const driverName = await authenticate(request);

    if (!driverName) {
      return NextResponse.json(
        { error: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const courseId = request.nextUrl.searchParams.get("courseId");

    if (!courseId) {
      return NextResponse.json(
        { error: "コースを選択してください。" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("handover_notes")
      .select(
        "id, course_id, customer_name, address, content, is_important, driver_name, created_at, updated_at"
      )
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(
      { notes: data ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("引き継ぎ取得エラー:", error);
    return NextResponse.json(
      { error: "引き継ぎ事項を取得できませんでした。" },
      { status: 500 }
    );
  }
}

// 引き継ぎ事項の新規登録
export async function POST(request: NextRequest) {
  try {
    const driverName = await authenticate(request);

    if (!driverName) {
      return NextResponse.json(
        { error: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const courseId = String(body.courseId ?? "");
    const customerName = String(body.customerName ?? "").trim();
    const address = String(body.address ?? "").trim();
    const content = String(body.content ?? "").trim();
    const isImportant = body.isImportant === true;

    if (
      !/^[0-9a-f-]{36}$/i.test(courseId) ||
      !customerName ||
      !address ||
      !content ||
      customerName.length > 200 ||
      address.length > 500 ||
      content.length > 5000
    ) {
      return NextResponse.json(
        { error: "入力内容を確認してください。" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: course, error: courseError } = await supabase
      .from("handover_courses")
      .select("id")
      .eq("id", courseId)
      .eq("is_active", true)
      .maybeSingle();

    if (courseError) throw courseError;

    if (!course) {
      return NextResponse.json(
        { error: "指定されたコースが見つかりません。" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("handover_notes")
      .insert({
        course_id: courseId,
        customer_name: customerName,
        address,
        content,
        is_important: isImportant,
        driver_name: driverName,
      })
      .select(
        "id, course_id, customer_name, address, content, is_important, driver_name, created_at, updated_at"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({ note: data }, { status: 201 });
  } catch (error) {
    console.error(
  "引き継ぎ登録エラー詳細:",
  JSON.stringify(error, Object.getOwnPropertyNames(error))
);
    return NextResponse.json(
      { error: "引き継ぎ事項を登録できませんでした。" },
      { status: 500 }
    );
  }
}
// 引き継ぎ事項の削除
export async function DELETE(request: NextRequest) {
  try {
    const driverName = await authenticate(request);

    if (!driverName) {
      return NextResponse.json(
        { error: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const noteId = body?.noteId;

    if (
      typeof noteId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(noteId)
    ) {
      return NextResponse.json(
        { error: "削除対象が正しくありません。" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: note, error: lookupError } = await supabase
      .from("handover_notes")
      .select("id, driver_name")
      .eq("id", noteId)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (!note) {
      return NextResponse.json(
        { error: "引き継ぎ事項が見つかりません。" },
        { status: 404 }
      );
    }

    // 登録した本人以外は削除できない
    if (note.driver_name !== driverName) {
      return NextResponse.json(
        { error: "この引き継ぎ事項を削除する権限がありません。" },
        { status: 403 }
      );
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("handover_notes")
      .delete()
      .eq("id", noteId)
      .eq("driver_name", driverName)
      .select("id")
      .maybeSingle();

    if (deleteError) throw deleteError;

    if (!deleted) {
      return NextResponse.json(
        { error: "削除できませんでした。" },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("引き継ぎ削除エラー:", error);

    return NextResponse.json(
      { error: "引き継ぎ事項を削除できませんでした。" },
      { status: 500 }
    );
  }
}