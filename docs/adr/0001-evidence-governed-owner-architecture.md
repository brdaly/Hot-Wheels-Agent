# ADR-0001: Evidence-governed owner architecture

- **Status:** Accepted
- **Date:** 2026-08-28
- **Decision owners:** Repository owner and application maintainer

## Context

The application must analyze collector photos without allowing a probabilistic model to invent exact identity, chase status, ownership, scores, or market value. It also handles personal photos, a private collection, billable model calls, changing specialist sources, and third-party media with unverified reuse rights. The repository previously mixed dated research doctrine, hard-coded chase data, optimistic pricing language, static administration, and model-proposed score inputs.

## Decision

Build an owner-only modular monolith with six explicit boundaries:

1. OpenAI returns strict, bounded observations and named evidence features only.
2. TypeScript owns release fingerprints, source cross-checks, scores, evidence grades, price/condition gates, duplicate context, ranking, and recommendations.
3. Incomplete release identity fails closed as provisional and cannot merge.
4. Supabase Auth plus RLS owns collection authorization; service-role functions are restricted to quotas, leases, audit/usage, and retention.
5. Specialist collector sources are a versioned, expiring secondary-source catalog. Their derived facts are attributed and cannot establish valuation or verified identity alone.
6. External photographs are link-only until explicit media rights are recorded.

Analysis persistence is opt-in and expires after 30 days by default. Raw photos are not saved. Completed-sale evidence must come from a future authorized provider and match the exact release, currency, packaging, and condition.

## Alternatives considered

### Let the multimodal model score and recommend directly

Rejected because prompt/model changes would alter arithmetic, amplify uncertain identification, and make regressions difficult to audit.

### Use casting name as the collection key

Rejected because the same casting can span tooling, years, colors, cards, regions, and chase variants; name-only merging corrupts inventory and comps.

### Proxy or commit third-party reference images

Rejected while reuse permission is unverified. A hardened proxy reduces SSRF risk but does not resolve copyright or publisher-control concerns, and it adds an unnecessary network boundary.

### Make the current app public/multi-user

Rejected for this release. Multi-tenancy changes the privacy, moderation, deletion/export, billing, abuse, and authorization model materially.

### Nonce-based dynamic CSP immediately

Deferred. Next.js nonce CSP requires per-request dynamic rendering, which would remove the current static page path and add operational cost/complexity. The present static build uses strict surrounding directives and documents the remaining inline allowance; a dynamic nonce migration is a future hardening decision.

## Consequences

### Positive

- Decisions are reproducible, versioned, and testable.
- Unknowns remain visible instead of becoming defaults.
- Collection and market evidence cannot be silently created by the model.
- Source freshness and future-year uncertainty are enforceable.
- Billable routes are protected across horizontally scaled instances.
- Media use aligns with current permission evidence.

### Costs and risks

- Exact-release verification takes more evidence and may often return **Verify first**.
- Source refresh and human promotion are operational work.
- No fair-value output exists until a licensed/authorized sold-sales integration is added.
- The static CSP retains inline allowances; this residual is reviewed rather than hidden.
- Applying five ordered database migrations and owner bootstrap is required before production use.

## Verification

- Contract, fingerprint, score, price, chase cross-check, source-expiry, authentication, quota, readiness, and migration invariants are covered by automated tests.
- CI runs lint, type checking, unit/contract tests, dependency audit, and a production build.
- Production promotion follows `docs/DEPLOYMENT.md` with preview, readiness, owner/RLS, image, quota, retention, and rollback checks.

