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
});
