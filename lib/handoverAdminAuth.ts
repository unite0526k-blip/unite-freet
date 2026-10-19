
import "server-only";
import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const HANDOVER_ADMIN_COOKIE = "handover_admin_session";

export async function isHandoverAdmin(
  request: NextRequest
): Promise<boolean> {
  const token = request.cookies.get(HANDOVER_ADMIN_COOKIE)?.value;

  if (!token) return false;

  const secret = process.env.HANDOVER_SESSION_SECRET;
  if (!secret || secret.length < 32) return false;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ["HS256"] }
    );

    if (
      payload.scope !== "handover_admin" ||
      typeof payload.sub !== "string"
    ) {
      return false;
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("handover_members")
      .select("role")
      .eq("user_id", payload.sub)
      .eq("role", "admin")
      .maybeSingle();

    return !error && data?.role === "admin";
  } catch {
    return false;
  }
}
