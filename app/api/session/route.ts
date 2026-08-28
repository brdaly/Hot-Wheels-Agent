import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  bearerToken,
  isAllowedOrigin,
  NO_STORE_HEADERS,
  trustedClientIp,
} from "../../../lib/security";
import { consumeDistributedRateLimit } from "../../../lib/security/distributed-rate-limit";
import {
  authenticateOwner,
  clearOwnerSessionCookie,
  setOwnerSessionCookie,
  signInOwnerWithPassword,
  verifyOwnerAccessToken,
} from "../../../lib/security/owner-session";

export const runtime = "nodejs";

const Credentials = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(256),
}).strict();

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "production" && process.env.HOTWHEELS_DEV_AUTH_BYPASS === "true") {
    return NextResponse.json({ authenticated: true, developmentBypass: true }, { headers: NO_STORE_HEADERS });
  }
  const identity = await authenticateOwner(request);
  return NextResponse.json({ authenticated: identity.authenticated }, { headers: NO_STORE_HEADERS });
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "Request rejected" }, { status: 403, headers: NO_STORE_HEADERS });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 4_096) {
    return NextResponse.json({ error: "Request rejected" }, { status: 413, headers: NO_STORE_HEADERS });
  }

  const rate = await consumeDistributedRateLimit({
    scope: "owner_sign_in",
    subject: trustedClientIp(request.headers),
    capacity: 8,
    refillPerSecond: 8 / 900,
  });
  if (!rate.available) {
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable" },
      { status: 503, headers: { ...NO_STORE_HEADERS, "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts" },
      { status: 429, headers: { ...NO_STORE_HEADERS, "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const accessToken = bearerToken(request.headers.get("authorization"));
  const identity = accessToken
    ? await verifyOwnerAccessToken(accessToken)
    : await (async () => {
        const parsed = Credentials.safeParse(await request.json().catch(() => null));
        return parsed.success
          ? signInOwnerWithPassword(parsed.data.email, parsed.data.password)
          : { authenticated: false as const, status: 401 as const };
      })();
  if (!identity.authenticated) {
    const status = identity.status === 503 ? 503 : 401;
    return NextResponse.json(
      { error: status === 503 ? "Sign-in is temporarily unavailable" : "Email or password was not accepted" },
      { status, headers: NO_STORE_HEADERS },
    );
  }

  const response = NextResponse.json({ authenticated: true }, { headers: NO_STORE_HEADERS });
  setOwnerSessionCookie(response, identity.accessToken);
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isAllowedOrigin(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "Request rejected" }, { status: 403, headers: NO_STORE_HEADERS });
  }
  const response = new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });
  clearOwnerSessionCookie(response);
  return response;
}
