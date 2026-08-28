# Hot Wheels Collector Intelligence

An owner-only, evidence-governed collector assistant for identifying exact Hot Wheels releases, recognizing chase candidates, ranking collection fit, applying price discipline, and keeping observations separate from confirmed ownership.

> **Release status:** the application, security boundary, database migrations, tests, source register, and deployment runbook are implemented. A production instance still requires the operator to apply the Supabase migrations and configure the documented environment variables. Market values remain unknown until an authorized completed-sales source supplies exact, recent sold comparables.

## What it does

- Accepts one to four JPEG, PNG, or WebP collector photos, or a typed car query.
- Normalizes images, removes metadata, bounds resolution and bytes, and sends them through the OpenAI Responses API with structured output and `store: false`.
- Uses the model for observations—not arithmetic, database ownership, or unverified market claims.
- Builds a release fingerprint from year, casting/tooling, line, mix, collector number, product code, color, chase state, wheels, card, and region.
- Fails closed when the exact release is unresolved: the result becomes **Verify first**, not a confident buy or valuation call.
- Calculates Collection Priority Score v3.0 deterministically from named, bounded features.
- Separates visual evidence, market evidence, condition, price, collection fit, and duplicate intent.
- Provides an attributed 2026 TH/STH grid, with exact HWtreasure item links and Orange Track cross-checks. External images remain on the publisher’s page.
- Uses owner-only Supabase Auth, row-level security, distributed quotas/concurrency, audit records, retention controls, and detail-free health endpoints.

## Decision model

| Signal | Meaning | Owner |
|---|---|---|
| Collection Priority Score | How strongly this exact release fits the collection thesis | Deterministic TypeScript |
| Visual Evidence Grade | How well the photos support the observed identity and condition | Evidence rules |
| Market Evidence Grade | Number and quality of recent exact completed sales | Evidence rules; never asking prices |
| Exact-release gate | Whether the release is specific enough for a decision | Release fingerprint policy |
| Price gate | Whether a fresh regional shelf-price snapshot supports the price | Dated local snapshot |
| Recommendation | Buy, wait, skip, or verify first, adjusted for owned quantity and copy intent | Deterministic policy |

```mermaid
flowchart LR
  A[Owner photo or query] --> B[Origin, auth, quota and upload checks]
  B --> C[Metadata-stripped image normalization]
  C --> D[Responses API structured observations]
  D --> E[Strict Zod contract]
  E --> F[Release fingerprint and source cross-check]
  F --> G[Deterministic score and gates]
  G --> H[Ranked result and verification queue]
  H --> I{Owner confirms?}
  I -->|Yes| J[Owner-scoped collection record]
  I -->|No| K[Observation only]
```

## Source governance

The eight supplied specialist references were reviewed and distilled into a governed [source register](docs/SOURCE_REGISTER.md) and machine-readable [source catalog](data/source-catalog.json). They support discovery, casting/tooling, release-line, TH/STH, premium-chase, vocabulary, and watchlist claims within explicit freshness limits.

They do **not** establish fair value, production quantity, live availability, or verified exact identity on their own. Future-year and incomplete entries remain provisional. Derived facts are attributed; tables, prose, affiliate prices, and images are not copied wholesale.

## Local development

Requirements: Node.js 22 or newer and npm.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

For a local UI-only session, `HOTWHEELS_DEV_AUTH_BYPASS=true` is permitted outside production. Never enable it in a shared environment. Real analysis needs `OPENAI_API_KEY`; authenticated collection use needs Supabase and the owner bootstrap described in [SECURITY.md](SECURITY.md).

Apply all migrations in order:

1. `001_initial.sql`
2. `002_production_model.sql`
3. `003_trust_safety_upgrade.sql`
4. `004_release_evidence_model.sql`
5. `005_analysis_concurrency.sql`

## Verification

```bash
npm run check
npm run test:coverage
npm audit --audit-level=high
```

`npm run check` runs lint, type checking, unit/contract tests, and a production build. See [CONTRIBUTING.md](CONTRIBUTING.md) for change rules and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for promotion and rollback.

## API surface

| Route | Method | Purpose |
|---|---|---|
| `/api/session` | GET/POST/DELETE | Check, create, or clear the owner session |
| `/api/analyze` | POST multipart | Analyze up to four images and/or a typed query |
| `/api/score` | POST JSON | Apply deterministic score and decision gates |
| `/api/collection` | GET/POST | Owner-scoped collection access |
| `/api/targets` | GET | Versioned target and chase reference data |
| `/api/prices` | GET | Dated regional retail snapshot |
| `/api/health` | GET | Detail-free liveness |
| `/api/ready` | GET | Token-protected configuration/database readiness |

## Important boundaries

- A photo is an observation, not proof of ownership.
- A casting name is not an exact release. Incomplete fingerprints never merge automatically.
- A duplicate is evaluated by its marginal role: sealed upgrade, open copy, trade copy, or unnecessary duplicate.
- Active listings are seller expectations, not sold comparables.
- Chase paint, wheel style, or a model suggestion alone cannot verify TH/STH/0-of-5 status.
- The application is independent and is not affiliated with or endorsed by Mattel.

