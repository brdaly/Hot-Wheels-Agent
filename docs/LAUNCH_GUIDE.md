# Daly Ventures launch guide

## Recommended domain

Use `collector.dalyventures.com` as the durable canonical domain. It avoids making the product identity depend on one licensed toy brand and leaves room for Matchbox, die-cast, trading cards or other collector verticals. If discoverability matters, also connect `hotwheels.dalyventures.com` and redirect it to the canonical domain.

For a Hot Wheels-only launch, using `hotwheels.dalyventures.com` directly is technically valid. Keep the independent-product disclaimer visible and do not imply Mattel endorsement.

### Squarespace DNS to Vercel

1. In Vercel, open the Hot Wheels project, then **Settings → Domains**.
2. Add the full subdomain, such as `collector.dalyventures.com`.
3. Copy the exact CNAME target Vercel displays for that domain.
4. In Squarespace, open **Domains → dalyventures.com → DNS → DNS Settings → Custom Records**.
5. Add a `CNAME` record. Use `collector` as the host and Vercel's exact target as the data. Use `hotwheels` instead if that is the chosen subdomain.
6. Do not change the existing `@`, `www`, email or Squarespace records.
7. Return to Vercel and verify the domain. TLS is provisioned automatically after DNS resolves.
8. Set the Vercel Production variable `NEXT_PUBLIC_APP_URL` to the canonical HTTPS URL and redeploy.
9. Add a normal navigation link on the Squarespace site to the collector app.

DNS often resolves quickly but can take 24–48 hours.

## Current product boundary

The current application has a public, precomputed fictional demo and reference browsing, plus a single invited owner's analysis and collection workspace. Public visitors do not receive billable photo/name analysis. Supabase owner authentication, RLS, hourly/daily quotas and concurrency controls already exist; they are not future member features.

Do not advertise free/exclusive membership, subscriptions, a public garage or a public analysis allowance as shipped. Multi-user operation requires the separate public-product gate in [ROADMAP.md](ROADMAP.md), including tenant isolation, consent, deletion/export, abuse controls and a new threat model.

Reference browsing must display the actual source/retail review date. Expired inputs remain unknown until re-verified; a successful application build does not renew them. See [the November review](source-reviews/2026-11-11.md) for supported price categories and remaining limitations.

## Analysis budget controls

- Use separate provider and hosting projects for preview and production, with independently stored secrets.
- Configure `HOTWHEELS_HOURLY_ANALYSIS_LIMIT`, `HOTWHEELS_DAILY_ANALYSIS_LIMIT` and `HOTWHEELS_MAX_CONCURRENT_ANALYSES` from [.env.example](../.env.example). These controls use the database-backed owner quota and lease implementation; do not substitute an in-process counter.
- Keep provider budget alerts and hosting spend controls configured. Verify what each provider actually enforces before relying on it as a hard stop.
- Keep the current model and output settings explicit in the hosting environment and measure usage on a fixed test set before raising allowances.
- Exercise `HOTWHEELS_ANALYSIS_ENABLED=false` as the emergency analysis kill switch before promotion.
- Never enable `HOTWHEELS_DEV_AUTH_BYPASS` in preview, production or a shared environment.

Use [DEPLOYMENT.md](DEPLOYMENT.md) for owner bootstrap, migrations, readiness, retention scheduling and rollback. Domain configuration alone does not establish application readiness.
