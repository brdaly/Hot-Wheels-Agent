# Security policy

Report vulnerabilities privately to the repository owner. Do not open public issues containing credentials, customer photos, collection records, exploit details, or personal data.

## Controls

- Secrets are server-only environment variables.
- Image uploads are count-, size-, MIME- and magic-byte validated.
- Analysis calls use `store: false`; raw photos are not persisted by default.
- Supabase access tokens can be exchanged for a short-lived, `HttpOnly`, `SameSite=Strict` owner cookie at `/api/session`; identity is revalidated with Supabase and matched to `HOTWHEELS_OWNER_USER_ID`.
- Collection reads and writes use the same owner session and user-scoped RLS client as analysis.
- Database tables use row-level security. Migration `003_trust_safety_upgrade.sql` adds owner-scoped policies, a private owner membership table, an atomic distributed token bucket, usage records and retention controls.
- Third-party reference media is link-only: the application neither embeds nor relays publisher images when reuse rights are unverified.
- `/api/health` is a detail-free liveness check. `/api/ready` verifies configuration and database access but requires a separate readiness bearer token.
- Security headers, request traces, bounded structured output and deterministic policy reduce injection and data-flow risk.

## Owner bootstrap

1. Disable public sign-ups in Supabase Auth and invite the single owner account.
2. Apply all migrations, then copy that Auth user's UUID into `HOTWHEELS_OWNER_USER_ID`.
3. In the Supabase SQL editor, enroll and backfill the same UUID:

```sql
insert into private.app_members(user_id, role)
values ('OWNER_AUTH_USER_ID'::uuid, 'owner')
on conflict (user_id) do update set role = excluded.role;

update public.collection_items
set owner_id = 'OWNER_AUTH_USER_ID'::uuid
where owner_id is null;

update public.photo_evaluations
set owner_id = 'OWNER_AUTH_USER_ID'::uuid
where owner_id is null;
```

4. Generate separate high-entropy values for `HOTWHEELS_SAFETY_ID_SECRET` and `HOTWHEELS_READINESS_TOKEN`. Do not reuse an OpenAI or Supabase key.
5. Enable Supabase Cron if automated retention is desired. Migration 003 schedules the purge job when the extension is already enabled; otherwise run `private.purge_expired_trust_safety_data()` from an approved scheduler.

Persisted photo evaluations are opt-in and expire after 30 days by default. Evaluations referenced by a collection item are retained; model-usage events expire after 180 days; inactive rate-limit buckets expire after seven days.

Before public launch, rotate deployment secrets, enable platform WAF and provider budget alerts, test RLS allow/deny cases against a preview database, and commission an independent security review.
