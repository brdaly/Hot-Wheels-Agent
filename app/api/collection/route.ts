import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedOrigin, NO_STORE_HEADERS } from "@/lib/security";
import { consumeDistributedRateLimit } from "@/lib/security/distributed-rate-limit";
import { authenticateOwner, createOwnerDataClient } from "@/lib/security/owner-session";
import { readLimitedJsonBody } from "@/lib/security/request-body";
import { recordAuditEvent } from "@/lib/db";

const MAX_COLLECTION_BODY_BYTES = 8_192;

const Input = z.object({
  release_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(100).default(1),
  ownership_status: z.enum(["observed", "candidate", "owned", "sold", "traded"]),
  package_condition: z.string().trim().max(120).nullable().optional(),
  purchase_price: z.number().nonnegative().max(1_000_000).nullable().optional(),
  purchase_currency: z.enum(["EUR", "USD", "GBP", "CAD", "AUD"]).default("USD"),
  purchase_date: z.string().date().nullable().optional(),
  location: z.string().trim().max(160).nullable().optional(),
  notes: z.string().trim().max(2_000).nullable().optional(),
}).strict();

async function owner(request: NextRequest) {
  const identity = await authenticateOwner(request);
  if (!identity.authenticated) {
    return { identity: null, response: NextResponse.json({ error: "Sign in is required" }, { status: identity.status === 503 ? 503 : 401, headers: NO_STORE_HEADERS }) };
  }
  return { identity, response: null };
}

export async function GET(request: NextRequest) {
  const auth = await owner(request);
  if (!auth.identity) return auth.response;
  const db = createOwnerDataClient(auth.identity);
  const { data, error } = await db.from("collection_items")
    .select("*, releases(*, castings(*))")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error(JSON.stringify({ level: "error", event: "collection_read_failed", error: error.message }));
    return NextResponse.json({ error: "Collection is temporarily unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
  }
  return NextResponse.json({ items: data }, { headers: NO_STORE_HEADERS });
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "Request rejected" }, { status: 403, headers: NO_STORE_HEADERS });
  }
  const auth = await owner(request);
  if (!auth.identity) return auth.response;
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_COLLECTION_BODY_BYTES) {
    return NextResponse.json({ error: "Collection item is too large" }, { status: 413, headers: NO_STORE_HEADERS });
  }
  const rate = await consumeDistributedRateLimit({
    scope: "collection_write",
    subject: auth.identity.userId,
    capacity: 60,
    refillPerSecond: 1,
  });
  if (!rate.available) return NextResponse.json({ error: "Collection updates are temporarily unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
  if (!rate.allowed) return NextResponse.json({ error: "Too many collection updates" }, { status: 429, headers: { ...NO_STORE_HEADERS, "Retry-After": String(rate.retryAfterSeconds) } });

  const body = await readLimitedJsonBody(request, MAX_COLLECTION_BODY_BYTES);
  if (!body.ok && body.reason === "too_large") {
    return NextResponse.json({ error: "Collection item is too large" }, { status: 413, headers: NO_STORE_HEADERS });
  }
  const parsed = Input.safeParse(body.ok ? body.value : null);
  if (!parsed.success) return NextResponse.json({ error: "Invalid collection item" }, { status: 400, headers: NO_STORE_HEADERS });
  const db = createOwnerDataClient(auth.identity);
  const { data, error } = await db.from("collection_items")
    .insert({ ...parsed.data, owner_id: auth.identity.userId })
    .select("id")
    .single();
  if (error) {
    console.error(JSON.stringify({ level: "error", event: "collection_write_failed", error: error.message }));
    return NextResponse.json({ error: "Collection item could not be saved" }, { status: 503, headers: NO_STORE_HEADERS });
  }
  try {
    await recordAuditEvent({
      actor: auth.identity.userId,
      action: "collection_item_created",
      entityType: "collection_item",
      entityId: data.id,
      metadata: { ownershipStatus: parsed.data.ownership_status },
    });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "collection_audit_failed", error: error instanceof Error ? error.message : "unknown" }));
  }
  return NextResponse.json(data, { status: 201, headers: NO_STORE_HEADERS });
}
