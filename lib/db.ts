import { createClient } from "@supabase/supabase-js";
import type { PhotoAnalysis } from "./analysis-schema";

export const DEFAULT_ANALYSIS_RETENTION_DAYS = 30;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

export function databaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function persistPhotoEvaluation(
  analysis: PhotoAnalysis,
  cars: unknown[],
  metadata: Record<string, unknown>,
  ownerId?: string,
) {
  if (process.env.PERSIST_ANALYSES !== "true") return null;
  const db = adminClient();
  if (!db) return null;
  const retentionDays = Math.min(365, Math.max(1, Number(process.env.ANALYSIS_RETENTION_DAYS) || DEFAULT_ANALYSIS_RETENTION_DAYS));
  const expiresAt = new Date(Date.now() + retentionDays * 86_400_000).toISOString();
  const { data, error } = await db.from("photo_evaluations").insert({
    scene_snapshot: analysis.scene,
    ranked_results: cars,
    proactive_targets: analysis.proactiveTargets,
    limitations: analysis.limitations,
    metadata,
    expires_at: expiresAt,
    owner_id: ownerId ?? null,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function ownedQuantitiesByFingerprint(fingerprints: string[], ownerId?: string) {
  const unique = [...new Set(fingerprints.map((fingerprint) => fingerprint.trim()).filter(Boolean))];
  if (!unique.length) return {} as Record<string, number>;
  const db = adminClient();
  if (!db) return {} as Record<string, number>;
  const { data, error } = await db.rpc("owned_quantities_by_fingerprints", {
    target_fingerprints: unique,
    target_owner_id: ownerId ?? null,
  });
  if (error) throw error;
  const quantities: Record<string, number> = {};
  for (const row of data ?? []) {
    const fingerprint = typeof row?.fingerprint === "string" ? row.fingerprint : "";
    const quantity = Number(row?.quantity ?? 0);
    if (unique.includes(fingerprint) && Number.isSafeInteger(quantity) && quantity > 0) {
      quantities[fingerprint] = quantity;
    }
  }
  return quantities;
}

export async function recordAnalysisUsage(metadata: Record<string, unknown>) {
  const db = adminClient();
  if (!db) return;
  const { error } = await db.from("audit_events").insert({
    actor: "owner-session",
    action: "analysis_completed",
    entity_type: "photo_evaluation",
    metadata,
  });
  if (error) throw error;
}

export async function recordAuditEvent(input: {
  actor: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const db = adminClient();
  if (!db) throw new Error("Database is not configured");
  const { error } = await db.from("audit_events").insert({
    actor: input.actor,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
}

export async function recordModelUsage(input: {
  ownerId: string;
  traceId: string;
  providerRequestId: string | null;
  model: string;
  usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | null;
  latencyMs: number;
  runtime: Record<string, unknown>;
}) {
  const db = adminClient();
  if (!db) return;
  const { error } = await db.from("model_usage_events").insert({
    owner_id: input.ownerId,
    trace_id: input.traceId,
    provider_request_id: input.providerRequestId,
    model: input.model,
    status: "completed",
    input_tokens: input.usage?.input_tokens ?? null,
    output_tokens: input.usage?.output_tokens ?? null,
    total_tokens: input.usage?.total_tokens ?? null,
    latency_ms: Math.max(0, Math.round(input.latencyMs)),
    usage_details: { runtime: input.runtime },
  });
  if (error) throw error;
}

export async function listCollection(limit = 100) {
  const db = adminClient();
  if (!db) return [];
  const { data, error } = await db.from("collection_items")
    .select("*, releases(*, castings(*))")
    .order("created_at", { ascending: false })
    .limit(Math.min(500, Math.max(1, limit)));
  if (error) throw error;
  return data;
}

export async function addCollectionItem(input: Record<string, unknown>) {
  const db = adminClient();
  if (!db) throw new Error("Database is not configured");
  const { data, error } = await db.from("collection_items").insert(input).select("id").single();
  if (error) throw error;
  return data;
}
