# Deployment and rollback runbook

## Promotion path

Git branches and deployments are separate states. A branch or pull request receives a
preview deployment; it does not update production. Production changes only when the
tested commit is merged into `main` and the corresponding `main` deployment is ready.
Before opening a pull request, compare with `base: main` and the work branch as
`compare`; reversing those selectors shows everything added to `main` since an old
branch diverged and can make a stale branch look like a large unmerged change.

1. Merge only through a pull request after `npm run check`, dependency audit, migration static checks, and the accessibility smoke test pass.
2. Connect the private GitHub repository to separate preview and production Vercel projects.
3. Create separate preview and production Supabase projects. Apply migrations `001` through `007` in order.
4. Disable public Supabase sign-ups, invite the owner, and complete the owner bootstrap in `SECURITY.md`.
5. Configure environment variables in the hosting platform; do not expose service-role or OpenAI keys to the browser.
6. Deploy preview. Verify `/api/health`, token-protected `/api/ready`, sign-in, one text-only analysis, one valid image analysis, a rejected oversized file, and owner-scoped collection access.
7. Confirm provider budget alerts, Vercel spend controls/WAF, Supabase backups, retention scheduling, logs, and alerting.
8. Promote the tested commit without rebuilding from a different SHA. Then verify the production deployment points to that SHA.

