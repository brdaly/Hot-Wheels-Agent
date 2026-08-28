# Architecture

The current system is a modular monolith with two deliberately separate experiences: a public, precomputed rules demo that performs no upload, model call, or collection access; and an owner-only live workspace. The Next.js application owns the interface and API, OpenAI supplies bounded visual observations only inside the authenticated workspace, and Supabase supplies authentication, row-level-security persistence, quotas, leases, audit history, and governed media records. The core decision is recorded in [ADR-0001](adr/0001-evidence-governed-owner-architecture.md); the media publication boundary is recorded in [ADR-0002](adr/0002-governed-release-media.md).

## Trust boundaries

1. **Browser to application:** same-origin requests, owner session, request-size/type checks, and no-store responses.
2. **Application to OpenAI:** normalized images, pseudonymous safety identifier, strict schema, bounded tokens, `store: false`, and no acceptance of model-generated market comps.
3. **Application to Supabase:** owner access token for collection reads/writes under RLS; service role only for privileged quota, lease, usage, retention, and audit operations.
4. **Application to collector sources:** versioned derived facts and outbound attributed links only. No live scraping or image relay occurs in a user request.
5. **Application to governed media storage:** private originals, working files, and permission evidence are service-role-only. Public-delivery derivatives are addressable only after the fail-closed media query confirms exact release, current rights, approved channel, attribution, review, and file integrity.

## Analysis sequence

1. Authenticate the configured owner and enforce exact-origin, hourly, daily, and concurrency limits.
2. Reject oversized or unsupported requests before any billable operation.
3. Decode, reorient, resize, re-encode, and strip metadata from each image.
4. Ask the model for strict observations: visible identity fields, chase cues, condition, named collection features, uncertainty, and verification gaps.
5. Parse with the bounded `photo-analysis-v3.1` contract.
6. Remove all model-stage sold-comparable claims at the application boundary.
7. Build `release-fingerprint-v2`; incomplete identity remains provisional and does not merge.
8. Cross-check eligible 2026 chase candidates against the dated item map and governed sources.
9. Compute Collection Priority Score v3.1, independent evidence grades, price gate, condition gate, and duplicate-aware recommendation.
10. Return a no-store result. Persist only when `PERSIST_ANALYSES=true`, with expiry and owner identity.

## Responsibility split

| Concern | Model | Deterministic application | Human owner |
|---|---:|---:|---:|
| Read visible package/car evidence | Yes | Validates shape | Reviews |
| Suggest candidate identity | Yes | Fingerprints and gates | Confirms |
| Verify chase status | No | Cross-checks evidence; can only remain candidate until complete | Promotes |
| Calculate score/tier | No | Yes | Can change policy by versioned code change |
| Supply completed-sale evidence | No | Authorized provider only | Reviews comparability |
| Mark owned or increment quantity | No | Enforces owner/RLS rules | Explicitly confirms |

## Data model

