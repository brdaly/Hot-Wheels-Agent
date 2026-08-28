import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, rpcMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));

import { ownedQuantitiesByFingerprint } from "../lib/db";

describe("alias-aware owned quantity lookup", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    rpcMock.mockReset();
    createClientMock.mockReset().mockReturnValue({ rpc: rpcMock });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("deduplicates inputs, calls the aggregate RPC, and accepts only safe requested quantities", async () => {
    rpcMock.mockResolvedValue({
      data: [
        { fingerprint: "release-a", quantity: "7" },
        { fingerprint: "unrequested", quantity: "9" },
        { fingerprint: "release-b", quantity: "-1" },
        { fingerprint: "release-c", quantity: String(Number.MAX_SAFE_INTEGER + 1) },
      ],
      error: null,
    });

    await expect(ownedQuantitiesByFingerprint(
      [" release-a ", "release-a", "release-b", "release-c", ""],
      "00000000-0000-0000-0000-000000000001",
    )).resolves.toEqual({ "release-a": 7 });
    expect(rpcMock).toHaveBeenCalledWith("owned_quantities_by_fingerprints", {
      target_fingerprints: ["release-a", "release-b", "release-c"],
      target_owner_id: "00000000-0000-0000-0000-000000000001",
    });
  });

  it("throws database errors instead of returning a partial ownership result", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("rpc failed") });
    await expect(ownedQuantitiesByFingerprint(["release-a"])).rejects.toThrow("rpc failed");
  });

  it("does not create a client when inputs or database configuration are absent", async () => {
    await expect(ownedQuantitiesByFingerprint([])).resolves.toEqual({});
    expect(createClientMock).not.toHaveBeenCalled();

    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(ownedQuantitiesByFingerprint(["release-a"])).resolves.toEqual({});
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("never sends a provisional fingerprint to collection matching", () => {
    const source = readFileSync(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8");
    expect(source).toContain('item.status === "exact" ? item.aliases : []');
    expect(source).toContain('ownedQuantity: fingerprint.status === "exact"');
    expect(source).not.toContain("item.aliases.length ? item.aliases : [item.key]");
  });
});
