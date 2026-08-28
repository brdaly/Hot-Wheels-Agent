# Architecture

The current system is an owner-only modular monolith: a Next.js application owns the interface and API, OpenAI supplies bounded visual observations, and Supabase supplies authentication, row-level-security persistence, quotas, leases, and audit history. The accepted decision is recorded in [ADR-0001](adr/0001-evidence-governed-owner-architecture.md).

## Trust boundaries

1. **Browser to application:** same-origin requests, owner session, request-size/type checks, and no-store responses.
2. **Application to OpenAI:** normalized images, pseudonymous safety identifier, strict schema, bounded tokens, `store: false`, and no acceptance of model-generated market comps.
3. **Application to Supabase:** owner access token for collection reads/writes under RLS; service role only for privileged quota, lease, usage, retention, and audit operations.
4. **Application to collector sources:** versioned derived facts and outbound attributed links only. No live scraping or image relay occurs in a user request.

## Analysis sequence

1. Authenticate the configured owner and enforce exact-origin, hourly, daily, and concurrency limits.
2. Reject oversized or unsupported requests before any billable operation.
3. Decode, reorient, resize, re-encode, and strip metadata from each image.
4. Ask the model for strict observations: visible identity fields, chase cues, condition, named collection features, uncertainty, and verification gaps.
5. Parse with the bounded `photo-analysis-v3.0` contract.
6. Remove all model-stage sold-comparable claims at the application boundary.
7. Build `release-fingerprint-v1.0`; incomplete identity remains provisional and does not merge.
8. Cross-check eligible 2026 chase candidates against the dated item map and governed sources.
9. Compute Collection Priority Score v3.0, independent evidence grades, price gate, condition gate, and duplicate-aware recommendation.
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
- `releases` add year, line, mix, code, color, wheels, chase, card, region, and a release fingerprint.
- `photo_evaluations` are expiring analysis snapshots, not inventory truth.
- `collection_items` are owner-scoped quantities/status and may reference a verified release/evaluation.
- `market_evidence` stores transaction evidence with exact/near/unknown match quality.
- `sources` store authority, verification, retrieval/effective/expiry dates, and content hash.
- private rate buckets and analysis leases protect billable operations across instances.
- usage and audit events support cost review and corrections without storing raw photos.

## Freshness and failure behavior

- Source-catalog entries fail closed after their review expiry.
- Retail snapshots older than 45 days return an unknown price gate.
- 2027 data is watchlist-only and cannot verify a release.
- Missing database quota/lease infrastructure fails closed in production.
- Provider and database failures return neutral public errors with trace IDs; operational detail stays server-side.
- Persisted evaluations expire after 30 days by default unless promoted into a referenced collection workflow.

## Deliberate constraints

- The page remains statically rendered for low latency. Its CSP therefore retains narrowly scoped inline script/style allowances required by the current Next.js output. Moving to nonce-based CSP requires dynamic rendering; that is a documented future hardening option, not silently simulated protection.
- No automated collector-site crawler is part of the request path. Source refresh is a governed maintenance operation.
- No valuation estimate is produced without an authorized exact completed-sales feed.
- The system is single-owner by design. Multi-user launch requires tenant policy, consent, moderation, billing, and privacy work rather than only exposing the current routes.

