import { pseudonymousIdentifier } from "../security";
import { getSupabaseServiceClient } from "./service-client";

type LeaseResult = { acquired: boolean; leaseId: string | null; available: boolean };
type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function acquireAnalysisLease(subject: string, maximum = 2): Promise<LeaseResult> {
  try {
    const subjectHash = pseudonymousIdentifier(`analysis-lease:${subject}`).slice(3);
    const client = getSupabaseServiceClient() as unknown as RpcClient;
    const { data, error } = await client.rpc("acquire_analysis_lease", {
      p_subject_hash: subjectHash,
      p_maximum: maximum,
      p_ttl_seconds: 120,
    });
    if (error) throw error;
    const leaseId = typeof data === "string" ? data : null;
    return { acquired: Boolean(leaseId), leaseId, available: true };
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "analysis_lease_unavailable",
      error: error instanceof Error ? error.message : "unknown",
    }));
    return { acquired: false, leaseId: null, available: false };
  }
}

export async function releaseAnalysisLease(leaseId: string | null) {
  if (!leaseId) return;
  try {
    const client = getSupabaseServiceClient() as unknown as RpcClient;
    const { error } = await client.rpc("release_analysis_lease", { p_lease_id: leaseId });
    if (error) throw error;
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "analysis_lease_release_failed",
      error: error instanceof Error ? error.message : "unknown",
    }));
  }
}
