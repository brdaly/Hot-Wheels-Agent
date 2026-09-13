import { describe, expect, it } from "vitest";
import { collectExpired, formatReport } from "../scripts/governance-freshness.mjs";
import { SOURCE_CATALOG, sourceFreshness } from "../lib/source-registry";
import manifest from "../data/media-manifest.json";

const CATALOG = SOURCE_CATALOG as unknown as { sources: readonly Record<string, unknown>[] };
const MANIFEST = manifest as unknown as Record<string, unknown>;

function at(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

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
    const entry = SOURCE_CATALOG.sources.find((source) => source.freshness.expiresOn === "2026-08-31");
    expect(entry, "fixture assumes an entry expiring 2026-08-31").toBeDefined();

    expect(collectExpired(CATALOG, MANIFEST, at("2026-08-31")).sources.map((s) => s.id)).not.toContain(entry!.id);
    expect(collectExpired(CATALOG, MANIFEST, at("2026-09-01")).sources.map((s) => s.id)).toContain(entry!.id);
  });

  it("counts days overdue from the expiry date", () => {
    const report = collectExpired(CATALOG, MANIFEST, at("2026-09-13"));
    const entry = report.sources.find((source) => source.id === "orange-track-master-2027");
    expect(entry?.expiresOn).toBe("2026-08-31");
    expect(entry?.daysOverdue).toBe(13);
  });

  it("orders the most overdue entry first", () => {
    const report = collectExpired(CATALOG, MANIFEST, at("2026-09-13"));
    const overdue = report.sources.map((source) => source.daysOverdue);
    expect(overdue).toEqual([...overdue].sort((a, b) => b - a));
  });

  it("flags the media manifest at the instant it expires, matching the media gate", () => {
    expect(collectExpired(CATALOG, MANIFEST, new Date("2026-09-03T23:59:59.999Z")).manifest).toBeNull();
    expect(collectExpired(CATALOG, MANIFEST, new Date("2026-09-04T00:00:00.000Z")).manifest).not.toBeNull();
  });

  it("rejects an invalid reference date rather than reporting everything as current", () => {
    expect(() => collectExpired(CATALOG, MANIFEST, new Date("not a date"))).toThrow(RangeError);
  });
});

describe("formatReport", () => {
  it("names every expired source, its page and how far overdue it is", () => {
    const report = formatReport(collectExpired(CATALOG, MANIFEST, at("2026-09-13")));

    for (const source of collectExpired(CATALOG, MANIFEST, at("2026-09-13")).sources) {
      expect(report).toContain(source.id);
      expect(report).toContain(source.url);
    }
    expect(report).toContain("13");
    expect(report).toContain("data/media-manifest.json");
  });

  it("says so plainly when nothing is overdue", () => {
    const report = formatReport(collectExpired(CATALOG, MANIFEST, at("2026-08-28")));
    expect(report).toContain("within their re-review window");
    expect(report).not.toContain("Days overdue");
  });

  it("tells the reader to re-verify rather than re-date", () => {
    const report = formatReport(collectExpired(CATALOG, MANIFEST, at("2026-09-13")));
    expect(report).toContain("re-verify the facts");
    expect(report).toContain("rather than repeatedly pushing the date forward");
  });
});
