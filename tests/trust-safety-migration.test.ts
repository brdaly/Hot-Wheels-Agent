import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/003_trust_safety_upgrade.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("trust and safety migration", () => {
  it("keeps privileged functions least-privilege and pins their search paths", () => {
    expect(migration).toContain("security definer\nset search_path = ''");
    expect(migration).toContain("revoke all on function public.consume_rate_limit");
    expect(migration).toContain("to service_role");
  });

  it("uses an atomic bucket and owner-scoped row policies", () => {
    expect(migration).toContain("for update;");
    expect(migration).toContain("owner_id = (select auth.uid())");
    expect(migration).toContain("select private.is_owner()");
  });

  it("defines bounded retention without deleting promoted evaluations", () => {
    expect(migration).toContain("private.purge_expired_trust_safety_data");
    expect(migration).toContain("item.evaluation_id = evaluation.id");
    expect(migration).toContain("interval '7 days'");
  });
});

