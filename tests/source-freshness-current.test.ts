import { describe, expect, it } from "vitest";
import { SOURCE_CATALOG, sourceFreshness } from "../lib/source-registry";

describe.skipIf(process.env.CI_SOURCE_REVIEW !== "true")("live source-review deadline", () => {
  it("requires every governed source to be re-reviewed before its expiry", () => {
    const expired = SOURCE_CATALOG.sources
      .filter((source) => sourceFreshness(source) === "expired")
      .map((source) => `${source.id} expired ${source.freshness.expiresOn}`);
    expect(expired, "Re-open, re-verify, and re-date expired source entries before promoting new claims").toEqual([]);
  });
});
