import { pseudonymousIdentifier } from "../security";
import { getSupabaseServiceClient } from "./service-client";

export type DistributedRateLimitPolicy = {
  scope: string;
  subject: string;
  capacity: number;
  refillPerSecond: number;
  cost?: number;
};

export type DistributedRateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  available: boolean;
};

type RateLimitRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

type RateLimitRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

function validPolicy(policy: DistributedRateLimitPolicy) {
  return (
    /^[a-z0-9:_-]{1,80}$/i.test(policy.scope) &&
    policy.subject.length > 0 &&
    Number.isInteger(policy.capacity) &&
    policy.capacity > 0 &&
    Number.isFinite(policy.refillPerSecond) &&
    policy.refillPerSecond > 0 &&
    Number.isInteger(policy.cost ?? 1) &&
    (policy.cost ?? 1) > 0 &&
    (policy.cost ?? 1) <= policy.capacity
  );
}

function parseRow(value: unknown): RateLimitRow | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const candidate = row as Partial<RateLimitRow>;
  if (
    typeof candidate.allowed !== "boolean" ||
    !Number.isInteger(candidate.remaining) ||
    !Number.isInteger(candidate.retry_after_seconds)
  ) {
    return null;
  }
  return candidate as RateLimitRow;
}

/**
 * Atomic, cross-instance token bucket. It intentionally fails closed when the
 * database or trust-and-safety configuration is unavailable.
 */
export async function consumeDistributedRateLimit(
  policy: DistributedRateLimitPolicy,
): Promise<DistributedRateLimitResult> {
  if (!validPolicy(policy)) throw new Error("Invalid rate-limit policy");

  try {
    const keyHash = pseudonymousIdentifier(`rate-limit:${policy.scope}:${policy.subject}`).slice(3);
    const client = getSupabaseServiceClient() as unknown as RateLimitRpcClient;
    const { data, error } = await client.rpc("consume_rate_limit", {
      p_scope: policy.scope,
      p_key_hash: keyHash,
      p_capacity: policy.capacity,
      p_refill_per_second: policy.refillPerSecond,
      p_cost: policy.cost ?? 1,
    });
    if (error) throw error;
    const row = parseRow(data);
    if (!row) throw new Error("Rate-limit service returned an invalid result");
    return {
      allowed: row.allowed,
      remaining: Math.max(0, row.remaining),
      retryAfterSeconds: Math.max(0, row.retry_after_seconds),
      available: true,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "rate_limit_unavailable",
        scope: policy.scope,
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
    return { allowed: false, remaining: 0, retryAfterSeconds: 30, available: false };
  }
}
