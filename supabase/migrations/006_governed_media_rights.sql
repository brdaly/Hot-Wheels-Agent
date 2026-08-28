begin;

-- Rights evidence remains private. Public records contain only an opaque reference
-- so the application can prove a reviewed permission exists without publishing
-- contracts, emails, personal details, or original source files.
create table if not exists private.media_rights_evidence (
  evidence_ref text primary key
    check (evidence_ref ~ '^rights:[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$'),
  evidence_type text not null check (evidence_type in (
    'ownership_attestation',
    'commissioned_assignment',
    'contributor_license',
    'publisher_permission',
    'official_license',
    'open_license_snapshot'
  )),
  rights_holder text not null check (char_length(btrim(rights_holder)) between 1 and 240),
  storage_bucket text not null default 'hot-wheels-media-evidence'
    check (storage_bucket = 'hot-wheels-media-evidence'),
  object_path text not null
    check (char_length(object_path) between 1 and 1024 and object_path !~ '(^/|(^|/)\.\.(/|$))'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  effective_at timestamptz not null,
  expires_at timestamptz,
  withdrawn_at timestamptz,
  verified_by text not null check (char_length(btrim(verified_by)) between 1 and 240),
  verified_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > effective_at),
  check (expires_at is null or expires_at > verified_at),
  check (withdrawn_at is null or withdrawn_at >= effective_at),
  check (withdrawn_at is null or withdrawn_at >= verified_at)
);
alter table private.media_rights_evidence enable row level security;
revoke all on table private.media_rights_evidence from public, anon, authenticated;
grant select, insert, update on table private.media_rights_evidence to service_role;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete restrict,
  reviewed_release_fingerprint text
    check (
      reviewed_release_fingerprint is null
      or char_length(btrim(reviewed_release_fingerprint)) between 1 and 2048
    ),
  asset_type text not null check (asset_type in (
    'photograph', 'illustration', 'render', 'package_scan'
  )),
  view_type text not null check (view_type in (
    'car_cutout', 'package_front', 'package_back', 'three_quarter',
    'side_profile', 'base_code', 'chase_marker', 'wheel_detail',
    'card_detail', 'other'
  )),
  subject_type text not null check (subject_type in (
    'diecast_vehicle', 'retail_packaging', 'release_marker',
    'combined_vehicle_packaging'
  )),
  identity_status text not null default 'provisional'
    check (identity_status in ('exact', 'provisional', 'disputed')),
  lifecycle_status text not null default 'candidate'
    check (lifecycle_status in (
      'candidate', 'quarantined', 'review_pending', 'approved',
      'expired', 'revoked', 'rejected', 'takedown'
    )),
  rights_basis text not null check (rights_basis in (
    'owned_original', 'commissioned_assignment', 'contributor_license',
    'publisher_permission', 'official_license', 'cc0',
    'cc_by_4_0', 'cc_by_sa_4_0'
  )),
  rights_holder text not null check (char_length(btrim(rights_holder)) between 1 and 240),
  photographer text check (photographer is null or char_length(btrim(photographer)) between 1 and 240),
  permission_evidence_ref text not null
    references private.media_rights_evidence(evidence_ref) on delete restrict,
  source_url text check (source_url is null or source_url ~ '^https://'),
  allowed_transformations text[] not null default '{}'
    check (allowed_transformations <@ array[
      'resize', 'crop', 'background_remove', 'format_convert', 'compress',
      'color_correct', 'generate_thumbnail', 'strip_metadata'
    ]::text[]),
  allowed_channels text[] not null default '{}'
    check (allowed_channels <@ array[
      'public_app', 'public_demo', 'dalyventures_portfolio',
      'internal_review', 'evaluation_fixture'
    ]::text[]),
  attribution_required boolean not null default true,
  attribution_text text,
  license_name text,
  license_url text check (license_url is null or license_url ~ '^https://'),
  territory text not null default 'worldwide'
    check (
      territory = lower(btrim(territory))
      and char_length(territory) between 1 and 120
    ),
  effective_at timestamptz not null,
  expires_at timestamptz,
  takedown_contact text not null check (char_length(btrim(takedown_contact)) between 3 and 320),
  revoked_at timestamptz,
  revocation_reason text,
  reviewed_by text,
  reviewed_at timestamptz,
  rights_review_required_at timestamptz,
  last_approved_at timestamptz,
  last_approved_evidence_ref text
    references private.media_rights_evidence(evidence_ref) on delete restrict,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > effective_at),
  check (expires_at is null or reviewed_at is null or expires_at > reviewed_at),
  check (revoked_at is null or revoked_at >= effective_at),
  check (
    (last_approved_at is null and last_approved_evidence_ref is null)
    or (last_approved_at is not null and last_approved_evidence_ref is not null)
  ),
  check (rights_review_required_at is null or last_approved_at is not null),
  check (
    asset_type <> 'photograph'
    or nullif(btrim(photographer), '') is not null
  ),
  check (
    lifecycle_status <> 'approved'
    or not attribution_required
    or nullif(btrim(attribution_text), '') is not null
  ),
  check (
    lifecycle_status <> 'approved'
    or (
      identity_status = 'exact'
      and nullif(btrim(reviewed_release_fingerprint), '') is not null
      and reviewed_at is not null
      and nullif(btrim(reviewed_by), '') is not null
      and rights_review_required_at is null
      and last_approved_at = reviewed_at
      and last_approved_evidence_ref = permission_evidence_ref
      and revoked_at is null
      and (
        rights_basis not in ('cc0', 'cc_by_4_0', 'cc_by_sa_4_0')
        or (
          source_url is not null
          and nullif(btrim(license_name), '') is not null
          and license_url is not null
        )
      )
      and allowed_channels && array[
        'public_app', 'public_demo', 'dalyventures_portfolio', 'evaluation_fixture'
      ]::text[]
      and territory = 'worldwide'
      and (
        not (allowed_channels && array[
          'public_app', 'public_demo', 'dalyventures_portfolio'
        ]::text[])
        or 'strip_metadata' = any(allowed_transformations)
      )
    )
  ),
  check (
    lifecycle_status not in ('revoked', 'takedown')
    or revoked_at is not null
  )
);
create index if not exists media_assets_release_view_idx
  on public.media_assets(release_id, view_type, lifecycle_status);
