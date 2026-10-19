export type ExpiredSource = {
  id: string;
  publisher: string;
  url: string;
  purpose: string;
  expiresOn: string;
  cadenceDays: number;
  basis: string;
  daysOverdue: number;
  supportedClaims: readonly string[];
};

export type ExpiredManifest = {
  reviewedAt: string;
  expiresAt: string;
  assetCount: number;
  daysOverdue: number;
};

export type ExpiredAssetRight = {
  assetId: string;
  releaseId: string | null;
  /** Which rights deadline passed: "rights.expiresAt" or "rights.evidenceExpiresAt". */
  field: string;
  expiresAt: string;
  daysOverdue: number;
};

export type StaleRetailSnapshot = {
  /** Repository-relative path, as imported by lib/pricing.ts. */
  file: string;
  /** The import binding in lib/pricing.ts, e.g. "unitedStates" or "ireland". */
  market: string;
  asOf: string;
  ageDays: number;
  ttlDays: number;
  daysOverdue: number;
};

export type ExpiredReport = {
  asOf: string;
  sources: ExpiredSource[];
  manifest: ExpiredManifest | null;
  /** Assets the media gate already refuses, whatever the manifest's own date says. */
  assets: ExpiredAssetRight[];
  /** Snapshots past RETAIL_SNAPSHOT_TTL_DAYS, which dark the price gate for that market. */
  snapshots: StaleRetailSnapshot[];
};

export declare function collectExpired(
  catalog: { sources: readonly Record<string, unknown>[] },
  manifest: Record<string, unknown>,
  asOf: Date,
  snapshots?: readonly { file: string; market: string; asOf: string; ttlDays: number; ageDays: number }[],
): ExpiredReport;

export declare function formatReport(expired: ExpiredReport): string;
