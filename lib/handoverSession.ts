import "server-only";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "handover_session";

function getSecret() {
  const secret = process.env.HANDOVER_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("HANDOVER_SESSION_SECRETが未設定です");
  }

  return new TextEncoder().encode(secret);
}

export async function createHandoverSession(driverName: string) {
  return new SignJWT({ driverName })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function verifyHandoverSession(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });

    return typeof payload.driverName === "string"
      ? payload.driverName
      : null;
  } catch {
    return null;
  }
}

export const HANDOVER_COOKIE_NAME = COOKIE_NAME;