create index if not exists media_assets_expiry_idx
  on public.media_assets(expires_at)
  where expires_at is not null;
alter table public.media_assets enable row level security;
revoke all on table public.media_assets from public, anon, authenticated;
grant select, insert, update on table public.media_assets to service_role;

create table if not exists public.media_renditions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.media_assets(id) on delete restrict,
  rendition_type text not null check (rendition_type in (
    'original', 'review_preview', 'grid_320', 'grid_640',
    'detail_1200', 'transparent_cutout', 'package_detail'
  )),
  storage_scope text not null check (storage_scope in (
    'private_original', 'private_working', 'public_derivative'
  )),
  storage_bucket text not null check (storage_bucket in (
    'hot-wheels-media-originals', 'hot-wheels-media-working',
    'hot-wheels-media-public'
  )),
  object_path text not null
    check (char_length(object_path) between 1 and 1024 and object_path !~ '(^/|(^|/)\.\.(/|$))'),
  mime_type text not null check (mime_type in (
    'image/avif', 'image/webp', 'image/png', 'image/jpeg'
  )),
  byte_size bigint not null check (byte_size between 1 and 52428800),
  width integer not null check (width between 1 and 10000),
  height integer not null check (height between 1 and 10000),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  rendition_version integer not null default 1 check (rendition_version > 0),
  transformation_version text not null
    check (char_length(btrim(transformation_version)) between 1 and 120),
  transformations_applied text[] not null default '{}'
    check (transformations_applied <@ array[
      'resize', 'crop', 'background_remove', 'format_convert', 'compress',
      'color_correct', 'generate_thumbnail', 'strip_metadata'
    ]::text[]),
  integrity_status text not null default 'pending'
    check (integrity_status in ('pending', 'verified', 'failed', 'revoked')),
  is_current boolean not null default false,
  supersedes_id uuid references public.media_renditions(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (asset_id, rendition_type, rendition_version),
  unique (storage_bucket, object_path),
  check (not is_current or integrity_status = 'verified'),
  check (
    (rendition_version = 1 and supersedes_id is null)
    or (rendition_version > 1 and supersedes_id is not null)
  ),
  check (
    (storage_scope = 'private_original' and storage_bucket = 'hot-wheels-media-originals')
    or (storage_scope = 'private_working' and storage_bucket = 'hot-wheels-media-working')
    or (storage_scope = 'public_derivative' and storage_bucket = 'hot-wheels-media-public')
  ),
  check (
    storage_scope <> 'public_derivative'
    or (
      rendition_type in ('grid_320', 'grid_640', 'detail_1200', 'transparent_cutout', 'package_detail')
      and cardinality(transformations_applied) > 0
      and 'strip_metadata' = any(transformations_applied)
    )
  )
);
create unique index if not exists media_renditions_one_current_idx
  on public.media_renditions(asset_id, rendition_type)
  where is_current;
create index if not exists media_renditions_public_lookup_idx
  on public.media_renditions(asset_id, rendition_type)
  where storage_scope = 'public_derivative'
    and integrity_status = 'verified'
    and is_current;
alter table public.media_renditions enable row level security;
revoke all on table public.media_renditions from public, anon, authenticated;
grant select, insert, update on table public.media_renditions to service_role;

create table if not exists public.media_requests (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete restrict,
  requested_view_type text not null check (requested_view_type in (
    'car_cutout', 'package_front', 'package_back', 'three_quarter',
    'side_profile', 'base_code', 'chase_marker', 'wheel_detail',
    'card_detail', 'other'
  )),
  requested_subject_type text not null check (requested_subject_type in (
    'diecast_vehicle', 'retail_packaging', 'release_marker',
    'combined_vehicle_packaging'
  )),
  status text not null default 'queued' check (status in (
    'queued', 'human_research', 'permission_requested', 'rights_review',
    'identity_review', 'derivative_processing', 'fulfilled', 'blocked', 'cancelled'
  )),
  acquisition_method text not null check (acquisition_method in (
    'owned_capture', 'commissioned_capture', 'contributor_submission',
    'written_license_request', 'open_license_review'
  )),
  trigger_reason text not null default 'missing_approved_asset'
    check (trigger_reason in (
      'missing_approved_asset', 'expired_asset', 'revoked_asset',
      'new_release', 'quality_upgrade', 'additional_view'
    )),
  priority smallint not null default 50 check (priority between 0 and 100),
  candidate_source_url text check (candidate_source_url is null or candidate_source_url ~ '^https://'),
  candidate_is_reference_only boolean not null default true,
  fulfilled_asset_id uuid references public.media_assets(id) on delete restrict,
  requested_by text not null default 'system'
    check (char_length(btrim(requested_by)) between 1 and 240),
  assigned_to text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (
    status <> 'fulfilled'
    or (fulfilled_asset_id is not null and resolved_at is not null)
  ),
  check (
    status not in ('blocked', 'cancelled')
    or resolved_at is not null
  ),
  check (candidate_source_url is null or candidate_is_reference_only)
);
create unique index if not exists media_requests_one_active_idx
  on public.media_requests(release_id, requested_view_type, requested_subject_type)
  where status in (
    'queued', 'human_research', 'permission_requested', 'rights_review',
    'identity_review', 'derivative_processing'
  );