## Required production variables

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (defaults to `gpt-5.6`; pin a model snapshot for formal regression releases when available)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HOTWHEELS_OWNER_USER_ID`
- `HOTWHEELS_SAFETY_ID_SECRET` (independent, at least 32 bytes)
- `HOTWHEELS_READINESS_TOKEN` (independent, high entropy)
- `NEXT_PUBLIC_APP_URL` (exact canonical origin)

Recommended explicit values:

- `PERSIST_ANALYSES=false`
- `ANALYSIS_RETENTION_DAYS=30`
- `HOTWHEELS_HOURLY_ANALYSIS_LIMIT=20`
- `HOTWHEELS_DAILY_ANALYSIS_LIMIT=100`
- `HOTWHEELS_MAX_CONCURRENT_ANALYSES=2`
- `HOTWHEELS_TRUST_PROXY_HEADERS=false` unless a reviewed custom proxy overwrites client-IP headers

Never set `HOTWHEELS_DEV_AUTH_BYPASS=true` in preview, production, or any shared environment.

## Database release checks

- Take a backup before applying migrations to an existing project.
- Apply append-only migrations; do not edit a migration already applied in production.
- Verify RLS is enabled on every public table and that anon requests receive no collection/evaluation data.
- Test the invited owner can read/write only rows with their own `owner_id`.
- Verify the service role alone can consume rate limits and acquire/release analysis leases.
- Verify incomplete releases retain null fingerprints and no alias claims, overlapping exact aliases are rejected, and the service-role quantity RPC returns only the requested owner's exact aliases.
- Confirm the scheduled purge exists, or configure an approved scheduler for `private.purge_expired_trust_safety_data()`.
- Verify direct anon/authenticated reads of `media_assets`, `media_renditions`, `media_requests`, `media_audit_events`, and `private.media_rights_evidence` are denied.
- Verify `approved_release_media(...)` returns zero rows for provisional releases, reviewed/current fingerprint mismatch, future/unverified/expired/withdrawn evidence, regional-only rights, wrong channels, revoked assets, absent metadata stripping, unauthorized transformations, and non-verified derivatives. `worldwide` is the only supported publication territory in v1; this is not geolocation enforcement.
- Verify inserting/updating/withdrawing a rights-evidence record produces an audit event keyed by its opaque reference without copying the evidence path, hash, notes, or contents. Verify one update that changes both lifecycle and rights produces both status and rights-change events.
- Verify an evidence row rejects changes to its reference, type, holder, file path/hash, dates, verifier, verification time, notes, and creation time. The only permitted update is a non-future `withdrawn_at`, and it cannot be cleared or changed later. Corrections require a new evidence row.
- Verify an approved asset cannot change release/fingerprint, identity, asset/view/subject type, reviewer, or review time in place. It must first enter `review_pending`, clear the prior approval, and receive a later fresh review; verify the compound change emits separate status and identity audit events.
- Verify verified/current rendition content cannot change in place. Exercise the supported sequence: insert a higher rendition version with `supersedes_id`, verify it, demote the old current version, then promote the successor. Verify integrity and current-state events are separately audited; revocation must demote a current rendition in the same update.

## Media storage release checks

Create four isolated storage buckets; do not reuse the analysis-upload path:

| Bucket | Required posture |
|---|---|
| `hot-wheels-media-originals` | Private; service role/reviewer only; never sent to public clients |
| `hot-wheels-media-working` | Private; controlled processor only; purge abandoned work |
| `hot-wheels-media-evidence` | Private; service role/reviewer only; contains permission proof, not display media |
| `hot-wheels-media-public` | Public-delivery derivatives only; no listing; serve through the governed application path or short-lived signed URL after approval |

Keep all four buckets private at the storage-policy layer unless a reviewed deployment explicitly chooses immutable public derivative URLs and documents cache/takedown consequences. “Public” in the final bucket name describes the derivative's intended audience, not anonymous storage authorization.

Before adding an asset:

1. Promote the associated `releases` row to `verification_status='verified'` only after exact-release human review, and copy its current fingerprint into the asset's `reviewed_release_fingerprint` as part of approval.
2. Upload rights proof to the evidence bucket and record its SHA-256 in a new `private.media_rights_evidence` version. Never replace the object, hash, term, or verifier under an existing reference; withdraw it and create a new reference instead.
3. Upload the original privately; create a `media_assets` record in `review_pending` state.
4. Produce allowed derivatives only. Strip embedded metadata; record dimensions, byte count, content hash, rendition/transformation version, every transformation actually applied, and the integrity result. Verify `strip_metadata` is present and the complete applied set is a subset of the asset's permitted transformations. Do not edit a verified rendition; create and verify a superseding version instead.
5. Approve only after rights, attribution, identity, term, territory, and takedown details are reviewed. Public approval requires canonical `territory='worldwide'`; leave every regional license in review-only state.
6. Export/update `data/media-manifest.json` from approved records using the sanitized public shape only. Emit only `publicationTerritory: "worldwide"`, never private permission references, takedown contacts, regional contract terms, private paths/hashes, correspondence, or notes. Run the media tests, deploy preview, and confirm unapproved object paths cannot be requested.

When a previously approved asset's permission changes, bind a replacement evidence version whose verification time is later than the recorded last approval, keep/move the asset in `review_pending` with cleared review fields, and complete the fresh review. This applies even when the asset first moved to `review_pending` without changing rights. Updating `verified_at` or any other evidence field in place is intentionally rejected. For emergency removal, change only lifecycle to revoked/takedown plus a current `revoked_at` and optional reason; every other simultaneous rights or identity mutation is rejected.

No deployment step may bulk-ingest third-party webpages or images. Candidate URLs in `media_requests` are reference-only until a human obtains and records sufficient rights.

## Readiness and observability

- `/api/health` should return liveness without configuration detail.
- `/api/ready` requires `Authorization: Bearer <HOTWHEELS_READINESS_TOKEN>` and checks required configuration/database access.
- Record deployment SHA, migration set, score/contract versions, model, and source-catalog retrieval date with each release.
- Alert on provider cost, elevated 429/503 rates, repeated auth failures, readiness failure, and database storage growth.

## Rollback

1. Disable analysis at the platform or remove the OpenAI key if spend/security is at risk.
2. Roll traffic back only to a previously verified deployment SHA that remains behind platform access controls. Do not expose an older build whose analysis route was unauthenticated. If that build's collection API requires `HOTWHEELS_ADMIN_TOKEN`, preserve the legacy secret until a forward-compatible rollback build has been verified.
3. Do not roll a database schema backward destructively. Ship a new forward migration that restores compatibility.
4. Rotate any possibly exposed credential and invalidate owner sessions.
5. Preserve trace IDs, audit/usage records, and deployment logs; do not retain raw user photos.
6. For a media-rights incident, set the asset to `takedown`, record revocation details, remove/block every public derivative, invalidate caches or signed URLs where supported, and verify the placeholder before restoring normal traffic.
7. Document the failure, user impact, correction, and new regression test before re-promotion.
