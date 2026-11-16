
import { NextRequest, NextResponse } from "next/server";
import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "unite_payment_session";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function verifySession(token: string | undefined) {
  const secret = process.env.HANDOVER_SESSION_SECRET;

  if (!secret || secret.length < 32 || !token) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [payload, signature] = parts;

  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest();

  let received: Buffer;

  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }

  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );

    if (
      typeof session.driverName !== "string" ||
      !session.driverName ||
      typeof session.expires !== "number" ||
      session.expires <= Date.now()
    ) {
      return null;
    }

    return session.driverName as string;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    // ① PIN認証済みの本人か確認
    const driverName = verifySession(
      request.cookies.get(COOKIE_NAME)?.value,
    );

    if (!driverName) {
      return errorResponse(
        "認証の有効期限が切れました。もう一度ログインしてください。",
        401,
      );
    }

    const { id } = await context.params;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      return errorResponse("明細が見つかりません。", 404);
    }

    const supabase = getSupabaseAdmin();

    // ② 本人の公開済みPDFだけを検索
    const { data: statement, error: statementError } =
      await supabase
        .from("payment_statements")
        .select("file_path,target_month")
        .eq("id", id)
        .eq("driver_name", driverName)
        .eq("is_published", true)
        .maybeSingle();

    if (statementError) {
      throw statementError;
    }

    if (!statement) {
      return errorResponse("明細が見つかりません。", 404);
    }

    // ③ 非公開Storageからサーバー側でPDF取得
    const { data: file, error: fileError } =
      await supabase.storage
        .from("payment-statements")
        .download(statement.file_path);

    if (fileError || !file) {
      throw fileError ?? new Error("PDFを取得できませんでした。");
    }

    const bytes = await file.arrayBuffer();

    // ④ PDFをブラウザへ返す。公開URLは発行しない
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="payment-${statement.target_month}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    console.error("Payment PDF error:", error);

    return errorResponse(
      "PDFを取得できませんでした。",
      500,
    );
  }
}