create index if not exists media_requests_queue_idx
  on public.media_requests(priority desc, created_at asc)
  where status in (
    'queued', 'human_research', 'permission_requested', 'rights_review',
    'identity_review', 'derivative_processing'
  );
alter table public.media_requests enable row level security;
revoke all on table public.media_requests from public, anon, authenticated;
grant select, insert, update on table public.media_requests to service_role;

create table if not exists public.media_audit_events (
  id bigint generated always as identity primary key,
  asset_id uuid references public.media_assets(id) on delete restrict,
  request_id uuid references public.media_requests(id) on delete restrict,
  evidence_ref text references private.media_rights_evidence(evidence_ref) on delete restrict,
  actor text not null check (char_length(btrim(actor)) between 1 and 240),
  action text not null check (action in (
    'asset_created', 'asset_status_changed', 'asset_identity_changed',
    'asset_rights_changed', 'rendition_created', 'rendition_verified',
    'rendition_revoked', 'rendition_integrity_changed',
    'rendition_current_changed', 'request_created',
    'request_status_changed', 'rights_evidence_recorded',
    'rights_evidence_changed', 'rights_evidence_withdrawn', 'takedown_recorded'
  )),
  previous_status text,
  new_status text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (asset_id is not null or request_id is not null or evidence_ref is not null)
);
create index if not exists media_audit_asset_idx
  on public.media_audit_events(asset_id, created_at desc)
  where asset_id is not null;
create index if not exists media_audit_request_idx
  on public.media_audit_events(request_id, created_at desc)
  where request_id is not null;
create index if not exists media_audit_evidence_idx
  on public.media_audit_events(evidence_ref, created_at desc)
  where evidence_ref is not null;
alter table public.media_audit_events enable row level security;
revoke all on table public.media_audit_events from public, anon, authenticated;
grant select, insert on table public.media_audit_events to service_role;
grant usage, select on sequence public.media_audit_events_id_seq to service_role;

-- Audit only governance metadata. Permission files, object paths, hashes, email
-- bodies, notes, and other private evidence contents never enter this snapshot.
create or replace function private.media_rights_evidence_audit_snapshot(
  p_evidence private.media_rights_evidence
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'evidenceType', p_evidence.evidence_type,
    'rightsHolder', p_evidence.rights_holder,
    'effectiveAt', p_evidence.effective_at,
    'expiresAt', p_evidence.expires_at,
    'withdrawnAt', p_evidence.withdrawn_at,
    'verifiedAt', p_evidence.verified_at
  );
$$;
revoke all on function private.media_rights_evidence_audit_snapshot(
  private.media_rights_evidence
) from public, anon, authenticated;

create or replace function private.media_asset_identity_audit_snapshot(
  p_asset public.media_assets
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'releaseId', p_asset.release_id,
    'reviewedReleaseFingerprint', p_asset.reviewed_release_fingerprint,
    'identityStatus', p_asset.identity_status,
    'assetType', p_asset.asset_type,
    'viewType', p_asset.view_type,
    'subjectType', p_asset.subject_type,
    'reviewedBy', p_asset.reviewed_by,
    'reviewedAt', p_asset.reviewed_at,
    'rightsReviewRequiredAt', p_asset.rights_review_required_at,
    'lastApprovedAt', p_asset.last_approved_at,
    'lastApprovedEvidenceRef', p_asset.last_approved_evidence_ref
  );
$$;
revoke all on function private.media_asset_identity_audit_snapshot(
  public.media_assets
) from public, anon, authenticated;

create or replace function private.media_asset_rights_audit_snapshot(
  p_asset public.media_assets
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'rightsBasis', p_asset.rights_basis,
    'rightsHolder', p_asset.rights_holder,
    'photographer', p_asset.photographer,
    'permissionEvidenceRef', p_asset.permission_evidence_ref,
    'sourceUrl', p_asset.source_url,
    'allowedTransformations', p_asset.allowed_transformations,
    'allowedChannels', p_asset.allowed_channels,
    'attributionRequired', p_asset.attribution_required,
    'attributionText', p_asset.attribution_text,
    'licenseName', p_asset.license_name,
    'licenseUrl', p_asset.license_url,
    'territory', p_asset.territory,
    'effectiveAt', p_asset.effective_at,
    'expiresAt', p_asset.expires_at,
    'takedownContact', p_asset.takedown_contact,
    'revokedAt', p_asset.revoked_at,
    'revocationReason', p_asset.revocation_reason
  );
