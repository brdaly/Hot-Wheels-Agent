import { describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  clearOwnerSessionCookie,
  OWNER_SESSION_COOKIE,
  requestOwnerToken,
  setOwnerSessionCookie,
} from "../lib/security/owner-session";

describe("owner session transport", () => {
  it("prefers an explicit bearer token over a cookie", () => {
    const request = new NextRequest("https://example.test/api/session", {
      headers: {
        Authorization: "Bearer header-token",
        Cookie: `${OWNER_SESSION_COOKIE}=cookie-token`,
      },
    });
    expect(requestOwnerToken(request)).toBe("header-token");
  });

  it("sets and clears a hardened owner cookie", () => {
    const token = `x.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url")}.y`;
    const response = NextResponse.json({ ok: true });
    setOwnerSessionCookie(response, token);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${OWNER_SESSION_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=strict");

    const clearResponse = new NextResponse(null, { status: 204 });
    clearOwnerSessionCookie(clearResponse);
    expect(clearResponse.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

