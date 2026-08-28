import type { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { bearerToken, pseudonymousIdentifier } from "../security";
import { getSupabaseServiceClient } from "./service-client";

export const OWNER_SESSION_COOKIE = "hw_owner_session";

export type OwnerIdentity = {
  authenticated: true;
  accessToken: string;
  safetyIdentifier: string;
  userId: string;
};

export type OwnerAuthFailure = {
  authenticated: false;
  status: 401 | 403 | 503;
};

export type OwnerAuthResult = OwnerIdentity | OwnerAuthFailure;

function configuredOwnerId() {
  const value = process.env.HOTWHEELS_OWNER_USER_ID ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

export function requestOwnerToken(request: NextRequest) {
  return (
    bearerToken(request.headers.get("authorization")) ??
    request.cookies.get(OWNER_SESSION_COOKIE)?.value ??
    null
  );
}

export async function verifyOwnerAccessToken(accessToken: string): Promise<OwnerAuthResult> {
  if (accessToken.length > 4_096) return { authenticated: false, status: 401 };
  const ownerId = configuredOwnerId();
  if (!ownerId) return { authenticated: false, status: 503 };

  try {
    const { data, error } = await getSupabaseServiceClient().auth.getUser(accessToken);
    if (error || !data.user) return { authenticated: false, status: 401 };
    if (data.user.id.toLowerCase() !== ownerId) return { authenticated: false, status: 403 };
    return {
      authenticated: true,
      accessToken,
      safetyIdentifier: pseudonymousIdentifier(`owner:${data.user.id}`),
      userId: data.user.id,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "owner_auth_unavailable",
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
    return { authenticated: false, status: 503 };
  }
}

export async function authenticateOwner(request: NextRequest): Promise<OwnerAuthResult> {
  const accessToken = requestOwnerToken(request);
  return accessToken
    ? verifyOwnerAccessToken(accessToken)
    : { authenticated: false, status: 401 };
}

export async function signInOwnerWithPassword(email: string, password: string): Promise<OwnerAuthResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return { authenticated: false, status: 503 };
  try {
    const client = createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session?.access_token) return { authenticated: false, status: 401 };
    return verifyOwnerAccessToken(data.session.access_token);
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "owner_sign_in_unavailable",
      error: error instanceof Error ? error.message : "unknown",
    }));
    return { authenticated: false, status: 503 };
  }
}

/** Create a per-request client whose database calls are constrained by RLS. */
export function createOwnerDataClient(identity: OwnerIdentity) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("Owner data access is not configured");
  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${identity.accessToken}` } },
  });
}

function accessTokenMaxAge(accessToken: string) {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      exp?: unknown;
    };
    if (typeof payload.exp === "number") {
      return Math.max(0, Math.min(3_600, Math.floor(payload.exp - Date.now() / 1000)));
    }
  } catch {
    // The token was already verified; an unreadable expiry just gets a short cookie.
  }
  return 900;
}

export function setOwnerSessionCookie(response: NextResponse, accessToken: string) {
  response.cookies.set(OWNER_SESSION_COOKIE, accessToken, {
    httpOnly: true,
    maxAge: accessTokenMaxAge(accessToken),
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearOwnerSessionCookie(response: NextResponse) {
  response.cookies.set(OWNER_SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}
