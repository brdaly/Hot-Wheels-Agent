import type { Identification } from "./analysis-schema";

export const RELEASE_FINGERPRINT_VERSION = "release-fingerprint-v2";

export function canonicalReleaseFingerprintToken(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value).normalize("NFKC");
  return normalized
    .replace(/[A-Z]/g, (character) => character.toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

export function hasCanonicalIdentityValue(value: string | number | null | undefined) {
  return canonicalReleaseFingerprintToken(value) !== "unknown";
}

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
    if (!hasCanonicalIdentityValue(fields[key])) missing.push(key);
  }
  if (canonicalReleaseFingerprintToken(identification.brand) !== "hot-wheels") missing.push("brand");
  if (identification.chaseStatus === "unknown") missing.push("chaseStatus");
  if (!hasCanonicalIdentityValue(identification.productCode) && !hasCanonicalIdentityValue(identification.collectorNumber)) {
    missing.push("productCodeOrCollectorNumber");
  }
  const status = missing.length === 0 ? "exact" as const : "provisional" as const;
  const prefix = [RELEASE_FINGERPRINT_VERSION, ...Object.entries(fields).map(([name, value]) => `${name}:${canonicalReleaseFingerprintToken(value)}`)];
  const core = prefix.join("|");
  const identifiers = [
    hasCanonicalIdentityValue(identification.productCode) && `productCode:${canonicalReleaseFingerprintToken(identification.productCode)}`,
    hasCanonicalIdentityValue(identification.collectorNumber) && `collectorNumber:${canonicalReleaseFingerprintToken(identification.collectorNumber)}`,
  ].filter((value): value is string => Boolean(value));
  const aliases = status === "exact"
    ? identifiers.map((identifier) => [...prefix, `identifier:${identifier}`].join("|"))
    : [];
  return {
    core,
    key: aliases[0] ?? [...prefix, "identifier:unknown"].join("|"),
    aliases,
    status,
    missing: [...new Set(missing)],
  };
}
