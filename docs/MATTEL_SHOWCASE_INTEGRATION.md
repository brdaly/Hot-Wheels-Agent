# Mattel Showcase interoperability assessment

Status: assessed 2026-09-02

## Decision

Build Daly Ventures member accounts independently with Supabase Auth. Treat Mattel Hot Wheels Showcase as a companion destination, not an identity provider or collection data source unless Mattel supplies written authorization and supported API/OAuth documentation.

Do not ask members for Mattel credentials, reuse Mattel cookies or sessions, scrape private profiles, or describe the Daly Ventures experience as connected to Mattel.

## Verified product boundaries

- Mattel says one Mattel Login is shared across Mattel Creations and Hot Wheels Showcase.
- Guests can browse and search; collection tools, Showcase Lens, and public profiles require a Mattel Login.
- Showcase profiles can be public or private.
- Mattel's FAQ says collection export and mass import are not currently available.
- No public third-party OAuth, collection API, or developer integration documentation was located during this assessment.
- Mattel's terms reserve its site content and intellectual property; a public page or image URL is not permission to republish the asset in this application.

Official references:

- [Hot Wheels Showcase](https://creations.mattel.com/pages/hot-wheels-showcase)
- [Hot Wheels Showcase FAQ](https://mattelsupport.com/en-us/faqs/hot-wheels-showcase/)
- [Mattel Terms and Conditions](https://mattelsupport.com/terms-conditions/)

## Safe launch architecture

### Phase 1 — companion link

- Keep the public Daly Ventures guide, chase map, and educational content open.
- Link to Hot Wheels Showcase as an external service with clear independent-product language.
- Let a member optionally save their public Showcase profile URL as unverified profile metadata. Never treat that URL as proof of identity, ownership, or collection contents.

### Phase 2 — Daly Ventures member layer

Use Supabase Auth and owner-scoped rows for:

- a saved garage and analysis history;
- watchlists and chase targets;
- packaging and condition notes;
- a member-controlled public/private profile;
- an optional Showcase username or public-profile link;
- CSV/XLSX export so the member controls their Daly Ventures data;
- per-member AI quotas, abuse controls, consent, deletion, and privacy settings.

This requires a deliberate multi-tenant migration. The current owner-only session and RLS model must not simply be opened to the public.

### Phase 3 — authorized Mattel connection only

If Mattel offers a partnership, require documentation for:

- OAuth scopes, token storage, revocation, and account deletion;
- collection read/write fields and rate limits;
- profile privacy and age requirements;
- asset and trademark usage rights;
- data retention, export, correction, and deletion obligations;
- production support and change notices.

Suggested partnership question:

> Does Mattel offer an approved OAuth or API program for third-party collector tools to connect to Hot Wheels Showcase profiles or collection data, and if so, what scopes, asset rights, privacy requirements, and production approval process apply?

## Launch recommendation

Ship independent Daly Ventures membership first. Add an optional external Showcase profile link, but label it clearly as member-provided and unverified. Do not build credential capture, private-profile scraping, or collection synchronization without an official Mattel integration agreement.
