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

export type ExpiredReport = {
  asOf: string;
  sources: ExpiredSource[];
  manifest: ExpiredManifest | null;
  /** Assets the media gate already refuses, whatever the manifest's own date says. */
  assets: ExpiredAssetRight[];
};

export declare function collectExpired(
  catalog: { sources: readonly Record<string, unknown>[] },
  manifest: Record<string, unknown>,
  asOf: Date,
): ExpiredReport;

export declare function formatReport(expired: ExpiredReport): string;
