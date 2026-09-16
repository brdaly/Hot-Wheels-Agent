import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectExpired, formatReport } from "../scripts/governance-freshness.mjs";
import { SOURCE_CATALOG, sourceFreshness } from "../lib/source-registry";
import manifest from "../data/media-manifest.json";

const CATALOG = SOURCE_CATALOG as unknown as { sources: readonly Record<string, unknown>[] };
const MANIFEST = manifest as unknown as Record<string, unknown>;

// Date-specific report expectations belong to fixtures, not the review dates
// in the shipped catalog, which change whenever its sources are re-reviewed.
const REVIEW_CATALOG = {
  sources: [
    {
      id: "orange-track-master-2027",
      publisher: "Orange Track Diecast",
      url: "https://orangetrackdiecast.com/2027-hot-wheels-master-list-of-all-lines/",
      purpose: "Future-year watchlist fixture.",
      freshness: { cadenceDays: 3, expiresOn: "2026-08-31", basis: "Sparse future-year working list." },
      supportedClaims: ["watchlist_candidate"],
    },
    {
      id: "hwtreasure-checklist",
      publisher: "HWtreasure",
      url: "https://www.hwtreasure.com/treasure-hunt-checklist/",
      purpose: "Regular and Super Treasure Hunt checklist fixture.",
      freshness: { cadenceDays: 7, expiresOn: "2026-09-04", basis: "Current-year lists can change." },
      supportedClaims: ["checklist_membership"],
    },
  ],
};
const REVIEW_MANIFEST = {
  reviewedAt: "2026-08-28T00:00:00.000Z",
  expiresAt: "2026-09-04T00:00:00.000Z",
  assets: [],
};

