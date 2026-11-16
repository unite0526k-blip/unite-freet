
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "unite_payment_session";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function normalize(value: string) {
  return value.replace(/[\s　]/g, "");
}

function getSessionDriver(request: NextRequest): string | null {
  const secret = process.env.HANDOVER_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("認証用の秘密鍵が設定されていません。");
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return null;

  const parts = cookie.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;

  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest();

  let actual: Buffer;

  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }

  if (
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
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

    return session.driverName;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const driverName = getSessionDriver(request);

    if (!driverName) {
      return errorResponse("再度ログインしてください。", 401);
    }

    const { id } = await context.params;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      return errorResponse("明細が見つかりません。", 404);
    }

    const admin = getSupabaseAdmin();

    // 公開済みの協力会社明細だけ取得
    const { data: statement, error: statementError } =
      await admin
        .from("payment_company_statements")
        .select("id,company_id,file_path")
        .eq("id", id)
        .eq("is_published", true)
        .maybeSingle();

    if (statementError) throw statementError;

    if (!statement) {
      return errorResponse("明細が見つかりません。", 404);
    }

    // ログイン中の本人が協力会社の代表者か確認
    const { data: company, error: companyError } =
      await admin
        .from("payment_companies")
        .select("representative_driver_name")
        .eq("id", statement.company_id)
        .maybeSingle();

    if (companyError) throw companyError;

    if (
      !company ||
      normalize(company.representative_driver_name ?? "") !==
        normalize(driverName)
    ) {
      return errorResponse("閲覧権限がありません。", 403);
    }

    // 非公開StorageからPDFを取得
    const { data: pdf, error: pdfError } =
      await admin.storage
        .from("payment-statements")
        .download(statement.file_path);

    if (pdfError || !pdf) {
      return errorResponse("PDFを取得できませんでした。", 404);
    }

    const bytes = await pdf.arrayBuffer();

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="statement.pdf"',
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Company PDF error:", error);

    return errorResponse(
      "PDFの表示中にエラーが発生しました。",
      500,
    );
  }
}