$$;
revoke all on function private.media_asset_rights_audit_snapshot(
  public.media_assets
) from public, anon, authenticated;

create or replace function private.media_rendition_publication_audit_snapshot(
  p_rendition public.media_renditions
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'renditionId', p_rendition.id,
    'assetId', p_rendition.asset_id,
    'renditionType', p_rendition.rendition_type,
    'storageScope', p_rendition.storage_scope,
    'storageBucket', p_rendition.storage_bucket,
    'objectPath', p_rendition.object_path,
    'mimeType', p_rendition.mime_type,
    'byteSize', p_rendition.byte_size,
    'width', p_rendition.width,
    'height', p_rendition.height,
    'sha256', p_rendition.sha256,
    'renditionVersion', p_rendition.rendition_version,
    'transformationVersion', p_rendition.transformation_version,
    'transformationsApplied', p_rendition.transformations_applied,
    'integrityStatus', p_rendition.integrity_status,
    'isCurrent', p_rendition.is_current,
    'supersedesId', p_rendition.supersedes_id
  );
$$;
revoke all on function private.media_rendition_publication_audit_snapshot(
  public.media_renditions
) from public, anon, authenticated;

-- A permission-evidence reference is an immutable version. Changing the file,
-- hash, terms, verifier, verification time, or notes requires a new evidence_ref
-- and a fresh asset review. The only update allowed in place is withdrawal,
-- which is irreversible and immediately fails public lookup closed.
create or replace function private.guard_media_rights_evidence_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.evidence_ref is distinct from new.evidence_ref
    or old.evidence_type is distinct from new.evidence_type
    or old.rights_holder is distinct from new.rights_holder
    or old.storage_bucket is distinct from new.storage_bucket
    or old.object_path is distinct from new.object_path
    or old.sha256 is distinct from new.sha256
    or old.effective_at is distinct from new.effective_at
    or old.expires_at is distinct from new.expires_at
    or old.verified_by is distinct from new.verified_by
    or old.verified_at is distinct from new.verified_at
    or old.notes is distinct from new.notes
    or old.created_at is distinct from new.created_at then
    raise exception 'media_rights_evidence_is_immutable_create_new_version';
  end if;

  if old.withdrawn_at is not null
    and old.withdrawn_at is distinct from new.withdrawn_at then
    raise exception 'media_rights_evidence_withdrawal_is_irreversible';
  end if;

  if old.withdrawn_at is null and new.withdrawn_at is not null
    and new.withdrawn_at > clock_timestamp() then
    raise exception 'media_rights_evidence_withdrawal_cannot_be_future';
  end if;

  return new;
end;
$$;
revoke all on function private.guard_media_rights_evidence_update()
  from public, anon, authenticated;

-- Once an exact asset has been approved, any identity, review, or publication-
-- rights rebinding must first clear the old approval and enter review_pending.
-- A later, separate update supplies fresh evidence/review before reapproval.
create or replace function private.guard_media_asset_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity_or_review_changed boolean;
  v_rights_changed boolean;
  v_non_revocation_rights_changed boolean;
  v_evidence_current boolean;
