
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Driver = {
  name?: string;
  office?: string;
};

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("fleet_master")
      .select("drivers")
      .eq("id", "default")
      .single();

    if (error) {
      throw error;
    }

    const drivers: Driver[] = Array.isArray(data?.drivers)
      ? data.drivers
      : [];

    const result = drivers
      .filter((driver) => driver.name && driver.office)
      .map((driver) => ({
        name: String(driver.name).trim(),
        office: String(driver.office).trim(),
      }));

    return NextResponse.json(
      { drivers: result },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Payment driver roster error:", error);

    return NextResponse.json(
      { error: "ドライバー名簿を取得できませんでした。" },
      { status: 500 },
    );
  }
}
