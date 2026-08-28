import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

type RateBucket = { count: number; reset: number };

const buckets = new Map<string, RateBucket>();
const MAX_LOCAL_BUCKETS = 10_000;
let localRateLimitCalls = 0;

function pruneLocalBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.reset <= now) buckets.delete(key);
  }
}

/**
 * Development fallback only. Production billable routes should use the
 * Supabase-backed limiter in lib/security/distributed-rate-limit.ts.
 */
export function rateLimit(key: string, limit = 12, windowMs = 60_000) {
  const now = Date.now();
  localRateLimitCalls += 1;
  if (localRateLimitCalls % 256 === 0) pruneLocalBuckets(now);

  const current = buckets.get(key);
  if (!current || current.reset <= now) {
    if (!current && buckets.size >= MAX_LOCAL_BUCKETS) {
      pruneLocalBuckets(now);
      if (buckets.size >= MAX_LOCAL_BUCKETS) return { allowed: false, remaining: 0 };
    }
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1) };
  }

  current.count += 1;
  return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count) };
}

export function isSupportedImage(bytes: Buffer, claimed: string) {
  const hex = bytes.subarray(0, 12).toString("hex");
  return (
    (claimed === "image/jpeg" && hex.startsWith("ffd8ff")) ||
    (claimed === "image/png" && hex.startsWith("89504e470d0a1a0a")) ||
    (claimed === "image/webp" &&
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP")
  );
}

export function bearerToken(value: string | null) {
  const match = value?.match(/^Bearer ([!-~]+)$/i);
  const token = match?.[1] ?? null;
  return token && token.length <= 4_096 ? token : null;
}

export function hasExpectedBearerToken(value: string | null, expected: string | undefined) {
  const supplied = bearerToken(value);
  if (!expected || !supplied) return false;
  const actualDigest = createHash("sha256").update(supplied).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export function hasReadinessToken(value: string | null) {
  return hasExpectedBearerToken(value, process.env.HOTWHEELS_READINESS_TOKEN);
}

function firstValidIp(value: string | null) {
  const candidate = value?.split(",", 1)[0]?.trim() ?? "";
  return isIP(candidate) ? candidate : null;
}

/** Trust Vercel's protected header in production; custom proxies must opt in. */
export function trustedClientIp(headers: Pick<Headers, "get">) {
  if (process.env.VERCEL === "1") {
    return firstValidIp(headers.get("x-vercel-forwarded-for")) ?? "unknown";
  }
  if (process.env.HOTWHEELS_TRUST_PROXY_HEADERS === "true") {
    return (
      firstValidIp(headers.get("x-forwarded-for")) ??
      firstValidIp(headers.get("x-real-ip")) ??
      "unknown"
    );
  }
  return process.env.NODE_ENV === "development" ? "127.0.0.1" : "unknown";
}

export function pseudonymousIdentifier(subject: string, secret = process.env.HOTWHEELS_SAFETY_ID_SECRET) {
  if (!secret || secret.length < 32) throw new Error("Trust and safety is not configured");
  return `hw_${createHmac("sha256", secret).update(subject).digest("base64url")}`;
}

export function isAllowedOrigin(requestUrl: string, origin: string | null) {
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    const expected = new URL(process.env.NEXT_PUBLIC_APP_URL ?? requestUrl).origin;
    return new URL(origin).origin === expected;
  } catch {
    return false;
  }
}

export const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
} as const;