begin
  if tg_op = 'INSERT' then
    if new.lifecycle_status = 'approved' then
      raise exception 'media_asset_direct_approval_insert_forbidden';
    end if;
    if new.reviewed_release_fingerprint is not null
      or new.reviewed_by is not null
      or new.reviewed_at is not null
      or new.rights_review_required_at is not null
      or new.last_approved_at is not null
      or new.last_approved_evidence_ref is not null then
      raise exception 'media_asset_initial_state_cannot_carry_approval';
    end if;
    return new;
  end if;

  if old.rights_review_required_at is distinct from new.rights_review_required_at
    or old.last_approved_at is distinct from new.last_approved_at
    or old.last_approved_evidence_ref is distinct from new.last_approved_evidence_ref then
    raise exception 'media_asset_review_history_is_system_managed';
  end if;

  v_identity_or_review_changed :=
    private.media_asset_identity_audit_snapshot(old)
      is distinct from private.media_asset_identity_audit_snapshot(new);
  v_rights_changed :=
    private.media_asset_rights_audit_snapshot(old)
      is distinct from private.media_asset_rights_audit_snapshot(new);
  v_non_revocation_rights_changed :=
    old.rights_basis is distinct from new.rights_basis
    or old.rights_holder is distinct from new.rights_holder
    or old.photographer is distinct from new.photographer
    or old.permission_evidence_ref is distinct from new.permission_evidence_ref
    or old.source_url is distinct from new.source_url
    or old.allowed_transformations is distinct from new.allowed_transformations
    or old.allowed_channels is distinct from new.allowed_channels
    or old.attribution_required is distinct from new.attribution_required
    or old.attribution_text is distinct from new.attribution_text
    or old.license_name is distinct from new.license_name
    or old.license_url is distinct from new.license_url
    or old.territory is distinct from new.territory
    or old.effective_at is distinct from new.effective_at
    or old.expires_at is distinct from new.expires_at
    or old.takedown_contact is distinct from new.takedown_contact;

  -- Emergency removal is deliberately narrow: identity/review and all ongoing
  -- publication terms remain unchanged; only revoked_at/reason may change.
  if old.lifecycle_status = 'approved'
    and new.lifecycle_status in ('revoked', 'takedown') then
    if v_identity_or_review_changed
      or new.revoked_at is null
      or new.revoked_at > clock_timestamp()
      or v_non_revocation_rights_changed then
      raise exception 'approved_media_emergency_removal_allows_only_revocation';
    end if;
    new.rights_review_required_at := old.last_approved_at;
    return new;
  end if;

  if old.last_approved_at is not null and v_rights_changed then
    if new.lifecycle_status <> 'review_pending'
      or new.identity_status <> 'provisional'
      or new.reviewed_release_fingerprint is not null
      or new.reviewed_by is not null
      or new.reviewed_at is not null then
      raise exception 'approved_media_rights_requires_review_pending';
    end if;
    if new.permission_evidence_ref = old.last_approved_evidence_ref then
      raise exception 'changed_media_rights_require_new_evidence_ref';
    end if;

    select exists (
      select 1
      from private.media_rights_evidence evidence
      where evidence.evidence_ref = new.permission_evidence_ref
        and evidence.rights_holder = new.rights_holder
        and evidence.evidence_type = case new.rights_basis
          when 'owned_original' then 'ownership_attestation'
          when 'commissioned_assignment' then 'commissioned_assignment'
          when 'contributor_license' then 'contributor_license'
          when 'publisher_permission' then 'publisher_permission'
          when 'official_license' then 'official_license'
          when 'cc0' then 'open_license_snapshot'
          when 'cc_by_4_0' then 'open_license_snapshot'
          when 'cc_by_sa_4_0' then 'open_license_snapshot'
        end
        and evidence.effective_at <= clock_timestamp()
        and evidence.verified_at > old.last_approved_at
        and evidence.verified_at <= clock_timestamp()
        and (evidence.expires_at is null or evidence.expires_at > clock_timestamp())
        and evidence.withdrawn_at is null
    ) into v_evidence_current;
    if not v_evidence_current then
      raise exception 'changed_media_rights_require_fresh_verified_evidence';
    end if;
    new.rights_review_required_at := old.last_approved_at;
  end if;

  if old.lifecycle_status is distinct from new.lifecycle_status
    and new.lifecycle_status = 'review_pending'
    and old.last_approved_at is not null
    and (
      new.identity_status <> 'provisional'
      or new.reviewed_release_fingerprint is not null
      or new.reviewed_by is not null
      or new.reviewed_at is not null
    ) then
    raise exception 'approved_media_review_must_clear_prior_approval';
  end if;

  if old.lifecycle_status = 'approved' and v_identity_or_review_changed
    and new.lifecycle_status <> 'review_pending' then
    raise exception 'approved_media_identity_requires_review_pending';
  end if;

  if old.lifecycle_status is distinct from new.lifecycle_status
    and new.lifecycle_status = 'approved' then
    if old.lifecycle_status <> 'review_pending' then
      raise exception 'media_asset_approval_requires_review_pending';
    end if;
    if new.reviewed_at is null
      or new.reviewed_at <= old.updated_at
      or new.reviewed_at > clock_timestamp() then
      raise exception 'media_asset_approval_requires_fresh_review';
    end if;

    select exists (
      select 1
      from private.media_rights_evidence evidence
      where evidence.evidence_ref = new.permission_evidence_ref
        and evidence.rights_holder = new.rights_holder
        and evidence.evidence_type = case new.rights_basis
          when 'owned_original' then 'ownership_attestation'
          when 'commissioned_assignment' then 'commissioned_assignment'
          when 'contributor_license' then 'contributor_license'
          when 'publisher_permission' then 'publisher_permission'
          when 'official_license' then 'official_license'
          when 'cc0' then 'open_license_snapshot'
          when 'cc_by_4_0' then 'open_license_snapshot'
          when 'cc_by_sa_4_0' then 'open_license_snapshot'
        end
        and evidence.effective_at <= new.reviewed_at
        and evidence.verified_at <= new.reviewed_at
        and evidence.verified_at <= clock_timestamp()
        and (evidence.expires_at is null or evidence.expires_at > new.reviewed_at)
        and evidence.withdrawn_at is null
    ) into v_evidence_current;
    if not v_evidence_current then
      raise exception 'media_asset_approval_requires_current_verified_evidence';
    end if;

    if old.rights_review_required_at is not null and (
      old.last_approved_at is null
      or old.last_approved_evidence_ref is null
      or new.permission_evidence_ref = old.last_approved_evidence_ref
      or not exists (
        select 1
        from private.media_rights_evidence evidence
        where evidence.evidence_ref = new.permission_evidence_ref
          and evidence.verified_at > old.last_approved_at
          and evidence.verified_at <= new.reviewed_at
      )
    ) then
      raise exception 'media_asset_reapproval_requires_replacement_evidence';
    end if;

    new.rights_review_required_at := null;
    new.last_approved_at := new.reviewed_at;
    new.last_approved_evidence_ref := new.permission_evidence_ref;
  end if;

  return new;
end;
$$;
revoke all on function private.guard_media_asset_review()
  from public, anon, authenticated;

-- Verified or current rendition content is immutable. A replacement is a new
-- version linked with supersedes_id. The old current row may only be demoted
-- after that successor verifies, or be revoked and demoted in the same update.
create or replace function private.guard_media_rendition_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_prior boolean;
  v_has_verified_successor boolean;
