# ADR-0002: Governed exact-release media publication

- **Status:** Accepted
- **Date:** 2026-08-28
- **Decision owners:** Repository owner and application maintainer

## Context

The Chase Grid and future release pages need fast, consistent car and package visuals. Candidate photographs may come from the owner's collection, commissioned photographers, contributors, publishers, official licensors, or individually reviewed open-license files. Finding an online image, seeing another shop display it, adding a disclosure, removing its background, or producing a similar rendering does not prove permission or exact-release accuracy.

A runtime agent that searches, copies, transforms, and publishes missing images would combine four unacceptable uncertainties: identity, copyright/license scope, transformation permission, and user-request latency. Generated or animated substitutes can also invent wheels, paint, tampo, card, or chase details and cannot serve as exact photographic evidence.

## Decision

Use a precomputed, rights-governed exact-release media library with a fail-closed placeholder.

1. Each asset has a non-null release foreign key, the exact release fingerprint reviewed by the human approver, and explicit asset, view, subject, identity, and lifecycle types. Publication requires that reviewed fingerprint to equal the release's current verified fingerprint. Direct approved insertion is rejected. System-managed last-approval time/evidence fields preserve the comparison baseline across state changes. Any subsequent permission change, including a two-step change after entering `review_pending`, requires cleared review fields, a different evidence reference verified after the last approval, and fresh review. Emergency revoked/takedown is limited to revocation timestamp/reason.
2. Public approval requires exact human-verified release identity, current private permission evidence, rights holder/photographer, allowed channels and transformations, attribution, territory, term, review, and takedown/revocation details. Permission evidence is append-only and versioned by reference: identity, content/hash, term, verifier/time, and notes are immutable, while withdrawal is irreversible. Corrections use a new reference and fresh review. V1 accepts only canonical `worldwide` publication rights. Regional licenses remain review-only until a trusted territory-aware delivery design exists; this is not a claim of geolocation enforcement.
3. Originals, working files, and permission evidence remain private. Public-delivery derivatives are separately versioned with dimensions, content hash, integrity status, transformation version, and a non-empty applied-transformation set that must include metadata stripping and remain a subset of the permission's allowed transformations. Verified/current content fields are immutable; replacement creates a higher version linked with `supersedes_id`. Only audited integrity revocation and current demotion/promotion may change publication state on an existing verified row.
4. Direct public table access is denied. The public query requires current evidence that was already verified at request time and the worldwide-only grant. The sanitized public manifest omits permission references and private operational/contract terms, carries only a coarse worldwide-eligibility literal, and the TypeScript resolver rechecks it before returning a display-safe projection of approved/current exact assets.
5. Missing media returns the bundled placeholder immediately and may enqueue a private human workflow. Discovery never authorizes ingestion or publication.
6. Illustrations/renders are allowed only as governed, labeled supplemental aids; a human must verify their identifying characteristics and they cannot be represented as photographs.
7. Evidence, asset identity/review, asset rights, rendition integrity/current state, and lifecycle changes are audited using opaque references and governance metadata only. Comparisons run independently so one compound update cannot conceal another governance change.

## Options considered

### Pre-approved exact-release library with placeholder

| Dimension | Assessment |
|---|---|
| Identity accuracy | High after human exact-release review |
| Rights risk | Lowest available; permission is explicit and asset-specific |
| Request latency | Low; derivatives are precomputed and CDN-cacheable |
| Operational cost | Moderate acquisition and review work |

**Pros:** Deterministic, auditable, fast, revocable, and compatible with owned/commissioned/contributor/licensed media.

**Cons:** Coverage grows only as assets and rights are reviewed; placeholders remain for gaps.

### Runtime search, background removal, generation, and publication

| Dimension | Assessment |
|---|---|
| Identity accuracy | Uncontrolled; near variants and generated details can be wrong |
| Rights risk | High; technical access is not permission |
| Request latency | High and variable |
| Operational cost | Ongoing model, retrieval, moderation, and incident cost |

Rejected. A private request may store a page URL for human research, but the remote image is never fetched or displayed by that workflow.

### Display official/shop packaging images with disclosure only

| Dimension | Assessment |
|---|---|
| Identity accuracy | Potentially high but not guaranteed to match region/variant |
| Rights risk | Unresolved without a license covering this application's use |
| Request latency | Low if hotlinked, but dependent on third-party availability |
| Operational cost | Low initially; high takedown and breakage risk |

Rejected as a default. Non-affiliation and attribution disclosures remain useful but do not replace permission. An official or publisher asset becomes eligible only after its license is recorded.

### Illustration-only catalog

| Dimension | Assessment |
|---|---|
| Identity accuracy | Variable and review-intensive |
| Rights risk | Lower only when independently created and authorized |
| Request latency | Low after precomputation |
| Operational cost | High for faithful exact-release coverage |

Deferred as a supplemental channel. Illustrations can teach recognition but must be labeled and cannot replace package/vehicle evidence.

## Trade-off analysis

Coverage speed is deliberately subordinate to exactness and permission. Precomputing approved derivatives costs more operational effort than hotlinking or runtime generation, but it produces the fastest safe user experience: known assets arrive immediately and unknown assets degrade cleanly to the local placeholder. The schema separates rights proof from public metadata so reviewers can preserve evidence without exposing contracts or personal details.

## Consequences

### Positive

- Public pages never wait for image acquisition or generation.
- Exact-release and image-rights decisions are reviewable independently, and release identity changes invalidate stale image approvals.
- Expiry, withdrawal, revocation, takedown, and derivative supersession fail closed.
- Regional permissions fail closed in v1, and verified derivative bytes/metadata cannot drift behind a stable version identifier.
- Multiple channels can be licensed separately: application, demo, portfolio, and evaluation fixtures.
- Originals, permission evidence, takedown contacts, and private contract terms are never exposed as public catalog fields or files.

### Costs and risks

- The initial manifest is empty and the grid continues to use placeholders until rights-cleared assets are acquired.
- Human identity and rights review remains required even when automation creates derivatives.
- Storage configuration, hash verification, cache invalidation, and takedown drills become operational responsibilities.
- A rights record is governance evidence, not legal advice; material commercial licensing questions may still require counsel.

## Action items

1. [x] Add append-only migration `006_governed_media_rights.sql`.
2. [x] Add a strict empty media manifest and fail-closed TypeScript resolver.
3. [ ] Configure private originals, working, and evidence buckets plus a governed public-delivery derivative bucket in preview and production.
4. [ ] Obtain and review the first exact-release photo permissions.
5. [ ] Build a private review/derivative tool and takedown runbook exercise.
6. [ ] Connect the UI only after its lookup path preserves every fail-closed predicate.
