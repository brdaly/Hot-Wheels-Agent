# Deployment and rollback runbook

## Promotion path

1. Merge only through a pull request after `npm run check`, dependency audit, migration static checks, and the accessibility smoke test pass.
2. Connect the private GitHub repository to separate preview and production Vercel projects.
3. Create separate preview and production Supabase projects. Apply migrations `001` through `005` in order.
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
- Confirm the scheduled purge exists, or configure an approved scheduler for `private.purge_expired_trust_safety_data()`.

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
6. Document the failure, user impact, correction, and new regression test before re-promotion.