begin
  if tg_op = 'INSERT' then
    if new.is_current and new.integrity_status <> 'verified' then
      raise exception 'current_media_rendition_must_be_verified';
    end if;

    if new.rendition_version > 1 then
      select exists (
        select 1
        from public.media_renditions prior
        where prior.id = new.supersedes_id
          and prior.asset_id = new.asset_id
          and prior.rendition_type = new.rendition_type
          and prior.rendition_version < new.rendition_version
      ) into v_has_prior;
      if not v_has_prior then
        raise exception 'media_rendition_version_requires_valid_supersedes';
      end if;
    end if;

    return new;
  end if;

  if (old.integrity_status = 'verified' or old.is_current)
    and (
      old.asset_id is distinct from new.asset_id
      or old.rendition_type is distinct from new.rendition_type
      or old.storage_scope is distinct from new.storage_scope
      or old.storage_bucket is distinct from new.storage_bucket
      or old.object_path is distinct from new.object_path
      or old.mime_type is distinct from new.mime_type
      or old.byte_size is distinct from new.byte_size
      or old.width is distinct from new.width
      or old.height is distinct from new.height
      or old.sha256 is distinct from new.sha256
      or old.rendition_version is distinct from new.rendition_version
      or old.transformation_version is distinct from new.transformation_version
      or old.transformations_applied is distinct from new.transformations_applied
      or old.supersedes_id is distinct from new.supersedes_id
      or old.created_at is distinct from new.created_at
    ) then
    raise exception 'verified_media_rendition_is_immutable_use_supersession';
  end if;

  if old.integrity_status = 'verified'
    and new.integrity_status not in ('verified', 'revoked') then
    raise exception 'verified_media_rendition_may_only_be_revoked';
  end if;

  if old.integrity_status = 'revoked'
    and new.integrity_status <> 'revoked' then
    raise exception 'revoked_media_rendition_cannot_be_restored';
  end if;

  if new.integrity_status = 'revoked' and new.is_current then
    raise exception 'revoked_media_rendition_cannot_remain_current';
  end if;

  if old.is_current and not new.is_current and new.integrity_status <> 'revoked' then
    select exists (
      select 1
      from public.media_renditions successor
      where successor.supersedes_id = old.id
        and successor.asset_id = old.asset_id
        and successor.rendition_type = old.rendition_type
        and successor.rendition_version > old.rendition_version
        and successor.integrity_status = 'verified'
    ) into v_has_verified_successor;
    if not v_has_verified_successor then
      raise exception 'current_media_rendition_requires_verified_successor_or_revocation';
    end if;
  end if;

  if not old.is_current and new.is_current then
    if new.integrity_status <> 'verified' then
      raise exception 'current_media_rendition_must_be_verified';
    end if;
    if new.rendition_version > 1 then
      select exists (
        select 1
        from public.media_renditions prior
        where prior.id = new.supersedes_id
          and prior.asset_id = new.asset_id
          and prior.rendition_type = new.rendition_type
          and prior.rendition_version < new.rendition_version
      ) into v_has_prior;
      if not v_has_prior then
        raise exception 'media_rendition_promotion_requires_valid_supersedes';
      end if;
    end if;
  end if;

  return new;
end;
$$;
revoke all on function private.guard_media_rendition_update()
  from public, anon, authenticated;

create or replace function private.media_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    session_user
  );
