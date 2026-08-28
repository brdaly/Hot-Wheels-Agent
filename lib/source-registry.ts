import catalog from "../data/source-catalog.json";

export const SOURCE_CATALOG = catalog;
export type SourceRecord = (typeof SOURCE_CATALOG.sources)[number];
export type SourceClaim =
  | SourceRecord["supportedClaims"][number]
  | SourceRecord["prohibitedClaims"][number];
export type SourceFreshness = "current" | "expired";

function isoDate(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new RangeError("asOf must be a valid date");
  return value.toISOString().slice(0, 10);
}

export function sourceFreshness(source: SourceRecord, asOf = new Date()): SourceFreshness {
  return isoDate(asOf) <= source.freshness.expiresOn ? "current" : "expired";
}

export function findSourceByUrl(url: string): SourceRecord | undefined {
  return SOURCE_CATALOG.sources.find((source) => source.url === url);
}

export function sourceMaySupport(source: SourceRecord, claim: SourceClaim, asOf = new Date()): boolean {
  return (
    sourceFreshness(source, asOf) === "current" &&
    (source.supportedClaims as readonly string[]).includes(claim)
  );
}
