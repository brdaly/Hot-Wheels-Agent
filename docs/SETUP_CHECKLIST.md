# Operator setup checklist

## GitHub

- Keep the repository private until the source, security, trademark, and media review is complete.
- Require pull requests, passing CI, and at least one review for `main` when the GitHub plan supports rulesets for private repositories.
- Enable secret scanning, Dependabot alerts/updates, and signed or otherwise attributable releases where available.

## Supabase

- Create preview and production projects.
- Apply migrations `001` through `005` in order.
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

## Acceptance

- Owner can sign in/out; non-owner and anonymous access is denied.
- Valid text and image analyses work; invalid type, size, origin, quota, and concurrency cases fail safely.
- No model-produced sold comps survive the API boundary.
- Unknown/incomplete exact release produces **Verify first**.
- Collection quantity is changed only by an explicit owner action.
- Health/readiness, retention, backups, logs, alerts, and rollback have been exercised.