begin
  if tg_table_name = 'media_rights_evidence' then
    if tg_op = 'INSERT' then
      insert into public.media_audit_events(
        evidence_ref, actor, action, metadata
      ) values (
        new.evidence_ref,
        v_actor,
        'rights_evidence_recorded',
        private.media_rights_evidence_audit_snapshot(new)
      );
    elsif old.evidence_type is distinct from new.evidence_type
      or old.rights_holder is distinct from new.rights_holder
      or old.storage_bucket is distinct from new.storage_bucket
      or old.object_path is distinct from new.object_path
      or old.sha256 is distinct from new.sha256
      or old.effective_at is distinct from new.effective_at
      or old.expires_at is distinct from new.expires_at
      or old.withdrawn_at is distinct from new.withdrawn_at
      or old.verified_by is distinct from new.verified_by
      or old.verified_at is distinct from new.verified_at
      or old.notes is distinct from new.notes then
      insert into public.media_audit_events(
        evidence_ref, actor, action, metadata
      ) values (
        new.evidence_ref,
        v_actor,
        case
          when old.withdrawn_at is null and new.withdrawn_at is not null
            then 'rights_evidence_withdrawn'
          else 'rights_evidence_changed'
        end,
        jsonb_build_object(
          'previous', private.media_rights_evidence_audit_snapshot(old),
          'current', private.media_rights_evidence_audit_snapshot(new),
          'evidenceObjectChanged', (
            old.storage_bucket is distinct from new.storage_bucket
            or old.object_path is distinct from new.object_path
            or old.sha256 is distinct from new.sha256
          ),
          'verifierChanged', old.verified_by is distinct from new.verified_by,
          'notesChanged', old.notes is distinct from new.notes
        )
      );
    end if;
    return new;
  end if;

  if tg_table_name = 'media_assets' then
    if tg_op = 'INSERT' then
      insert into public.media_audit_events(asset_id, actor, action, new_status, metadata)
      values (
        new.id,
        v_actor,
        'asset_created',
        new.lifecycle_status,
        jsonb_build_object(
          'identity', private.media_asset_identity_audit_snapshot(new),
          'rights', private.media_asset_rights_audit_snapshot(new)
        )
      );
    else
      if old.lifecycle_status is distinct from new.lifecycle_status then
        insert into public.media_audit_events(
          asset_id, actor, action, previous_status, new_status, metadata
        ) values (
          new.id,
          v_actor,
          case when new.lifecycle_status = 'takedown'
            then 'takedown_recorded'
            else 'asset_status_changed'
          end,
          old.lifecycle_status,
          new.lifecycle_status,
          jsonb_build_object(
            'identity', private.media_asset_identity_audit_snapshot(new)
          )
        );
      end if;

      -- Identity/review fields are audited independently from lifecycle and
      -- rights fields so compound updates produce every required event.
      if private.media_asset_identity_audit_snapshot(old)
        is distinct from private.media_asset_identity_audit_snapshot(new) then
        insert into public.media_audit_events(
          asset_id, actor, action, previous_status, new_status, metadata
        ) values (
          new.id,
          v_actor,
          'asset_identity_changed',
          old.lifecycle_status,
          new.lifecycle_status,
          jsonb_build_object(
            'previous', private.media_asset_identity_audit_snapshot(old),
            'current', private.media_asset_identity_audit_snapshot(new)
          )
        );
      end if;

      -- This is intentionally independent of lifecycle changes so a single
      -- approval/revocation update cannot hide a simultaneous rights change.
      if private.media_asset_rights_audit_snapshot(old)
        is distinct from private.media_asset_rights_audit_snapshot(new) then
        insert into public.media_audit_events(
          asset_id, actor, action, previous_status, new_status, metadata
        ) values (
          new.id,
          v_actor,
          'asset_rights_changed',
          old.lifecycle_status,
          new.lifecycle_status,
          jsonb_build_object(
            'previous', private.media_asset_rights_audit_snapshot(old),
            'current', private.media_asset_rights_audit_snapshot(new)
          )
        );
      end if;
    end if;
    return new;
  end if;

  if tg_table_name = 'media_requests' then
    if tg_op = 'INSERT' then
      insert into public.media_audit_events(request_id, actor, action, new_status, metadata)
      values (
        new.id,
        v_actor,
        'request_created',
        new.status,
        jsonb_build_object(
          'releaseId', new.release_id,
          'viewType', new.requested_view_type,
          'acquisitionMethod', new.acquisition_method
        )
      );
    elsif old.status is distinct from new.status then
      insert into public.media_audit_events(
        request_id, asset_id, actor, action, previous_status, new_status, metadata
      ) values (
        new.id,
        new.fulfilled_asset_id,
        v_actor,
        'request_status_changed',
        old.status,
        new.status,
        jsonb_build_object('releaseId', new.release_id)
      );
    end if;
    return new;
  end if;

  if tg_table_name = 'media_renditions' then
    if tg_op = 'INSERT' then
      insert into public.media_audit_events(asset_id, actor, action, metadata)
      values (
        new.asset_id,
        v_actor,
        'rendition_created',
        private.media_rendition_publication_audit_snapshot(new)
      );
    else
      if old.integrity_status is distinct from new.integrity_status then
        insert into public.media_audit_events(
          asset_id, actor, action, previous_status, new_status, metadata
        ) values (
          new.asset_id,
          v_actor,
          case
            when new.integrity_status = 'verified' then 'rendition_verified'
            when new.integrity_status = 'revoked' then 'rendition_revoked'
            else 'rendition_integrity_changed'
          end,
          old.integrity_status,
          new.integrity_status,
          jsonb_build_object(
            'previous', private.media_rendition_publication_audit_snapshot(old),
            'current', private.media_rendition_publication_audit_snapshot(new)
          )
        );
      end if;

      -- Current-state changes are a separate publication event even when the
      -- same update also verifies or revokes the rendition.
      if old.is_current is distinct from new.is_current then
        insert into public.media_audit_events(
          asset_id, actor, action, previous_status, new_status, metadata
        ) values (
          new.asset_id,
          v_actor,
          'rendition_current_changed',
          old.is_current::text,
          new.is_current::text,
          jsonb_build_object(
            'previous', private.media_rendition_publication_audit_snapshot(old),
            'current', private.media_rendition_publication_audit_snapshot(new)
          )
        );
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;
revoke all on function private.media_audit_trigger() from public, anon, authenticated;

create or replace function private.set_media_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.set_media_updated_at() from public, anon, authenticated;

drop trigger if exists media_assets_guard_review on public.media_assets;
create trigger media_assets_guard_review
before insert or update on public.media_assets
for each row execute function private.guard_media_asset_review();

drop trigger if exists media_assets_touch_updated_at on public.media_assets;
create trigger media_assets_touch_updated_at
before update on public.media_assets
for each row execute function private.set_media_updated_at();

drop trigger if exists media_requests_touch_updated_at on public.media_requests;
create trigger media_requests_touch_updated_at
before update on public.media_requests
for each row execute function private.set_media_updated_at();

drop trigger if exists media_renditions_guard_immutable on public.media_renditions;
create trigger media_renditions_guard_immutable
before insert or update on public.media_renditions
for each row execute function private.guard_media_rendition_update();