- `castings` describe tooling candidates; names alone are not unique identity.
- `releases` add year, line, mix, code, color, wheels, chase, card, and region. Unknown legacy fields remain null and provisional. Exact rows use a canonical identifier-independent core, while a globally unique alias-claim registry binds product-code and collector-number fingerprints to one release.
- `photo_evaluations` are expiring analysis snapshots, not inventory truth.
- `collection_items` are owner-scoped quantities/status and may reference a verified release/evaluation.
- `market_evidence` stores transaction evidence with exact/near/unknown match quality.
- `sources` store authority, verification, retrieval/effective/expiry dates, and content hash.
- `media_assets` bind one governed visual to one exact release, pin the fingerprint reviewed by the human approver, and record view/subject type, identity and lifecycle state, rights holder, photographer, permission reference, allowed channels/transformations, attribution, territory, term, review, and takedown/revocation state. Direct approved insertion is rejected. System-managed last-approval time/evidence fields persist across later states, so both direct and two-step permission changes require `review_pending`, cleared review fields, a different evidence version verified after the last approval, and fresh review. Emergency revoked/takedown transitions may change only revocation timestamp/reason.
- `media_renditions` version private originals/working files and public-delivery derivatives with dimensions, MIME type, byte count, SHA-256, transformation version, and every applied transformation. Every public derivative must record `strip_metadata` and remain within the asset's permitted transformation set. Verified/current publication content is immutable; replacement inserts a higher version with `supersedes_id`, verifies it, demotes the old current row, and then promotes the successor. Revocation must demote a current row in the same update.
- `private.media_rights_evidence` stores opaque, access-controlled, append-only proof versions; contracts, permission emails, releases, and personal details never enter the public manifest. File identity, terms, verifier, verification time, and notes cannot change under an existing reference. Only one-way withdrawal is allowed; any correction creates a new reference and triggers fresh asset review.
- `media_requests` queues missing, expired, revoked, or additional views for human research and permission review. Candidate URLs remain non-displayed references and are never automatic ingestion inputs.
- `media_audit_events` appends creation, approval, identity/review, rights, evidence, rendition-integrity/current/supersession, request, and takedown transitions. Identity, rights, and lifecycle comparisons run independently so compound updates cannot hide a governance mutation; evidence audits retain only the opaque evidence reference and governance metadata, never the private file, path, hash, correspondence, or notes.
- private rate buckets and analysis leases protect billable operations across instances.
- usage and audit events support cost review and corrections without storing raw photos.

## Media publication sequence

1. A missing exact-release view returns the local placeholder immediately and may enqueue a private `media_request`.
2. A human chooses an allowed acquisition path: owner capture, commissioned capture, contributor submission with an explicit license, written publisher/official permission, or individual open-license review.
3. The original and permission evidence stay in separate private buckets. Merely finding an online image does not authorize download, transformation, or publication.
4. Human review confirms the physical release fingerprint, stores that exact value on the asset, and records the rights holder, photographer, channel, transformation, attribution, territory, effective/expiry, and takedown terms. V1 approval accepts only the normalized `worldwide` territory. Regional permissions remain private review records until a trusted territory-aware delivery boundary exists.
5. A controlled processor creates versioned derivatives, strips embedded metadata, records every transformation actually applied, and verifies hashes and dimensions. The applied set must be a subset of the permission's allowed transformations. Once verified, content-critical fields cannot be edited; replacement uses a new superseding version. Public delivery never exposes the original or evidence file.
6. `approved_release_media(...)` requires the reviewed fingerprint to equal the release's current verified fingerprint, requires a worldwide grant, and requires rights evidence to have been verified no later than the request time. The TypeScript resolver applies the equivalent reviewed-fingerprint, worldwide-eligibility, and temporal checks, then returns a narrow display-safe projection. Static manifests have a short review expiry so stale permission state also fails closed. This is a worldwide-only allow rule, not IP geolocation enforcement. Any failure falls back to the placeholder.

## Freshness and failure behavior

- Source-catalog entries fail closed after their review expiry.
- Retail snapshots older than 45 days return an unknown price gate.
- 2027 data is watchlist-only and cannot verify a release.
- Missing database quota/lease infrastructure fails closed in production.
- Provider and database failures return neutral public errors with trace IDs; operational detail stays server-side.
- Persisted evaluations expire after 30 days by default unless promoted into a referenced collection workflow.
- Expired, withdrawn, revoked, disputed, unreviewed, non-exact, regional-only, wrong-channel, or hash-unverified media returns no public row. Takedown removes delivery objects and records a forward audit event; it does not rewrite old evaluation evidence.

## Deliberate constraints

- The page remains statically rendered for low latency. Its CSP therefore retains narrowly scoped inline script/style allowances required by the current Next.js output. Moving to nonce-based CSP requires dynamic rendering; that is a documented future hardening option, not silently simulated protection.
- No automated collector-site crawler is part of the request path. Source refresh is a governed maintenance operation.
- No runtime image search, scraper, hotlink relay, background remover, or generative model may publish into the media registry. Automation may prepare a private request or derivative only; human identity and rights approval remain mandatory.
- No valuation estimate is produced without an authorized exact completed-sales feed.
- The system is single-owner by design. Multi-user launch requires tenant policy, consent, moderation, billing, and privacy work rather than only exposing the current routes.
