import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bearerToken,
  hasExpectedBearerToken,
  isAllowedOrigin,
  isSupportedImage,
  pseudonymousIdentifier,
  trustedClientIp,
} from "../lib/security";
import { consumeDistributedRateLimit } from "../lib/security/distributed-rate-limit";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...originalEnv };
});

describe("bearer authentication", () => {
  it("requires an explicit bearer scheme and accepts case-insensitive schemes", () => {
    expect(bearerToken("secret-token")).toBeNull();
    expect(bearerToken("Basic secret-token")).toBeNull();
    expect(bearerToken("bearer secret-token")).toBe("secret-token");
    expect(bearerToken("Bearer secret token")).toBeNull();
    expect(bearerToken(`Bearer ${"a".repeat(4_097)}`)).toBeNull();
  });

  it("compares only a complete bearer token", () => {
    expect(hasExpectedBearerToken("Bearer correct", "correct")).toBe(true);
    expect(hasExpectedBearerToken("correct", "correct")).toBe(false);
    expect(hasExpectedBearerToken("Bearer incorrect", "correct")).toBe(false);
  });
});

describe("image signatures", () => {
  it("requires the claimed MIME type to match the magic bytes", () => {
    const jpeg = Buffer.from("ffd8ffe000104a464946", "hex");
    const png = Buffer.from("89504e470d0a1a0a00000000", "hex");
    expect(isSupportedImage(jpeg, "image/jpeg")).toBe(true);
    expect(isSupportedImage(jpeg, "image/png")).toBe(false);
    expect(isSupportedImage(png, "image/png")).toBe(true);
  });
});

describe("request identity", () => {
  it("uses Vercel's protected forwarding header on Vercel", () => {
    process.env.VERCEL = "1";
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.9",
      "x-vercel-forwarded-for": "198.51.100.7",
    });
    expect(trustedClientIp(headers)).toBe("198.51.100.7");
  });

  it("does not trust proxy headers without an explicit deployment boundary", () => {
    delete process.env.VERCEL;
    delete process.env.HOTWHEELS_TRUST_PROXY_HEADERS;
    vi.stubEnv("NODE_ENV", "production");
    expect(trustedClientIp(new Headers({ "x-forwarded-for": "203.0.113.9" }))).toBe("unknown");
  });

  it("creates a stable non-reversible provider identifier", () => {
    const secret = "a".repeat(32);
    const first = pseudonymousIdentifier("owner:123", secret);
    expect(first).toBe(pseudonymousIdentifier("owner:123", secret));
    expect(first).not.toContain("owner:123");
    expect(first.length).toBeLessThanOrEqual(64);
  });
});

describe("origin checks", () => {
  it("matches the configured origin exactly", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://hotwheels.example";
    expect(isAllowedOrigin("https://hotwheels.example/api/session", "https://hotwheels.example")).toBe(true);
    expect(isAllowedOrigin("https://hotwheels.example/api/session", "https://evil.example")).toBe(false);
  });
});

describe("distributed limiter contract", () => {
  it("rejects an invalid policy before contacting the database", async () => {
    await expect(
      consumeDistributedRateLimit({
        scope: "analyze:user",
        subject: "owner-1",
        capacity: 0,
        refillPerSecond: 1,
      }),
    ).rejects.toThrow("Invalid rate-limit policy");
  });
});
