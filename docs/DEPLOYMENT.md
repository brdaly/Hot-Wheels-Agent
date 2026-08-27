# Deployment

## Recommended route

1. Create a private GitHub repository and connect it to Vercel.
2. Create Supabase production and preview projects; apply the SQL migration.
3. Configure secrets in Vercel, never in client-side Squarespace code.
4. Deploy preview, run photo and scoring acceptance tests, then promote to production.
5. Add a CNAME for `hotwheels.dalyventures.com` using the host-provided target.
6. Add a dedicated Hot Wheels page/CTA in Squarespace. Keep `/fund` unless Brendan intentionally repurposes it.
7. Add rate limiting, authentication, monitoring, backups, and spend alerts before public launch.

## Environment variables

- `OPENAI_API_KEY`: server only.
- `OPENAI_MODEL`: defaults to `gpt-5.6`; pin a snapshot before formal regression testing if needed.
- `NEXT_PUBLIC_SUPABASE_URL`: public project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server only.
- `HOTWHEELS_ADMIN_TOKEN`: temporary MVP administration; replace with Supabase Auth before multi-user launch.
- `NEXT_PUBLIC_APP_URL`: canonical app URL.
