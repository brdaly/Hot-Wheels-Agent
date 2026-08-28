import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { approvedMediaFromManifest, approvedMediaForRelease, mediaFallbackRequired } from "../lib/media-manifest";
import { mediaManifestSchema, type MediaManifest } from "../lib/media-schema";

const releaseId = "00000000-0000-4000-8000-000000000001";
const releaseFingerprint = "release-fingerprint-v1|brand:hot-wheels|productCode:abc123";

function fixture(): MediaManifest {
  return mediaManifestSchema.parse({
    schemaVersion: "media-manifest-v1",
    reviewedAt: "2026-08-28T12:00:00.000Z",
    expiresAt: "2026-09-04T00:00:00.000Z",
    governance: {
      publicationMode: "approved_exact_assets_only",
      unavailableAssetAction: "local_placeholder",
      runtimeAcquisition: false,
      remoteImageRelay: false,
      territoryMode: "worldwide_only",
      publicBucket: "hot-wheels-media-public",
    },
    assets: [{
      assetId: "00000000-0000-4000-8000-000000000002",
      releaseId,
      reviewedReleaseFingerprint: releaseFingerprint,
      assetType: "photograph",
      viewType: "car_cutout",
      subjectType: "diecast_vehicle",
      publicationTerritory: "worldwide",
      identityStatus: "exact",
      lifecycleStatus: "approved",
      sourceUrl: null,
      rights: {
        basis: "owned_original",
        rightsHolder: "Test rights holder",
        photographer: "Test photographer",
        evidenceStatus: "verified",
        evidenceVerifiedAt: "2026-08-01T00:00:00.000Z",
        evidenceExpiresAt: null,
        evidenceWithdrawnAt: null,
        allowedTransformations: ["resize", "background_remove", "format_convert", "strip_metadata"],
        allowedChannels: ["public_app"],
        attributionRequired: true,
        attributionText: "Photo © Test rights holder",
        licenseName: null,
        licenseUrl: null,
        effectiveAt: "2026-08-01T00:00:00.000Z",
        expiresAt: null,
        revokedAt: null,
      },
      reviewedBy: "test-reviewer",
      reviewedAt: "2026-08-28T12:00:00.000Z",
      renditions: [{
        renditionId: "00000000-0000-4000-8000-000000000003",
        type: "grid_640",
        bucket: "hot-wheels-media-public",
        objectPath: "release/asset/grid-640-v1.webp",
        mimeType: "image/webp",
        byteSize: 12000,
        width: 640,
        height: 360,
        sha256: "a".repeat(64),
        renditionVersion: 1,
        transformationVersion: "media-transform-v1",
        transformationsApplied: ["resize", "background_remove", "format_convert", "strip_metadata"],
        integrityStatus: "verified",
        current: true,
      }],
    }],
  });
}

