# Decisions and access needed from Brendan

## Required to publish the repository

- Connect the GitHub integration with permission to create a repository under `brdaly`.
- Confirm repository name (recommended: `hot-wheels-frontier-agent`).
- Confirm visibility (recommended during build: private).
- Confirm whether the supplied workbooks/guide may ever be committed. Default: keep originals private and commit only derived, non-sensitive seed data.

## Required to deploy the MVP

- Vercel account/project access, or a different hosting choice.
- OpenAI Platform project and API key, with a monthly budget and usage alerts.
- Supabase project, region, database password, and service-role key.
- Squarespace/DNS access to create `hotwheels.dalyventures.com` and add the `/fund` link or embed.
- Initial access policy: owner-only, invited collectors, or public.

## Product decisions

- Is `/fund` being replaced, or should it link to a dedicated `/hotwheels` page? Recommended: do not replace the venture-fund page; create a dedicated Hot Wheels page and subdomain.
- Should users be able to save collections, or only Brendan initially?
- Should uploaded photos be deleted after analysis, retained privately, or retained with opt-in for model evaluation?
- Should results show prices? If yes, choose and license an approved sold-transaction data source.
- The MVP is US-card/US-dollar first; add international market profiles only after the US workflow is stable.
- Which personal-fit profile is public: Brendan's priorities, a neutral collector profile, or selectable profiles?

## Data and legal requirements

- Written approval/terms review before bulk copying third-party databases or images.
- A source register with allowed use, attribution, refresh cadence, and reliability tier.
- Privacy policy, retention period, takedown/contact path, and age policy before public uploads.
- Mattel/Hot Wheels trademark disclaimer and no implication of endorsement.
- No automated scraping of sources whose terms or robots rules prohibit it.

## Definition of MVP done

- One-to-five car photo analysis.
- Exact identity confidence and verification gaps.
- Comparable 100-point scoring and full rationale.
- Buy/wait/skip plus keep-carded/open/protect.
- Case/mix inference and next-target recommendations.
- Saved observation and confirmed-owned workflows.
- Admin correction flow with audit history.
- Mobile performance, abuse controls, tests, monitoring, and backups.