drop trigger if exists media_rights_evidence_guard_immutable
  on private.media_rights_evidence;
create trigger media_rights_evidence_guard_immutable
before update on private.media_rights_evidence
for each row execute function private.guard_media_rights_evidence_update();

drop trigger if exists media_assets_audit on public.media_assets;
create trigger media_assets_audit
after insert or update on public.media_assets
for each row execute function private.media_audit_trigger();

drop trigger if exists media_requests_audit on public.media_requests;
create trigger media_requests_audit
after insert or update on public.media_requests
for each row execute function private.media_audit_trigger();

drop trigger if exists media_renditions_audit on public.media_renditions;
create trigger media_renditions_audit
after insert or update on public.media_renditions
for each row execute function private.media_audit_trigger();

drop trigger if exists media_rights_evidence_audit on private.media_rights_evidence;
create trigger media_rights_evidence_audit
after insert or update on private.media_rights_evidence
for each row execute function private.media_audit_trigger();

-- This is the only anonymous/authenticated media lookup. Direct table reads remain
-- revoked. Every predicate is intentional: absence of exact identity, current
-- permission, public channel authorization, review, or verified derivative
-- returns zero rows and lets the UI fall back to its local placeholder.
create or replace function public.approved_release_media(
  p_release_id uuid,
  p_channel text default 'public_app',
  p_view_type text default null
)
returns table (
  release_id uuid,
  release_fingerprint text,
  asset_id uuid,
  asset_type text,
  view_type text,
  subject_type text,
  rendition_type text,
  storage_bucket text,
  object_path text,
  mime_type text,
  width integer,
  height integer,
  sha256 text,
  rendition_version integer,
  transformation_version text,
  transformations_applied text[],
  attribution_required boolean,
  attribution_text text,
  rights_holder text,
  photographer text,
  license_name text,
  license_url text,
  source_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    asset.release_id,
    release.release_fingerprint,
    asset.id,
    asset.asset_type,
    asset.view_type,
    asset.subject_type,
    rendition.rendition_type,
    rendition.storage_bucket,
    rendition.object_path,
    rendition.mime_type,
    rendition.width,
    rendition.height,
    rendition.sha256,
    rendition.rendition_version,
    rendition.transformation_version,
    rendition.transformations_applied,
    asset.attribution_required,
    asset.attribution_text,
    asset.rights_holder,
    asset.photographer,
    asset.license_name,
    asset.license_url,
    asset.source_url
  from public.media_assets asset
  join public.releases release on release.id = asset.release_id
  join private.media_rights_evidence evidence
    on evidence.evidence_ref = asset.permission_evidence_ref
  join public.media_renditions rendition on rendition.asset_id = asset.id
  where p_release_id is not null
    and asset.release_id = p_release_id
    and p_channel in ('public_app', 'public_demo', 'dalyventures_portfolio')
    and p_channel = any(asset.allowed_channels)
    and (p_view_type is null or p_view_type = asset.view_type)
    and asset.identity_status = 'exact'
    and asset.lifecycle_status = 'approved'
    and release.release_fingerprint is not null
    and asset.reviewed_release_fingerprint = release.release_fingerprint
    and release.verification_status = 'verified'
    and asset.reviewed_at is not null
    and asset.reviewed_at <= now()
    and nullif(btrim(asset.reviewed_by), '') is not null
    and asset.last_approved_at = asset.reviewed_at
    and asset.last_approved_evidence_ref = asset.permission_evidence_ref
    and asset.rights_review_required_at is null
    and asset.effective_at <= now()
    and (asset.expires_at is null or asset.expires_at > now())
    and asset.revoked_at is null
    and asset.rights_holder = evidence.rights_holder
    and evidence.evidence_type = case asset.rights_basis
      when 'owned_original' then 'ownership_attestation'
      when 'commissioned_assignment' then 'commissioned_assignment'
      when 'contributor_license' then 'contributor_license'
      when 'publisher_permission' then 'publisher_permission'
      when 'official_license' then 'official_license'
      when 'cc0' then 'open_license_snapshot'
      when 'cc_by_4_0' then 'open_license_snapshot'
      when 'cc_by_sa_4_0' then 'open_license_snapshot'
    end
    and evidence.effective_at <= now()
    and evidence.verified_at <= now()
    and asset.reviewed_at >= evidence.verified_at
    and asset.territory = 'worldwide'
    and (evidence.expires_at is null or evidence.expires_at > now())
    and evidence.withdrawn_at is null
    and rendition.storage_scope = 'public_derivative'
    and rendition.storage_bucket = 'hot-wheels-media-public'
    and 'strip_metadata' = any(rendition.transformations_applied)
    and rendition.transformations_applied <@ asset.allowed_transformations
    and rendition.integrity_status = 'verified'
    and rendition.is_current
    and (not asset.attribution_required or nullif(btrim(asset.attribution_text), '') is not null)
  order by
    case rendition.rendition_type
      when 'grid_320' then 1
      when 'grid_640' then 2
      when 'transparent_cutout' then 3
      when 'detail_1200' then 4
      when 'package_detail' then 5
      else 9
    end,
    rendition.rendition_version desc;
$$;
revoke all on function public.approved_release_media(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.approved_release_media(uuid, text, text)
  to anon, authenticated, service_role;

commit;