describe("governed media manifest", () => {
  it("ships with no unlicensed public assets and requires the placeholder", () => {
    expect(approvedMediaForRelease({ releaseId, releaseFingerprint })).toEqual([]);
    expect(mediaFallbackRequired({ releaseId, releaseFingerprint })).toBe(true);
  });

  it("returns only a current, exact, approved, channel-authorized asset", () => {
    const manifest = fixture();
    const approved = approvedMediaFromManifest(manifest, {
      releaseId,
      releaseFingerprint,
      channel: "public_app",
      viewType: "car_cutout",
      asOf: new Date("2026-08-28T13:00:00.000Z"),
    });
    expect(approved).toHaveLength(1);
    expect(approved[0].releaseFingerprint).toBe(releaseFingerprint);
    expect(approvedMediaFromManifest(manifest, {
      releaseId,
      releaseFingerprint: `${releaseFingerprint}-near-match`,
      asOf: new Date("2026-08-28T13:00:00.000Z"),
    })).toEqual([]);
  });

  it("fails closed after expiry or revocation", () => {
    const expired = fixture();
    expired.assets[0].rights.expiresAt = "2026-08-29T00:00:00.000Z";
    expect(approvedMediaFromManifest(expired, {
      releaseId,
      releaseFingerprint,
      asOf: new Date("2026-08-29T00:00:00.000Z"),
    })).toEqual([]);

    const revoked = fixture();
    revoked.assets[0].rights.revokedAt = "2026-08-30T00:00:00.000Z";
    expect(approvedMediaFromManifest(revoked, {
      releaseId,
      releaseFingerprint,
      asOf: new Date("2026-08-28T00:00:00.000Z"),
    })).toEqual([]);
  });

  it("fails closed when the manifest review or private evidence is stale", () => {
    const staleManifest = fixture();
    expect(approvedMediaFromManifest(staleManifest, {
      releaseId,
      releaseFingerprint,
      asOf: new Date("2026-09-04T00:00:00.000Z"),
    })).toEqual([]);

    const staleEvidence = fixture();
    staleEvidence.assets[0].rights.evidenceExpiresAt = "2026-08-29T00:00:00.000Z";
    expect(approvedMediaFromManifest(staleEvidence, {
      releaseId,
      releaseFingerprint,
      asOf: new Date("2026-08-29T00:00:00.000Z"),
    })).toEqual([]);

    const futureEvidenceReview = fixture();
    futureEvidenceReview.assets[0].rights.evidenceVerifiedAt = "2026-08-30T00:00:00.000Z";
    expect(approvedMediaFromManifest(futureEvidenceReview, {
      releaseId,
      releaseFingerprint,
      asOf: new Date("2026-08-29T00:00:00.000Z"),
    })).toEqual([]);
  });

  it("fails closed when a derivative used an unauthorized transformation", () => {
    const manifest = fixture();
    manifest.assets[0].rights.allowedTransformations = ["resize", "format_convert", "strip_metadata"];
    expect(approvedMediaFromManifest(manifest, {
      releaseId,
      releaseFingerprint,
      asOf: new Date("2026-08-28T13:00:00.000Z"),
    })).toEqual([]);
  });

  it("requires metadata stripping in both schema and resolver", () => {
    const invalidManifest = fixture();
    invalidManifest.assets[0].renditions[0].transformationsApplied = [
      "resize",
      "background_remove",
      "format_convert",
    ];
    expect(approvedMediaFromManifest(invalidManifest, {
      releaseId,
      releaseFingerprint,
      asOf: new Date("2026-08-28T13:00:00.000Z"),
    })).toEqual([]);
    expect(mediaManifestSchema.safeParse(invalidManifest).success).toBe(false);
  });

  it("fails closed for regional media until delivery is territory-aware", () => {
    const regional = fixture();
    regional.assets[0].publicationTerritory = "us-only" as "worldwide";
    expect(approvedMediaFromManifest(regional, {
      releaseId,
      releaseFingerprint,
      asOf: new Date("2026-08-28T13:00:00.000Z"),
    })).toEqual([]);
    expect(mediaManifestSchema.safeParse(regional).success).toBe(false);

    const unsupportedMode = fixture();
    unsupportedMode.governance.territoryMode = "regional" as "worldwide_only";
    expect(approvedMediaFromManifest(unsupportedMode, {
      releaseId,
      releaseFingerprint,
      asOf: new Date("2026-08-28T13:00:00.000Z"),
    })).toEqual([]);
    expect(mediaManifestSchema.safeParse(unsupportedMode).success).toBe(false);
  });

  it("returns a display-safe projection without private rights operations", () => {
    const approved = approvedMediaFromManifest(fixture(), {
      releaseId,
      releaseFingerprint,
      asOf: new Date("2026-08-28T13:00:00.000Z"),
    });
    const serialized = JSON.stringify(approved);
    expect(serialized).not.toContain("permissionEvidenceRef");
    expect(serialized).not.toContain("takedownContact");
    expect(serialized).not.toContain("territory");
    expect(serialized).not.toContain("allowedChannels");
    expect(serialized).not.toContain("allowedTransformations");
    expect(serialized).not.toContain("evidenceVerifiedAt");
  });

  it("rejects private rights-operation fields in the public manifest", () => {
    const shippedManifest = readFileSync(
      new URL("../data/media-manifest.json", import.meta.url),
      "utf8",
    );
    expect(shippedManifest).not.toContain("permissionEvidenceRef");
    expect(shippedManifest).not.toContain("takedownContact");
    expect(shippedManifest).not.toContain('"territory":');
    expect(shippedManifest).toContain('"territoryMode": "worldwide_only"');

    const raw = structuredClone(fixture()) as unknown as Record<string, unknown>;
    const assets = raw.assets as Array<Record<string, unknown>>;
    const rights = assets[0].rights as Record<string, unknown>;
    rights.permissionEvidenceRef = "rights:test-asset-001";
    rights.takedownContact = "private@example.invalid";
    rights.territory = "internal contract term";
    expect(mediaManifestSchema.safeParse(raw).success).toBe(false);
  });

  it("rejects a manifest that records a transformation outside the permission", () => {
    const input = fixture();
    const raw = structuredClone(input) as unknown as Record<string, unknown>;
    const assets = raw.assets as Array<Record<string, unknown>>;
    const rights = assets[0].rights as Record<string, unknown>;
    rights.allowedTransformations = ["resize", "format_convert", "strip_metadata"];
    const parsed = mediaManifestSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => (
        issue.path.join(".") === "assets.0.renditions.0.transformationsApplied.1"
      ))).toBe(true);
    }
  });

  it("rejects an approved asset that requires attribution but has no text", () => {
    const input = fixture();
    const raw = structuredClone(input) as unknown as Record<string, unknown>;
    const assets = raw.assets as Array<Record<string, unknown>>;
    const rights = assets[0].rights as Record<string, unknown>;
    rights.attributionText = null;
    expect(mediaManifestSchema.safeParse(raw).success).toBe(false);
  });
});