function at(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

describe("governance freshness CLI", () => {
  it("reports overdue and current inputs from a checkout whose path contains spaces", () => {
    const checkout = realpathSync(mkdtempSync(join(tmpdir(), "governance review ")));
    try {
      mkdirSync(join(checkout, "scripts"));
      mkdirSync(join(checkout, "data"));
      const script = join(checkout, "scripts", "governance-freshness.mjs");
      copyFileSync(new URL("../scripts/governance-freshness.mjs", import.meta.url), script);
      writeFileSync(join(checkout, "data", "source-catalog.json"), JSON.stringify(REVIEW_CATALOG));
      writeFileSync(join(checkout, "data", "media-manifest.json"), JSON.stringify(REVIEW_MANIFEST));

      const run = (asOf: string) => spawnSync(process.execPath, [
        script, "--as-of", asOf, "--report", "governance-freshness.md",
      ], { cwd: checkout, encoding: "utf8" });

      const overdue = run("2026-09-14");
      expect(overdue.error).toBeUndefined();
      expect(overdue.status).toBe(1);
      expect(overdue.stderr).toBe("");
      expect(overdue.stdout).toContain("orange-track-master-2027");
      expect(overdue.stdout).toContain("data/media-manifest.json");
      expect(readFileSync(join(checkout, "governance-freshness.md"), "utf8")).toBe(overdue.stdout);

      const current = run("2026-08-28");
      expect(current.error).toBeUndefined();
      expect(current.status).toBe(0);
      expect(current.stderr).toBe("");
      expect(current.stdout).toContain("within their re-review window");
      expect(readFileSync(join(checkout, "governance-freshness.md"), "utf8")).toBe(current.stdout);
    } finally {
      rmSync(checkout, { recursive: true, force: true });
    }
  });
});

describe("collectExpired", () => {
  it("agrees with sourceFreshness on every catalog entry, so the report cannot drift from the gate", () => {
    for (const asOf of ["2026-08-28", "2026-08-31", "2026-09-01", "2026-09-04", "2026-09-05", "2027-01-01"]) {
      const reported = new Set(collectExpired(CATALOG, MANIFEST, at(asOf)).sources.map((source) => source.id));
      const gated = new Set(
        SOURCE_CATALOG.sources
          .filter((source) => sourceFreshness(source, at(asOf)) === "expired")
          .map((source) => source.id),
      );
      expect(reported, `disagreement at ${asOf}`).toEqual(gated);
    }
  });

  it("treats a source as current through the last day of its window", () => {
    const entry = REVIEW_CATALOG.sources.find((source) => source.freshness.expiresOn === "2026-08-31");
    expect(entry, "fixture assumes an entry expiring 2026-08-31").toBeDefined();

    expect(collectExpired(REVIEW_CATALOG, REVIEW_MANIFEST, at("2026-08-31")).sources.map((s) => s.id)).not.toContain(entry!.id);
    expect(collectExpired(REVIEW_CATALOG, REVIEW_MANIFEST, at("2026-09-01")).sources.map((s) => s.id)).toContain(entry!.id);
  });

  it("counts days overdue from the expiry date", () => {
    const report = collectExpired(REVIEW_CATALOG, REVIEW_MANIFEST, at("2026-09-13"));
    const entry = report.sources.find((source) => source.id === "orange-track-master-2027");
    expect(entry?.expiresOn).toBe("2026-08-31");
    expect(entry?.daysOverdue).toBe(13);
  });

  it("orders the most overdue entry first", () => {
    const report = collectExpired(REVIEW_CATALOG, REVIEW_MANIFEST, at("2026-09-13"));
    const overdue = report.sources.map((source) => source.daysOverdue);
    expect(overdue).toEqual([...overdue].sort((a, b) => b - a));
  });

  it("flags the media manifest at the instant it expires, matching the media gate", () => {
    expect(collectExpired(REVIEW_CATALOG, REVIEW_MANIFEST, new Date("2026-09-03T23:59:59.999Z")).manifest).toBeNull();
    expect(collectExpired(REVIEW_CATALOG, REVIEW_MANIFEST, new Date("2026-09-04T00:00:00.000Z")).manifest).not.toBeNull();
  });

  it("rejects an invalid reference date rather than reporting everything as current", () => {
    expect(() => collectExpired(CATALOG, MANIFEST, new Date("not a date"))).toThrow(RangeError);
  });
});

describe("formatReport", () => {
  it("names every expired source, its page and how far overdue it is", () => {
    const report = formatReport(collectExpired(REVIEW_CATALOG, REVIEW_MANIFEST, at("2026-09-13")));

    for (const source of collectExpired(REVIEW_CATALOG, REVIEW_MANIFEST, at("2026-09-13")).sources) {
      expect(report).toContain(source.id);
      expect(report).toContain(source.url);
    }
    expect(report).toContain("13");
    expect(report).toContain("data/media-manifest.json");
  });

  it("says so plainly when nothing is overdue", () => {
    const report = formatReport(collectExpired(REVIEW_CATALOG, REVIEW_MANIFEST, at("2026-08-28")));
    expect(report).toContain("within their re-review window");
    expect(report).not.toContain("Days overdue");
  });

  it("tells the reader to re-verify rather than re-date", () => {
    const report = formatReport(collectExpired(REVIEW_CATALOG, REVIEW_MANIFEST, at("2026-09-13")));
    expect(report).toContain("re-verify the facts");
    expect(report).toContain("rather than repeatedly pushing the date forward");
  });
});

describe("asset rights deadlines", () => {
  const currentCatalog = {
    sources: [
      {
        id: "always-current",
        publisher: "P",
        url: "https://example.test/",
        purpose: "fixture",
        freshness: { cadenceDays: 7, expiresOn: "2099-01-01", basis: "fixture" },
        supportedClaims: [],
      },
    ],
  } as unknown as { sources: readonly Record<string, unknown>[] };

  function manifestWith(assets: unknown[], expiresAt = "2099-01-01T00:00:00.000Z") {
    return {
      reviewedAt: "2026-09-01T00:00:00.000Z",
      expiresAt,
      assets,
    } as unknown as Record<string, unknown>;
  }

  it("flags an asset whose rights expired even while the manifest is current", () => {
    // approvedMediaFromManifest rejects on the asset's own deadlines, so a
    // current manifest is no guarantee its media is still publishable.
    const report = collectExpired(
      currentCatalog,
      manifestWith([{ assetId: "a1", releaseId: "r1", lifecycleStatus: "approved", rights: { expiresAt: "2026-09-10T00:00:00.000Z", evidenceStatus: "verified" } }]),
      at("2026-09-14"),
    );

    expect(report.manifest).toBeNull();
    expect(report.assets).toHaveLength(1);
    expect(report.assets[0]).toMatchObject({ assetId: "a1", field: "rights.expiresAt", daysOverdue: 4 });
  });

  it("flags an expired evidence deadline separately from the rights deadline", () => {
    const report = collectExpired(
      currentCatalog,
      manifestWith([
        {
          assetId: "a2",
          lifecycleStatus: "approved",
          rights: { expiresAt: "2099-01-01T00:00:00.000Z", evidenceExpiresAt: "2026-09-05T00:00:00.000Z", evidenceStatus: "verified" },
        },
      ]),
      at("2026-09-14"),
    );

    expect(report.assets.map((asset) => asset.field)).toEqual(["rights.evidenceExpiresAt"]);
  });

  it("ignores a retired asset, which no re-review could ever clear", () => {
    // approvedMediaFromManifest only serves lifecycleStatus "approved" with
    // unrevoked, unwithdrawn, verified evidence. A taken-down asset is retained
    // on purpose as an audit record and its rights deadline is permanently in
    // the past, so reporting it would wedge the weekly job red with no
    // remediation available. It is already not being served; nothing degrades.
    const retired = [
      { assetId: "gone", lifecycleStatus: "takedown", rights: { expiresAt: "2026-01-01T00:00:00.000Z", revokedAt: "2025-06-01T00:00:00.000Z", evidenceStatus: "verified" } },
      { assetId: "revoked", lifecycleStatus: "revoked", rights: { expiresAt: "2026-01-01T00:00:00.000Z", revokedAt: "2025-06-01T00:00:00.000Z", evidenceStatus: "verified" } },
      { assetId: "withdrawn", lifecycleStatus: "approved", rights: { expiresAt: "2026-01-01T00:00:00.000Z", evidenceWithdrawnAt: "2025-06-01T00:00:00.000Z", evidenceStatus: "verified" } },
      { assetId: "disputed", lifecycleStatus: "approved", rights: { expiresAt: "2026-01-01T00:00:00.000Z", evidenceStatus: "disputed" } },
      { assetId: "pending", lifecycleStatus: "review_pending", rights: { expiresAt: "2026-01-01T00:00:00.000Z", evidenceStatus: "verified" } },
    ];

    const report = collectExpired(currentCatalog, manifestWith(retired), at("2026-09-14"));

    expect(report.assets).toEqual([]);
    expect(formatReport(report)).toContain("within their re-review window");
  });

  it("still flags an approved asset with verified evidence", () => {
    const report = collectExpired(
      currentCatalog,
      manifestWith([
        { assetId: "live", lifecycleStatus: "approved", rights: { expiresAt: "2026-09-10T00:00:00.000Z", evidenceStatus: "verified", revokedAt: null, evidenceWithdrawnAt: null } },
      ]),
      at("2026-09-14"),
    );

    expect(report.assets.map((asset) => asset.assetId)).toEqual(["live"]);
  });

  it("leaves an asset alone while both of its deadlines are ahead", () => {
    const report = collectExpired(
      currentCatalog,
      manifestWith([
        { assetId: "a3", lifecycleStatus: "approved", rights: { expiresAt: "2099-01-01T00:00:00.000Z", evidenceExpiresAt: "2099-01-01T00:00:00.000Z", evidenceStatus: "verified" } },
      ]),
      at("2026-09-14"),
    );

    expect(report.assets).toEqual([]);
  });

  it("reports an expired asset as overdue work rather than reporting all clear", () => {
    const report = collectExpired(
      currentCatalog,
      manifestWith([{ assetId: "a4", lifecycleStatus: "approved", rights: { expiresAt: "2026-09-10T00:00:00.000Z", evidenceStatus: "verified" } }]),
      at("2026-09-14"),
    );

    const rendered = formatReport(report);
    expect(rendered).not.toContain("within their re-review window");
    expect(rendered).toContain("a4");
  });
});

describe("remediation steps", () => {
  const currentCatalog = {
    sources: [
      {
        id: "always-current",
        publisher: "P",
        url: "https://example.test/",
        purpose: "fixture",
        freshness: { cadenceDays: 7, expiresOn: "2099-01-01", basis: "fixture" },
        supportedClaims: [],
      },
    ],
  } as unknown as { sources: readonly Record<string, unknown>[] };

  it("omits source-page instructions when only the manifest expired", () => {
    // Every step used to be about source pages and catalog fields the manifest
    // does not have, so a manifest-only failure gave the operator nothing to do.
    const report = collectExpired(
      currentCatalog,
      { reviewedAt: "2026-08-28T00:00:00.000Z", expiresAt: "2026-09-04T00:00:00.000Z", assets: [] } as unknown as Record<string, unknown>,
      at("2026-09-14"),
    );

    const steps = formatReport(report).split("### To clear this")[1];
    expect(steps).toBeDefined();
    expect(steps).toContain("media-manifest.json");
    expect(steps).not.toMatch(/source page/i);
    expect(steps).not.toContain("cadenceDays");
  });

  it("does not tell the operator to invent a source modification date", () => {
    const steps = formatReport(collectExpired(REVIEW_CATALOG, REVIEW_MANIFEST, at("2026-09-14"))).split("### To clear this")[1];

    expect(steps).toMatch(/only if the page itself shows a new modification date/);
  });
});
