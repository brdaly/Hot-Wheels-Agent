import type { Identification } from "./analysis-schema";

export const RELEASE_FINGERPRINT_VERSION = "release-fingerprint-v1";

const clean = (value: string | number | null | undefined) =>
  value == null
    ? "unknown"
    : String(value).normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";

export function releaseFingerprint(identification: Identification) {
  const fields = {
    brand: identification.brand,
    releaseYear: identification.releaseYear,
    casting: identification.casting,
    tooling: identification.tooling,
    line: identification.line,
    seriesOrMix: identification.seriesOrMix,
    collectorNumber: identification.collectorNumber,
    productCode: identification.productCode,
    colorOrLivery: identification.colorOrLivery,
    chaseStatus: identification.chaseStatus,
    wheelType: identification.wheelType,
    cardType: identification.cardType,
    region: identification.region,
  };
  const missing: string[] = [];
  for (const key of [
    "brand", "releaseYear", "casting", "tooling", "line", "seriesOrMix",
    "colorOrLivery", "wheelType", "cardType", "region",
  ] as const) {
    if (fields[key] == null || String(fields[key]).trim() === "") missing.push(key);
  }
  if (identification.chaseStatus === "unknown") missing.push("chaseStatus");
  if (!identification.productCode && !identification.collectorNumber) missing.push("productCodeOrCollectorNumber");
  const key = [
    RELEASE_FINGERPRINT_VERSION,
    ...Object.entries(fields).map(([name, value]) => `${name}:${clean(value)}`),
  ].join("|");
  return {
    key,
    status: missing.length === 0 ? "exact" as const : "provisional" as const,
    missing: [...new Set(missing)],
  };
}
