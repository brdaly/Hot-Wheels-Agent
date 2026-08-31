# Operator setup checklist

## GitHub

- Keep the repository private until the source, security, trademark, and media review is complete.
- Require pull requests, passing CI, and at least one review for `main` when the GitHub plan supports rulesets for private repositories.
- Enable secret scanning, Dependabot alerts/updates, and signed or otherwise attributable releases where available.

## Supabase

- Create preview and production projects.
- Apply migrations `001` through `007` in order.
- Disable public sign-ups and invite the owner.
- Set `HOTWHEELS_OWNER_USER_ID`, enroll the same user in `private.app_members`, and backfill any legacy owner rows using `SECURITY.md`.
- Test owner allow and anonymous/non-owner deny cases.
- Enable retention scheduling and backups; run a restore drill.

## OpenAI and hosting

- Create a dedicated OpenAI project/key with a monthly budget and usage alerts.
- Configure all variables from `.env.example` in preview and production.
- Keep analysis persistence off until the retention/privacy choice is intentional.
- Configure platform WAF/spend controls and verify the production SHA.
- Add the custom domain only after preview acceptance tests pass.

## Source, market, and media

- Re-review expired source-catalog entries before promoting new claims.
- Treat all 2027 records as provisional watchlist items.
- License a completed-sales provider before showing fair-value ranges.
- Record explicit rights evidence before embedding or rehosting third-party photographs.
- Maintain a takedown/contact path and the Mattel non-affiliation notice.
- Create isolated private originals, working, rights-evidence, and public-delivery derivative buckets as specified in `docs/DEPLOYMENT.md`; do not grant anonymous bucket listing or original/evidence access.
- Confirm `data/media-manifest.json` remains empty until the first exact-release asset has pinned the reviewed release fingerprint and passed identity, rights, attribution, worldwide-only publication eligibility, metadata stripping, transformation, integrity, and human review. Keep private permission/takedown/regional-contract fields out of the exported file; expose only the coarse `publicationTerritory: "worldwide"` marker.
- Test a reviewed/current fingerprint mismatch, future or expired evidence review, withdrawn evidence, revoked asset, regional-only permission, wrong channel, provisional release, absent `strip_metadata`, unauthorized transformation, and unverified hash all fall back to the local placeholder. Do not claim geolocation enforcement.
- Test rights-evidence insertion/change/withdrawal audit events and simultaneous lifecycle-plus-identity and lifecycle-plus-rights updates; confirm each changed governance dimension records its own event while private evidence path/hash/notes never enter audit metadata.
- Test an existing rights-evidence reference rejects every content, term, verifier, date, and notes edit; only a one-way, non-future withdrawal may update it. A correction must use a new evidence reference and fresh asset review.
- Test approved identity fields cannot mutate until the asset enters `review_pending` and clears the old review. Test permission changes both directly and after an unchanged first transition: each must use a different evidence reference verified after the system-recorded last approval before fresh review. Confirm emergency revoked/takedown permits only revocation timestamp/reason. Test verified/current rendition content rejects in-place edits and supports only a new verified superseding version (or audited revocation/current demotion).
- Do not configure a runtime scraper, remote-image proxy, background-removal publisher, or image generator as a missing-media fallback.

## Acceptance

- Owner can sign in/out; non-owner and anonymous access is denied.
- Valid text and image analyses work; invalid type, size, origin, quota, and concurrency cases fail safely.
- No model-produced sold comps survive the API boundary.
- Unknown/incomplete exact release produces **Verify first**.
- Collection quantity is changed only by an explicit owner action.
- Only approved/current exact-release derivatives can resolve through the public media function; originals and rights evidence remain private.
- Health/readiness, retention, backups, logs, alerts, and rollback have been exercised.
