import manifestJson from "../data/media-manifest.json";
import {
  mediaManifestSchema,
  mediaViewTypeSchema,
  publicMediaChannelSchema,
  type MediaManifest,
  type MediaManifestAsset,
  type MediaViewType,
  type PublicMediaRendition,
  type PublicMediaChannel,
} from "./media-schema";

const MEDIA_MANIFEST: MediaManifest = mediaManifestSchema.parse(manifestJson);

function validDate(value: Date): Date {
  if (Number.isNaN(value.getTime())) throw new RangeError("asOf must be a valid date");
  return value;
}

function isCurrent(asset: MediaManifestAsset, asOf: Date): boolean {
  const timestamp = validDate(asOf).getTime();
  const effectiveAt = Date.parse(asset.rights.effectiveAt);
  const evidenceVerifiedAt = Date.parse(asset.rights.evidenceVerifiedAt);
  const reviewedAt = Date.parse(asset.reviewedAt);
  const expiresAt = asset.rights.expiresAt ? Date.parse(asset.rights.expiresAt) : null;
  const evidenceExpiresAt = asset.rights.evidenceExpiresAt
    ? Date.parse(asset.rights.evidenceExpiresAt)
    : null;
  return effectiveAt <= timestamp
    && evidenceVerifiedAt <= timestamp
    && reviewedAt <= timestamp
    && reviewedAt >= evidenceVerifiedAt
    && (expiresAt == null || timestamp < expiresAt)
    && (evidenceExpiresAt == null || timestamp < evidenceExpiresAt)
    && asset.rights.evidenceStatus === "verified"
    && asset.rights.evidenceWithdrawnAt == null
    && asset.rights.revokedAt == null;
}

export type PublicMediaLookup = {
  releaseId: string;
  releaseFingerprint: string;
  channel?: PublicMediaChannel;
  viewType?: MediaViewType;
  asOf?: Date;
};

export type PublicMediaAsset = {
  assetId: string;
  releaseId: string;
  releaseFingerprint: string;
  assetType: MediaManifestAsset["assetType"];
  viewType: MediaManifestAsset["viewType"];
  subjectType: MediaManifestAsset["subjectType"];
  sourceUrl: string | null;
  attribution: {
    required: boolean;
    text: string | null;
    rightsHolder: string;
    photographer: string | null;
    licenseName: string | null;
    licenseUrl: string | null;
  };
  reviewedAt: string;
  renditions: PublicMediaRendition[];
};

function publicProjection(asset: MediaManifestAsset): PublicMediaAsset {
  return {
    assetId: asset.assetId,
    releaseId: asset.releaseId,
    releaseFingerprint: asset.reviewedReleaseFingerprint,
    assetType: asset.assetType,
    viewType: asset.viewType,
    subjectType: asset.subjectType,
    sourceUrl: asset.sourceUrl,
    attribution: {
      required: asset.rights.attributionRequired,
      text: asset.rights.attributionText,
      rightsHolder: asset.rights.rightsHolder,
      photographer: asset.rights.photographer,
      licenseName: asset.rights.licenseName,
      licenseUrl: asset.rights.licenseUrl,
    },
    reviewedAt: asset.reviewedAt,
    renditions: asset.renditions.map((rendition) => ({
      ...rendition,
      transformationsApplied: [...rendition.transformationsApplied],
    })),
  };
}

/**
 * Resolve only pre-reviewed public media. No network lookup or runtime ingestion
 * occurs here. An incomplete, expired, revoked, disputed, or mismatched record
 * returns no asset so callers can use the local placeholder.
 */
export function approvedMediaFromManifest(
  manifest: MediaManifest,
  input: PublicMediaLookup,
): PublicMediaAsset[] {
  const channel = publicMediaChannelSchema.parse(input.channel ?? "public_app");
  const viewType = input.viewType == null ? null : mediaViewTypeSchema.parse(input.viewType);
  const asOf = validDate(input.asOf ?? new Date());

  if (
    manifest.governance.territoryMode !== "worldwide_only"
    || asOf.getTime() < Date.parse(manifest.reviewedAt)
    || asOf.getTime() >= Date.parse(manifest.expiresAt)
  ) return [];

  return manifest.assets.filter((asset) => (
    asset.releaseId === input.releaseId
    && asset.reviewedReleaseFingerprint === input.releaseFingerprint
    && asset.publicationTerritory === "worldwide"
    && asset.identityStatus === "exact"
    && asset.lifecycleStatus === "approved"
    && asset.rights.allowedChannels.includes(channel)
    && isCurrent(asset, asOf)
    && (!asset.rights.attributionRequired || Boolean(asset.rights.attributionText))
    && (viewType == null || asset.viewType === viewType)
    && asset.renditions.every((rendition) => (
      rendition.bucket === manifest.governance.publicBucket
      && rendition.integrityStatus === "verified"
      && rendition.current
      && rendition.transformationsApplied.includes("strip_metadata")
      && rendition.transformationsApplied.every((transformation) => (
        asset.rights.allowedTransformations.includes(transformation)
      ))
    ))
  )).map(publicProjection);
}

export function approvedMediaForRelease(input: PublicMediaLookup): PublicMediaAsset[] {
  return approvedMediaFromManifest(MEDIA_MANIFEST, input);
}

export function mediaFallbackRequired(input: PublicMediaLookup): boolean {
  return approvedMediaForRelease(input).length === 0;
}
