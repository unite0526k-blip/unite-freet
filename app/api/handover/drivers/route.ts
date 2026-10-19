import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Driver = {
  name?: string;
  office?: string;
  subOffices?: string[];
  retirementDate?: string | null;
};

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("fleet_master")
      .select("offices, drivers")
      .eq("id", "default")
      .single();

    if (error || !data) {
      console.error("Driver directory error:", error?.message);

      return NextResponse.json(
        { error: "ドライバー情報を取得できませんでした。" },
        { status: 500 }
      );
    }

    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Tokyo",
    });

    const drivers = (Array.isArray(data.drivers)
      ? data.drivers
      : []) as Driver[];

    const offices = Array.isArray(data.offices)
      ? data.offices.filter(
          (value: unknown): value is string =>
            typeof value === "string"
        )
      : [];

    const directory: Record<string, string[]> = {};

    for (const office of offices) {
      directory[office] = [];
    }

    for (const driver of drivers) {
      if (!driver.name || !driver.office) continue;

      if (
        driver.retirementDate &&
        driver.retirementDate.slice(0, 10) <= today
      ) {
        continue;
      }

      const assignedOffices = [
        driver.office,
        ...(Array.isArray(driver.subOffices)
          ? driver.subOffices
          : []),
      ];

      for (const office of new Set(assignedOffices)) {
        if (!directory[office]) {
          directory[office] = [];
        }

        if (!directory[office].includes(driver.name)) {
          directory[office].push(driver.name);
        }
      }
    }

    for (const office of Object.keys(directory)) {
      directory[office].sort((a, b) =>
        a.localeCompare(b, "ja")
      );
    }

    return NextResponse.json(
      { offices: directory },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Driver directory error:", error);

    return NextResponse.json(
      { error: "ドライバー情報を取得できませんでした。" },
      { status: 500 }
    );
  }
}