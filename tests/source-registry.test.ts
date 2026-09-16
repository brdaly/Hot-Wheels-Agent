import { describe, expect, it } from "vitest";
import { SOURCE_CATALOG, findSourceByUrl, sourceFreshness, sourceMaySupport } from "../lib/source-registry";

const expectedUrls = [
  "https://www.hwtreasure.com/t-hunts/",
  "https://www.hwtreasure.com/complete-sets/",
  "https://www.hwtreasure.com/category/chase-cars/",
  "https://www.hwtreasure.com/treasure-hunt-checklist/",
  "https://www.hwtreasure.com/category/glossary/",
  "https://orangetrackdiecast.com/hot-wheels-casting-database/",
  "https://orangetrackdiecast.com/2026-hot-wheels-master-list-of-all-lines/",
  "https://orangetrackdiecast.com/2027-hot-wheels-master-list-of-all-lines/",
];

describe("collector source registry", () => {
  it("contains exactly the eight reviewed canonical URLs", () => {
    expect(SOURCE_CATALOG.sources.map((source) => source.url).sort()).toEqual([...expectedUrls].sort());
    expect(new Set(SOURCE_CATALOG.sources.map((source) => source.id)).size).toBe(8);
  });

  it("fails closed on attribution, media reuse, wholesale copying, and market value", () => {
    expect(SOURCE_CATALOG.governance.marketValuationEligible).toBe(false);
    for (const source of SOURCE_CATALOG.sources) {
      expect(source.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const retrievedAt = new Date(`${source.retrievedOn}T00:00:00.000Z`);
      const expiresAt = new Date(`${source.freshness.expiresOn}T00:00:00.000Z`);
      expect(retrievedAt.toISOString().slice(0, 10)).toBe(source.retrievedOn);
      expect(expiresAt.toISOString().slice(0, 10)).toBe(source.freshness.expiresOn);
      expect(source.freshness.cadenceDays).toBeGreaterThan(0);
      expect(expiresAt.getTime() - retrievedAt.getTime()).toBe(source.freshness.cadenceDays * 86_400_000);
      expect(source.attribution.required).toBe(true);
      expect(source.mediaPolicy).toBe("source_page_link_only_no_rehosting");
      expect(source.noWholesaleCopy).toBe(true);
      expect(source.prohibitedClaims).toContain("market_valuation");
    }
  });

  it("expires a source review after its inclusive review date", () => {
    const source = findSourceByUrl("https://orangetrackdiecast.com/2027-hot-wheels-master-list-of-all-lines/");
    expect(source).toBeDefined();
    const fixture = {
      ...source!,
      retrievedOn: "2026-08-28",
      freshness: { ...source!.freshness, cadenceDays: 3, expiresOn: "2026-08-31" },
    };
    expect(sourceFreshness(fixture, new Date("2026-08-31T23:59:59.999Z"))).toBe("current");
    expect(sourceFreshness(fixture, new Date("2026-09-01T00:00:00Z"))).toBe("expired");
  });

  it("allows only in-scope claims from a current review", () => {
    const source = findSourceByUrl("https://orangetrackdiecast.com/hot-wheels-casting-database/");
    expect(source).toBeDefined();
    expect(sourceMaySupport(source!, "casting_debut_year", new Date("2026-08-28T00:00:00Z"))).toBe(true);
    expect(sourceMaySupport(source!, "market_valuation", new Date("2026-08-28T00:00:00Z"))).toBe(false);
  });
});
