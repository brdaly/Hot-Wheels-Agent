import { z } from "zod";

export const mediaAssetTypeSchema = z.enum([
  "photograph",
  "illustration",
  "render",
  "package_scan",
]);

export const mediaViewTypeSchema = z.enum([
  "car_cutout",
  "package_front",
  "package_back",
  "three_quarter",
  "side_profile",
  "base_code",
  "chase_marker",
  "wheel_detail",
  "card_detail",
  "other",
]);

export const mediaSubjectTypeSchema = z.enum([
  "diecast_vehicle",
  "retail_packaging",
  "release_marker",
  "combined_vehicle_packaging",
]);

export const mediaIdentityStatusSchema = z.enum(["exact", "provisional", "disputed"]);

export const mediaLifecycleStatusSchema = z.enum([
  "candidate",
  "quarantined",
  "review_pending",
  "approved",
  "expired",
  "revoked",
  "rejected",
  "takedown",
]);

export const mediaRightsBasisSchema = z.enum([
  "owned_original",
  "commissioned_assignment",
  "contributor_license",
  "publisher_permission",
  "official_license",
  "cc0",
  "cc_by_4_0",
  "cc_by_sa_4_0",
]);

export const mediaTransformationSchema = z.enum([
  "resize",
  "crop",
  "background_remove",
  "format_convert",
  "compress",
  "color_correct",
  "generate_thumbnail",
  "strip_metadata",
]);

export const mediaChannelSchema = z.enum([
  "public_app",
  "public_demo",
  "dalyventures_portfolio",
  "internal_review",
  "evaluation_fixture",
]);

export const publicMediaChannelSchema = z.enum([
  "public_app",
  "public_demo",
  "dalyventures_portfolio",
]);

// V1 has no trusted geolocation/territory-aware delivery boundary. The public
// manifest therefore carries only a coarse global-eligibility marker; private
// contract territory text remains outside this file.
export const mediaPublicationTerritorySchema = z.literal("worldwide");

export const mediaRenditionTypeSchema = z.enum([
  "grid_320",
  "grid_640",
  "detail_1200",
  "transparent_cutout",
  "package_detail",
]);

const httpsUrlSchema = z.string().url().refine((value) => value.startsWith("https://"), {
  message: "Only HTTPS source and license URLs are allowed",
});

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const objectPathSchema = z.string().min(1).max(1024).refine(
  (value) => !value.startsWith("/") && !value.split("/").includes(".."),
  { message: "Storage object paths must be relative and may not traverse directories" },
);

export const publicMediaRenditionSchema = z.object({
  renditionId: z.string().uuid(),
  type: mediaRenditionTypeSchema,
  bucket: z.literal("hot-wheels-media-public"),
  objectPath: objectPathSchema,
  mimeType: z.enum(["image/avif", "image/webp", "image/png", "image/jpeg"]),
  byteSize: z.number().int().min(1).max(52_428_800),
  width: z.number().int().min(1).max(10_000),
  height: z.number().int().min(1).max(10_000),
  sha256: sha256Schema,
  renditionVersion: z.number().int().positive(),
  transformationVersion: z.string().trim().min(1).max(120),
  transformationsApplied: z.array(mediaTransformationSchema).min(1).refine(
    (transformations) => transformations.includes("strip_metadata"),
    { message: "Every public rendition must strip embedded metadata" },
  ),
  integrityStatus: z.literal("verified"),
  current: z.literal(true),
}).strict();

export const mediaRightsSchema = z.object({
  basis: mediaRightsBasisSchema,
  rightsHolder: z.string().trim().min(1).max(240),
  photographer: z.string().trim().min(1).max(240).nullable(),
  evidenceStatus: z.literal("verified"),
  evidenceVerifiedAt: z.string().datetime({ offset: true }),
  evidenceExpiresAt: z.string().datetime({ offset: true }).nullable(),
  evidenceWithdrawnAt: z.string().datetime({ offset: true }).nullable(),
  allowedTransformations: z.array(mediaTransformationSchema),
  allowedChannels: z.array(publicMediaChannelSchema).min(1),
  attributionRequired: z.boolean(),
  attributionText: z.string().trim().min(1).max(500).nullable(),
  licenseName: z.string().trim().min(1).max(240).nullable(),
  licenseUrl: httpsUrlSchema.nullable(),
  effectiveAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  revokedAt: z.string().datetime({ offset: true }).nullable(),
}).strict().superRefine((rights, context) => {
  if (rights.attributionRequired && !rights.attributionText) {
    context.addIssue({
      code: "custom",
      path: ["attributionText"],
      message: "Required attribution must have display text",
    });
  }
  if (rights.expiresAt && Date.parse(rights.expiresAt) <= Date.parse(rights.effectiveAt)) {
    context.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "Rights expiry must follow the effective time",
    });
  }
  if (rights.revokedAt && Date.parse(rights.revokedAt) < Date.parse(rights.effectiveAt)) {
    context.addIssue({
      code: "custom",
      path: ["revokedAt"],
      message: "Rights revocation may not precede the effective time",
    });
  }
  if (
    rights.evidenceExpiresAt
    && Date.parse(rights.evidenceExpiresAt) <= Date.parse(rights.evidenceVerifiedAt)
  ) {
    context.addIssue({
      code: "custom",
      path: ["evidenceExpiresAt"],
      message: "Evidence expiry must follow verification",
    });
  }
  if (
    rights.evidenceWithdrawnAt
    && Date.parse(rights.evidenceWithdrawnAt) < Date.parse(rights.evidenceVerifiedAt)
  ) {
    context.addIssue({
      code: "custom",
      path: ["evidenceWithdrawnAt"],
      message: "Evidence withdrawal may not precede verification",
    });
  }
});

