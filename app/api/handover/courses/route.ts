import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  HANDOVER_COOKIE_NAME,
  verifyHandoverSession,
} from "@/lib/handoverSession";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(HANDOVER_COOKIE_NAME)?.value;

    const driverName = token
      ? await verifyHandoverSession(token)
      : null;

    if (!driverName) {
      return NextResponse.json(
        { error: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("handover_courses")
      .select("id, office_id, office, name, is_active")
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    return NextResponse.json(
      { courses: data ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("コース取得エラー:", error);

    return NextResponse.json(
      { error: "コース一覧を取得できませんでした。" },
      { status: 500 }
    );
  }
}