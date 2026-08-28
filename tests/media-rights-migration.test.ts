import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/006_governed_media_rights.sql", import.meta.url),
  "utf8",
);

describe("governed media-rights migration", () => {
  it("requires an exact release FK and keeps direct public reads closed", () => {
    expect(migration).toContain("release_id uuid not null references public.releases(id)");
    expect(migration).toContain("reviewed_release_fingerprint text");
    expect(migration).toContain("asset.identity_status = 'exact'");
    expect(migration).toContain("asset.reviewed_release_fingerprint = release.release_fingerprint");
    expect(migration).toContain("asset.last_approved_at = asset.reviewed_at");
    expect(migration).toContain("asset.last_approved_evidence_ref = asset.permission_evidence_ref");
    expect(migration).toContain("asset.rights_review_required_at is null");
    expect(migration).toContain("release.verification_status = 'verified'");
    expect(migration).toContain("revoke all on table public.media_assets from public, anon, authenticated");
  });

  it("requires current rights and a verified public derivative", () => {
    expect(migration).toContain("evidence.withdrawn_at is null");
    expect(migration).toContain("evidence.verified_at <= now()");
    expect(migration).toContain("asset.reviewed_at >= evidence.verified_at");
    expect(migration).toContain("asset.rights_holder = evidence.rights_holder");
    expect(migration).toContain("asset.revoked_at is null");
    expect(migration).toContain("rendition.storage_scope = 'public_derivative'");
    expect(migration).toContain("'strip_metadata' = any(rendition.transformations_applied)");
    expect(migration).toContain("rendition.transformations_applied <@ asset.allowed_transformations");
    expect(migration).toContain("rendition.integrity_status = 'verified'");
    expect(migration).toContain("rendition.is_current");
    expect(migration).toContain("and asset.territory = 'worldwide'");
  });

  it("blocks regional licenses from approval without claiming geolocation enforcement", () => {
    expect(migration).toContain("territory = lower(btrim(territory))");
    expect(migration).toContain("and territory = 'worldwide'");
    expect(migration).toContain("and asset.territory = 'worldwide'");
  });

  it("provides a private rights record, request queue, and audit trail", () => {
    expect(migration).toContain("private.media_rights_evidence");
    expect(migration).toContain("public.media_requests");
    expect(migration).toContain("public.media_audit_events");
    expect(migration).toContain("candidate_is_reference_only boolean not null default true");
  });

  it("audits evidence identity and governance metadata without private contents", () => {
    expect(migration).toContain("evidence_ref text references private.media_rights_evidence(evidence_ref)");
    expect(migration).toContain("or evidence_ref is not null");
    expect(migration).toContain("'rights_evidence_recorded'");
    expect(migration).toContain("'rights_evidence_changed'");
    expect(migration).toContain("'rights_evidence_withdrawn'");
    expect(migration).toContain("create trigger media_rights_evidence_audit");

    const evidenceSnapshot = migration.slice(
      migration.indexOf("create or replace function private.media_rights_evidence_audit_snapshot"),
      migration.indexOf("create or replace function private.media_asset_rights_audit_snapshot"),
    );
    expect(evidenceSnapshot).toContain("'evidenceType'");
    expect(evidenceSnapshot).toContain("'verifiedAt'");
    expect(evidenceSnapshot).not.toContain("object_path");
    expect(evidenceSnapshot).not.toContain("sha256");
    expect(evidenceSnapshot).not.toContain("notes");
    expect(migration).toContain("old.object_path is distinct from new.object_path");
    expect(migration).toContain("old.sha256 is distinct from new.sha256");
    expect(migration).toContain("'evidenceObjectChanged'");
  });

  it("versions rights evidence immutably and permits only one-way withdrawal", () => {
    const guard = migration.slice(
      migration.indexOf("create or replace function private.guard_media_rights_evidence_update"),
      migration.indexOf("create or replace function private.guard_media_asset_review"),
    );
    for (const field of [
      "evidence_ref", "evidence_type", "rights_holder", "storage_bucket",
      "object_path", "sha256", "effective_at", "expires_at", "verified_by",
      "verified_at", "notes", "created_at",
    ]) expect(guard).toContain(`old.${field} is distinct from new.${field}`);
    expect(guard).toContain("media_rights_evidence_is_immutable_create_new_version");
    expect(guard).toContain("old.withdrawn_at is not null");
    expect(guard).toContain("media_rights_evidence_withdrawal_is_irreversible");
    expect(guard).toContain("new.withdrawn_at > clock_timestamp()");
    expect(migration).toContain("create trigger media_rights_evidence_guard_immutable");
    expect(migration).toContain("before update on private.media_rights_evidence");
  });

  it("audits all rights fields independently of lifecycle changes", () => {
    const rightsSnapshot = migration.slice(
      migration.indexOf("create or replace function private.media_asset_rights_audit_snapshot"),
      migration.indexOf("create or replace function private.media_audit_trigger"),
    );
    for (const field of [
      "rightsBasis", "rightsHolder", "photographer", "permissionEvidenceRef",
      "allowedTransformations", "allowedChannels", "attributionRequired",
      "attributionText", "licenseName", "licenseUrl", "territory",
      "effectiveAt", "expiresAt", "takedownContact", "revokedAt",
      "revocationReason",
    ]) expect(rightsSnapshot).toContain(`'${field}'`);

    expect(migration).toContain("This is intentionally independent of lifecycle changes");
    expect(migration).toContain("private.media_asset_rights_audit_snapshot(old)");
    expect(migration).toContain("private.media_asset_rights_audit_snapshot(new)");
  });

  it("audits identity and review mutations independently and forces fresh re-review", () => {
    const identitySnapshot = migration.slice(
      migration.indexOf("create or replace function private.media_asset_identity_audit_snapshot"),
      migration.indexOf("create or replace function private.media_asset_rights_audit_snapshot"),
    );
    for (const field of [
      "releaseId", "reviewedReleaseFingerprint", "identityStatus", "assetType",
      "viewType", "subjectType", "reviewedBy", "reviewedAt", "rightsReviewRequiredAt",
      "lastApprovedAt", "lastApprovedEvidenceRef",
    ]) expect(identitySnapshot).toContain(`'${field}'`);

    const guard = migration.slice(
      migration.indexOf("create or replace function private.guard_media_asset_review"),
      migration.indexOf("create or replace function private.guard_media_rendition_update"),
    );
    expect(guard).toContain("old.lifecycle_status = 'approved'");
    expect(guard).toContain("new.lifecycle_status <> 'review_pending'");
    expect(guard).toContain("new.reviewed_release_fingerprint is not null");
    expect(guard).toContain("new.reviewed_by is not null");
    expect(guard).toContain("new.reviewed_at is not null");
    expect(guard).toContain("new.identity_status <> 'provisional'");
    expect(guard).toContain("old.lifecycle_status <> 'review_pending'");
    expect(guard).toContain("new.reviewed_at <= old.updated_at");
    expect(guard).toContain("approved_media_identity_requires_review_pending");
    expect(guard).toContain("media_asset_direct_approval_insert_forbidden");
    expect(guard).toContain("v_rights_changed :=");
    expect(guard).toContain("approved_media_rights_requires_review_pending");
    expect(guard).toContain("new.lifecycle_status in ('revoked', 'takedown')");
    expect(guard).toContain("Emergency removal is deliberately narrow");
    expect(guard).toContain("new.rights_review_required_at := old.last_approved_at");
    expect(guard).toContain("evidence.verified_at > old.last_approved_at");
    expect(guard).toContain("media_asset_approval_requires_current_verified_evidence");
    expect(guard).toContain("media_asset_approval_requires_fresh_review");
    expect(migration).toContain("before insert or update on public.media_assets");

    const assetAudit = migration.slice(
      migration.indexOf("if tg_table_name = 'media_assets'"),
      migration.indexOf("if tg_table_name = 'media_requests'"),
    );
    expect(assetAudit).toContain("Identity/review fields are audited independently");
    expect(assetAudit).toContain("'asset_identity_changed'");
    expect(assetAudit).toContain("private.media_asset_identity_audit_snapshot(old)");
    expect(assetAudit).toContain("private.media_asset_identity_audit_snapshot(new)");
  });

  it("closes direct and two-step rights-reset bypasses with satisfiable evidence timing", () => {
    expect(migration).toContain("last_approved_at timestamptz");
    expect(migration).toContain("last_approved_evidence_ref text");

    const guard = migration.slice(
      migration.indexOf("create or replace function private.guard_media_asset_review"),
      migration.indexOf("create or replace function private.guard_media_rendition_update"),
    );
    expect(guard).toContain("old.last_approved_at is not null and v_rights_changed");
    expect(guard).toContain("new.permission_evidence_ref = old.last_approved_evidence_ref");
    expect(guard).toContain("changed_media_rights_require_new_evidence_ref");
    expect(guard).toContain("evidence.verified_at > old.last_approved_at");
    expect(guard).toContain("changed_media_rights_require_fresh_verified_evidence");
    expect(guard).toContain("new.rights_review_required_at := old.last_approved_at");
    expect(guard).not.toContain("new.rights_review_required_at := clock_timestamp()");
    expect(guard).toContain("new.last_approved_at := new.reviewed_at");
    expect(guard).toContain("new.last_approved_evidence_ref := new.permission_evidence_ref");
    expect(guard).toContain("media_asset_review_history_is_system_managed");

    const emergency = guard.slice(
      guard.indexOf("Emergency removal is deliberately narrow"),
      guard.indexOf("if old.last_approved_at is not null and v_rights_changed"),
    );
    expect(emergency).toContain("new.lifecycle_status in ('revoked', 'takedown')");
    expect(emergency).toContain("new.revoked_at is null");
    expect(emergency).toContain("new.revoked_at > clock_timestamp()");
    expect(emergency).toContain("v_non_revocation_rights_changed");
    expect(emergency).toContain("approved_media_emergency_removal_allows_only_revocation");
  });

  it("makes verified/current renditions immutable and audits supersession state", () => {
    expect(migration).toContain("check (not is_current or integrity_status = 'verified')");
    expect(migration).toContain("(rendition_version > 1 and supersedes_id is not null)");

    const renditionSnapshot = migration.slice(
      migration.indexOf("create or replace function private.media_rendition_publication_audit_snapshot"),
      migration.indexOf("create or replace function private.guard_media_asset_review"),
    );
    for (const field of [
      "assetId", "renditionType", "storageScope", "storageBucket", "objectPath",
      "mimeType", "byteSize", "width", "height", "sha256", "renditionVersion",
      "transformationVersion", "transformationsApplied", "integrityStatus",
      "isCurrent", "supersedesId",
    ]) expect(renditionSnapshot).toContain(`'${field}'`);

    const guard = migration.slice(
      migration.indexOf("create or replace function private.guard_media_rendition_update"),
      migration.indexOf("create or replace function private.media_audit_trigger"),
    );
    for (const field of [
      "asset_id", "rendition_type", "storage_scope", "storage_bucket", "object_path",
      "mime_type", "byte_size", "width", "height", "sha256", "rendition_version",
      "transformation_version", "transformations_applied", "supersedes_id",
    ]) expect(guard).toContain(`old.${field} is distinct from new.${field}`);
    expect(guard).toContain("verified_media_rendition_is_immutable_use_supersession");
    expect(guard).toContain("successor.supersedes_id = old.id");
    expect(guard).toContain("successor.integrity_status = 'verified'");
    expect(guard).toContain("current_media_rendition_requires_verified_successor_or_revocation");
    expect(guard).toContain("revoked_media_rendition_cannot_remain_current");
    expect(migration).toContain("create trigger media_renditions_guard_immutable");

    const renditionAudit = migration.slice(
      migration.indexOf("if tg_table_name = 'media_renditions'"),
      migration.indexOf("return new;\nend;", migration.indexOf("if tg_table_name = 'media_renditions'")),
    );
    expect(renditionAudit).toContain("'rendition_revoked'");
    expect(renditionAudit).toContain("'rendition_integrity_changed'");
    expect(renditionAudit).toContain("'rendition_current_changed'");
    expect(renditionAudit).toContain("Current-state changes are a separate publication event");
    expect(renditionAudit).toContain("private.media_rendition_publication_audit_snapshot(old)");
    expect(renditionAudit).toContain("private.media_rendition_publication_audit_snapshot(new)");
  });

  it("enforces metadata stripping and temporal review gates", () => {
    expect(migration).toContain("'strip_metadata' = any(transformations_applied)");
    expect(migration).toContain("asset.reviewed_at <= now()");
    expect(migration).toContain("expires_at is null or expires_at > verified_at");
    expect(migration).toContain("withdrawn_at is null or withdrawn_at >= verified_at");
  });

  it("keeps each media-request trigger reason unique", () => {
    const triggerReasonBlock = migration.slice(
      migration.indexOf("trigger_reason text"),
      migration.indexOf("priority smallint", migration.indexOf("trigger_reason text")),
    );
    for (const reason of [
      "missing_approved_asset", "expired_asset", "revoked_asset",
      "new_release", "quality_upgrade", "additional_view",
    ]) {
      expect(triggerReasonBlock.match(new RegExp(`'${reason}'`, "g"))).toHaveLength(
        reason === "missing_approved_asset" ? 2 : 1,
      );
    }
  });
});