export const mediaManifestAssetSchema = z.object({
  assetId: z.string().uuid(),
  releaseId: z.string().uuid(),
  reviewedReleaseFingerprint: z.string().trim().min(1).max(2048),
  assetType: mediaAssetTypeSchema,
  viewType: mediaViewTypeSchema,
  subjectType: mediaSubjectTypeSchema,
  publicationTerritory: mediaPublicationTerritorySchema,
  identityStatus: mediaIdentityStatusSchema,
  lifecycleStatus: mediaLifecycleStatusSchema,
  sourceUrl: httpsUrlSchema.nullable(),
  rights: mediaRightsSchema,
  reviewedBy: z.string().trim().min(1).max(240),
  reviewedAt: z.string().datetime({ offset: true }),
  renditions: z.array(publicMediaRenditionSchema).min(1),
}).strict().superRefine((asset, context) => {
  asset.renditions.forEach((rendition, renditionIndex) => {
    rendition.transformationsApplied.forEach((transformation, transformationIndex) => {
      if (!asset.rights.allowedTransformations.includes(transformation)) {
        context.addIssue({
          code: "custom",
          path: [
            "renditions",
            renditionIndex,
            "transformationsApplied",
            transformationIndex,
          ],
          message: `Transformation ${transformation} is not allowed by the recorded permission`,
        });
      }
    });
  });
  if (asset.lifecycleStatus === "approved" && asset.identityStatus !== "exact") {
    context.addIssue({
      code: "custom",
      path: ["identityStatus"],
      message: "An approved public asset must identify an exact release",
    });
  }
  if (
    asset.lifecycleStatus === "approved"
    && Date.parse(asset.reviewedAt) < Date.parse(asset.rights.evidenceVerifiedAt)
  ) {
    context.addIssue({
      code: "custom",
      path: ["reviewedAt"],
      message: "Asset approval cannot precede rights-evidence verification",
    });
  }
  if (
    asset.lifecycleStatus === "approved"
    && asset.rights.expiresAt
    && Date.parse(asset.rights.expiresAt) <= Date.parse(asset.reviewedAt)
  ) {
    context.addIssue({
      code: "custom",
      path: ["rights", "expiresAt"],
      message: "Asset approval cannot rely on already-expired rights",
    });
  }
  if (
    asset.lifecycleStatus === "approved"
    && !asset.rights.allowedTransformations.includes("strip_metadata")
  ) {
    context.addIssue({
      code: "custom",
      path: ["rights", "allowedTransformations"],
      message: "Public approval must permit metadata stripping",
    });
  }
  if (asset.lifecycleStatus === "approved" && asset.rights.revokedAt) {
    context.addIssue({
      code: "custom",
      path: ["rights", "revokedAt"],
      message: "A revoked permission cannot remain approved",
    });
  }
  if (asset.lifecycleStatus === "approved" && asset.rights.evidenceWithdrawnAt) {
    context.addIssue({
      code: "custom",
      path: ["rights", "evidenceWithdrawnAt"],
      message: "Withdrawn evidence cannot support an approved asset",
    });
  }
  if (asset.assetType === "photograph" && !asset.rights.photographer) {
    context.addIssue({
      code: "custom",
      path: ["rights", "photographer"],
      message: "A photograph requires a named photographer",
    });
  }
  if (
    asset.lifecycleStatus === "approved"
    && ["cc0", "cc_by_4_0", "cc_by_sa_4_0"].includes(asset.rights.basis)
    && (!asset.sourceUrl || !asset.rights.licenseName || !asset.rights.licenseUrl)
  ) {
    context.addIssue({
      code: "custom",
      path: ["rights", "licenseUrl"],
      message: "Approved open-license media requires source and license metadata",
    });
  }
  if (["revoked", "takedown"].includes(asset.lifecycleStatus) && !asset.rights.revokedAt) {
    context.addIssue({
      code: "custom",
      path: ["rights", "revokedAt"],
      message: "Revoked and takedown assets require a revocation time",
    });
  }
});

export const mediaManifestSchema = z.object({
  schemaVersion: z.literal("media-manifest-v1"),
  reviewedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  governance: z.object({
    publicationMode: z.literal("approved_exact_assets_only"),
    unavailableAssetAction: z.literal("local_placeholder"),
    runtimeAcquisition: z.literal(false),
    remoteImageRelay: z.literal(false),
    territoryMode: z.literal("worldwide_only"),
    publicBucket: z.literal("hot-wheels-media-public"),
  }).strict(),
  assets: z.array(mediaManifestAssetSchema),
}).strict().superRefine((manifest, context) => {
  if (Date.parse(manifest.expiresAt) <= Date.parse(manifest.reviewedAt)) {
    context.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "Manifest expiry must follow review",
    });
  }
});

export type MediaAssetType = z.infer<typeof mediaAssetTypeSchema>;
export type MediaViewType = z.infer<typeof mediaViewTypeSchema>;
export type MediaSubjectType = z.infer<typeof mediaSubjectTypeSchema>;
export type MediaIdentityStatus = z.infer<typeof mediaIdentityStatusSchema>;
export type MediaLifecycleStatus = z.infer<typeof mediaLifecycleStatusSchema>;
export type MediaRightsBasis = z.infer<typeof mediaRightsBasisSchema>;
export type MediaChannel = z.infer<typeof mediaChannelSchema>;
export type PublicMediaChannel = z.infer<typeof publicMediaChannelSchema>;
export type MediaPublicationTerritory = z.infer<typeof mediaPublicationTerritorySchema>;
export type PublicMediaRendition = z.infer<typeof publicMediaRenditionSchema>;
export type MediaManifestAsset = z.infer<typeof mediaManifestAssetSchema>;
export type MediaManifest = z.infer<typeof mediaManifestSchema>;
