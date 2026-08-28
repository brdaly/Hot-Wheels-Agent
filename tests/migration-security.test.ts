import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = (name: string) => readFileSync(
  new URL(`../supabase/migrations/${name}`, import.meta.url),
  "utf8",
).toLowerCase();

describe("database security invariants", () => {
  it("enables RLS for every public decision table in the forward security migration", () => {
    const sql = migration("004_release_evidence_model.sql");
    for (const table of ["sources", "castings", "releases", "evaluations", "collection_items", "market_evidence", "insights"]) {
      expect(sql).toContain(`alter table ${table} enable row level security`);
    }
  });

  it("keeps the current retention default and preserves promoted evaluations", () => {
    expect(migration("003_trust_safety_upgrade.sql")).toContain("interval '30 days'");
    const sql = migration("004_release_evidence_model.sql");
    expect(sql).toContain("item.evaluation_id = evaluation.id");
    expect(sql).toContain("not exists");
  });

  it("restricts distributed analysis lease functions to the service role", () => {
    const sql = migration("005_analysis_concurrency.sql");
    expect(sql).toContain("security definer\nset search_path = ''");
    expect(sql).toContain("grant execute on function public.acquire_analysis_lease");
    expect(sql).toContain("to service_role");
  });

  it("applies release aliases and the v3.1 model default in a forward-only migration", () => {
    const sql = migration("007_release_fingerprint_aliases.sql");
    expect(sql).toContain("alter column model_version set default 'collection-priority-v3.1'");
    expect(sql).toContain("release_fingerprint_aliases");
    expect(sql).toContain("security definer\nset search_path = ''");
    expect(sql).toContain("revoke all on function public.maintain_release_fingerprint()");
    expect(sql).toContain("normalize(coalesce(value, ''), nfkc)");
    expect(sql).toContain("translate(");
    expect(sql).toContain('collate "c"');
    expect(sql).not.toContain("new.tooling :=");
    expect(sql).not.toContain("new.region :=");
    expect(sql).toContain("new.release_fingerprint_aliases := '{}'");
    expect(sql).toContain("create unique index if not exists releases_identity_core_idx");
    expect(sql).toContain("where release_identity_core is not null");
    expect(sql).toContain("create table if not exists public.release_fingerprint_claims");
    expect(sql).toContain("fingerprint text primary key");
    expect(sql).toContain("alter table public.release_fingerprint_claims enable row level security");
    expect(sql).toContain("function public.sync_release_fingerprint_claims");
    expect(sql).toContain("function public.prevent_referenced_casting_rename");
    expect(sql).toContain("before insert or update\non public.releases");
    expect(sql).toContain("release_fingerprint_token(new.tooling) = 'unknown'");
    expect(sql).toContain("release_fingerprint_token(new.product_code) = 'unknown'");
  });

  it("keeps alias-aware quantity aggregation inside the database and service role", () => {
    const sql = migration("007_release_fingerprint_aliases.sql");
    expect(sql).toContain("function public.owned_quantities_by_fingerprints");
    expect(sql).toContain("security invoker\nset search_path = ''");
    expect(sql).toContain("left join public.release_fingerprint_claims claim");
    expect(sql).toContain("claim.fingerprint = requested.fingerprint");
    expect(sql).toContain("item.ownership_status = 'owned'");
    expect(sql).toContain("item.owner_id = target_owner_id");
    expect(sql).toContain("to service_role");
  });
});
