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

## Public and member product boundary

| Access | Launch capabilities |
|---|---|
| Public, no account | Chase Grid, US retail gates, casting autocomplete, deterministic scoring explanations, limited photo/name analysis |
| Free member | Saved garage, analysis history, watchlist, collection ownership and duplicate tracking |
| Exclusive member | Higher analysis allowance, bulk peg-wall scans, alerts, personalized targets, exports and advanced history |

Supabase Auth is the natural next implementation for magic-link and social login because the application already uses Supabase. Do not require an account merely to browse the field guide or retail data.

## API budget controls

1. Use a separate OpenAI API Project for this application.
2. Set an enforced hard monthly spend limit before making analysis public. Start at $5–$10.
3. Add notifications below the cap, for example at $2, $5 and $8 for a $10 ceiling.
4. Set `OPENAI_MODEL=gpt-5.6-luna` in Vercel Production and Preview.
5. Keep `OPENAI_IMAGE_DETAIL=auto`, `OPENAI_MAX_OUTPUT_TOKENS=3200` and `HOTWHEELS_ANALYSES_PER_MINUTE=3` for the initial single-car use case.
6. Use `HOTWHEELS_ANALYSIS_ENABLED=false` as the emergency kill switch, then redeploy.
7. Review actual token usage after a fixed test set before raising limits.

The in-process request limit reduces accidental bursts but is not a globally durable quota across Vercel instances. The provider hard spend cap is the authoritative cost ceiling. A later member launch should add a database-backed daily allowance keyed to the authenticated user.

ChatGPT subscriptions and API billing are separate. Do not assume general free API credits are available. Check the OpenAI Platform billing page for any project-specific credit grant; otherwise use a small prepaid balance and hard cap for the test phase.
