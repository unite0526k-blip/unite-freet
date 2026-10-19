
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isHandoverAdmin } from "@/lib/handoverAdminAuth";

export async function GET(request: NextRequest) {
  try {
    if (!(await isHandoverAdmin(request))) {
      return NextResponse.json(
        { error: "管理者権限が必要です。" },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();

    const [officesResult, coursesResult] = await Promise.all([
      supabase
        .from("handover_offices")
        .select("id, name, is_active")
        .order("name"),

      supabase
        .from("handover_courses")
        .select("id, office_id, office, name, is_active")
        .order("name"),
    ]);

    if (officesResult.error || coursesResult.error) {
      throw new Error("データ取得に失敗しました。");
    }

    return NextResponse.json(
      {
        offices: officesResult.data,
        courses: coursesResult.data,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Handover manage error:", error);

    return NextResponse.json(
      { error: "管理データの取得に失敗しました。" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isHandoverAdmin(request))) {
      return NextResponse.json(
        { error: "管理者権限が必要です。" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const type = String(body?.type ?? "");
    const name = String(body?.name ?? "").trim();

    if (!name || name.length > 100) {
      return NextResponse.json(
        { error: "名前を正しく入力してください。" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    if (type === "office") {
      const { data, error } = await supabase
        .from("handover_offices")
        .insert({ name, is_active: true })
        .select("id, name, is_active")
        .single();

      if (error) throw error;

      return NextResponse.json({ office: data }, { status: 201 });
    }

    if (type === "course") {
      const officeId = String(body?.officeId ?? "");

      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(officeId)) {
        return NextResponse.json(
          { error: "営業所を選択してください。" },
          { status: 400 }
        );
      }

      const { data: office, error: officeError } = await supabase
        .from("handover_offices")
        .select("id, name")
        .eq("id", officeId)
        .eq("is_active", true)
        .maybeSingle();

      if (officeError) throw officeError;

      if (!office) {
        return NextResponse.json(
          { error: "営業所が見つかりません。" },
          { status: 404 }
        );
      }

      const { data, error } = await supabase
        .from("handover_courses")
        .insert({
          office_id: office.id,
          office: office.name,
          name,
          is_active: true,
        })
        .select("id, office_id, office, name, is_active")
        .single();

      if (error) throw error;

      return NextResponse.json({ course: data }, { status: 201 });
    }

    return NextResponse.json(
      { error: "追加する種類が正しくありません。" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Handover manage POST error:", error);

    return NextResponse.json(
      { error: "追加に失敗しました。重複登録などを確認してください。" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await isHandoverAdmin(request))) {
      return NextResponse.json(
        { error: "管理者権限が必要です。" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const type = String(body?.type ?? "");
    const id = String(body?.id ?? "");

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json(
        { error: "IDが正しくありません。" },
        { status: 400 }
      );
    }

    if (type !== "office" && type !== "course") {
      return NextResponse.json(
        { error: "削除対象が正しくありません。" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const table =
      type === "office" ? "handover_offices" : "handover_courses";

    const { data, error } = await supabase
      .from(table)
      .update({ is_active: false })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "対象が見つかりません。" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Handover manage DELETE error:", error);

    return NextResponse.json(
      { error: "削除に失敗しました。" },
      { status: 500 }
    );
  }
}
