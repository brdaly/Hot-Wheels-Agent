import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ferrari } from "./fixtures";

const authenticateOwner = vi.hoisted(() => vi.fn());

vi.mock("../lib/security/owner-session", () => ({ authenticateOwner }));

import { POST } from "../app/api/score/route";

const ownerIdentity = {
  authenticated: true as const,
  accessToken: "test-access-token",
  safetyIdentifier: "test-owner",
  userId: "00000000-0000-4000-8000-000000000001",
};

function scoreRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://example.test/api/score", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

function expectNoStore(response: Response) {
  expect(response.headers.get("cache-control")).toContain("no-store");
}

describe("owner-scoped deterministic score route", () => {
  beforeEach(() => {
    authenticateOwner.mockReset();
    authenticateOwner.mockResolvedValue(ownerIdentity);
  });

  it("requires owner authentication before parsing or scoring an observation", async () => {
    authenticateOwner.mockResolvedValue({ authenticated: false, status: 401 });
    const response = await POST(scoreRequest(JSON.stringify(ferrari)));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Sign in is required",
      code: "owner_auth_required",
    });
    expectNoStore(response);
  });

  it("returns a no-store result for an authenticated owner", async () => {
    const response = await POST(scoreRequest(JSON.stringify(ferrari)));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.score.modelVersion).toBe("collection-priority-v3.1");
    expect(body.marketEvidenceCount).toBe(0);
    expect(body.recommendation.conditionGrade).toBe("unknown");
    expectNoStore(response);
  });

  it.each([
    ["malformed JSON", "{"],
    ["an invalid observation shape", JSON.stringify({})],
  ])("rejects %s", async (_label, body) => {
    const response = await POST(scoreRequest(body));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Invalid observation");
    expectNoStore(response);
  });

  it("rejects a declared oversized request before reading the body", async () => {
    const response = await POST(scoreRequest("{}", { "content-length": String(256 * 1024 + 1) }));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Observation is too large" });
    expectNoStore(response);
  });

  it("rejects an actually oversized request when the declared length is absent or wrong", async () => {
    const response = await POST(scoreRequest(JSON.stringify({ padding: "x".repeat(256 * 1024) }), { "content-length": "1" }));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Observation is too large" });
    expectNoStore(response);
  });

  it("rejects a cross-origin request before authentication", async () => {
    const response = await POST(scoreRequest(JSON.stringify(ferrari), { origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Request rejected" });
    expect(authenticateOwner).not.toHaveBeenCalled();
    expectNoStore(response);
  });

  it("fails closed when owner authentication is unavailable", async () => {
    authenticateOwner.mockResolvedValue({ authenticated: false, status: 503 });
    const response = await POST(scoreRequest(JSON.stringify(ferrari)));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Scoring is temporarily unavailable",
      code: "owner_auth_unavailable",
    });
    expectNoStore(response);
  });
});
