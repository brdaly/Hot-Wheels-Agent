import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import hunts from "../data/hunt-map-2026.json";

const authenticateOwner = vi.hoisted(() => vi.fn());

vi.mock("../lib/security/owner-session", () => ({ authenticateOwner }));

import { GET } from "../app/api/hunt-images/route";

const ownerIdentity = {
  authenticated: true as const,
  accessToken: "test-access-token",
  safetyIdentifier: "test-owner",
  userId: "00000000-0000-4000-8000-000000000001",
};

function request() {
  return new NextRequest("https://example.test/api/hunt-images");
}

function expectPrivateHeaders(response: Response) {
  expect(response.headers.get("cache-control")).toContain("private");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("x-robots-tag")).toContain("noindex");
  expect(response.headers.get("x-robots-tag")).toContain("noarchive");
}

describe("owner-only personal-prototype hunt images", () => {
  beforeEach(() => {
    authenticateOwner.mockReset();
    authenticateOwner.mockResolvedValue(ownerIdentity);
  });

  it("fails closed for a public visitor", async () => {
    authenticateOwner.mockResolvedValue({ authenticated: false, status: 401 });
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Owner sign-in is required", code: "owner_auth_required" });
    expectPrivateHeaders(response);
  });

  it("fails closed when owner authentication is unavailable", async () => {
    authenticateOwner.mockResolvedValue({ authenticated: false, status: 503 });
    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Private reference images are temporarily unavailable", code: "owner_auth_unavailable" });
    expectPrivateHeaders(response);
  });

  it("returns all 30 attributed remote references only to the owner", async () => {
    const response = await GET(request());
    const body = await response.json() as {
      mode: string;
      audience: string;
      licensedForPublicDistribution: boolean;
      images: Array<{ part: string; name: string; sourceUrl: string; imageUrl: string; attribution: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.mode).toBe("private_personal_prototype");
    expect(body.audience).toBe("Brendan Daly owner session only");
    expect(body.licensedForPublicDistribution).toBe(false);
    expect(body.images).toHaveLength(30);
    expect(new Set(body.images.map((image) => image.part)).size).toBe(30);
    const publicEntries = hunts.cases.flatMap((row) => [row.super, row.treasure]);
    expect(body.images.map(({ part, name }) => ({ part, name })).sort((a, b) => a.part.localeCompare(b.part)))
      .toEqual(publicEntries.map(({ part, name }) => ({ part, name })).sort((a, b) => a.part.localeCompare(b.part)));
    for (const image of body.images) {
      expect(image.sourceUrl).toMatch(/^https:\/\/hwheadline\.com\//);
      expect(image.imageUrl).toMatch(/^https:\/\/storage\.ghost\.io\//);
      expect(image.attribution).toBe("Photo: HWheadline / HWJamey");
    }
    expectPrivateHeaders(response);
  });
});
