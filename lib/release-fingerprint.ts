import type { Identification } from "./analysis-schema";

export const RELEASE_FINGERPRINT_VERSION = "release-fingerprint-v2";

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
  const prefix = [RELEASE_FINGERPRINT_VERSION, ...Object.entries(fields).map(([name, value]) => `${name}:${clean(value)}`)];
  const identifiers = [
    identification.productCode && `productCode:${clean(identification.productCode)}`,
    identification.collectorNumber && `collectorNumber:${clean(identification.collectorNumber)}`,
  ].filter((value): value is string => Boolean(value));
  const aliases = identifiers.map((identifier) => [...prefix, `identifier:${identifier}`].join("|"));
  return {
    key: aliases[0] ?? [...prefix, "identifier:unknown"].join("|"),
    aliases,
    status: missing.length === 0 ? "exact" as const : "provisional" as const,
    missing: [...new Set(missing)],
  };
}
