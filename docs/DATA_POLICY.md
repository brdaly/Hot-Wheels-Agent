# Data, evidence, and media policy

## Evidence hierarchy

1. Visible package/base/car evidence for the exact physical copy.
2. Mattel or original product/package records for official release claims.
3. Governed specialist sources for casting/tooling, series/mix, and chase cross-checks.
4. Authorized exact completed-sale records for market evidence.
5. Community sightings only as provisional discovery leads.

No single specialist page verifies an exact release by itself. Chase, high-value, older variation, and ambiguous tooling claims require the visible item plus an independent current confirmation.

## Required distinctions

- Casting versus exact release.
- Vehicle model year versus Hot Wheels release year.
- Regular version versus STH/premium chase.
- Mainline case letter versus a product-line-specific premium mix letter.
- Observation/candidate versus purchased/owned.
- Exact completed sale versus active ask, lot, near match, or unknown best offer.
- Collection preference versus resale evidence.

## Market evidence

Market Evidence Grade is based only on recent exact completed sales in the same currency and comparable packaging/condition:

- A: five or more.
- B: three or four.
- C: one or two.
- U: none or insufficiently comparable.

There is no implicit currency conversion. Asking prices, affiliate links, guide estimates, and non-exact versions never count as sold comps.
Every counted comp must match the declared comparison currency and carry explicit `conditionComparable=true` and `packagingComparable=true` review flags. Missing currency context or comparability review fails closed to exclusion rather than being inferred from free-text labels.

### Current eBay boundary

No eBay sold-data feed is implemented. eBay's official notice scheduled the Finding and Shopping APIs for decommission on 2025-02-05; the replacement [Browse API](https://developer.ebay.com/api-docs/buy/static/api-browse.html) is documented around purchasable items and says a past-end-date listing should not be pulled. Browse/active asking data therefore never becomes completed-sale evidence. The Marketplace Insights contract exposes a `lastSoldDate` filter, but eBay's current [marketplace support page](https://developer.ebay.com/api-docs/buy/static/ref-marketplace-supported.html) says that API is restricted and not open to new users. See the [decommission notice](https://developer.ebay.com/updates/newsletter/q2_2024) and [official filter reference](https://developer.ebay.com/api-docs/buy/static/ref-buy-browse-filters.html).

Until an authorized provider supplies exact completed sales with usable price, date, currency, condition, packaging, shipping, and rights/terms, Market Evidence remains `U`. Asking-price substitution, hard-coded platform fees, and “net realized value” calculations remain disabled.

## Storage and retention

- Raw photos are not saved by the application.
- Uploaded images are decoded, reoriented, resized, re-encoded, and stripped of metadata before provider submission.
- OpenAI requests set `store: false`; account-level provider retention policy must still be reviewed by the operator.
- Analysis persistence is off unless `PERSIST_ANALYSES=true`.
- Persisted evaluations expire after 30 days by default; promoted/referenced records are retained according to the collection workflow.
- Model-usage records expire after 180 days; inactive rate buckets after seven days.
- Corrections append evidence or supersede an insight. They do not silently rewrite prior snapshots.

## Third-party content

The governed [source register](SOURCE_REGISTER.md) permits derived factual fields with attribution. The project does not copy wholesale tables, long descriptions, affiliate prices, page layouts, or photographs. Reference images are not embedded, downloaded, proxied, or committed without documented permission; users open the publisher’s item page instead.

An affiliation or copyright disclosure is not permission. A shop, marketplace, publisher, official-looking product page, direct CDN URL, cropped image, removed background, or AI-restyled image must not be treated as reusable unless the operator holds rights that cover this application's actual use.

## Governed release media

Migration `006_governed_media_rights.sql` and the versioned media manifest implement the following controls:

- Every asset has a non-null `release_id`. Direct approved insertion is rejected. Approval pins `reviewed_release_fingerprint`; public delivery requires it to equal the release row's current verified fingerprint. System-managed `last_approved_at` and last-evidence identity survive `review_pending`, expired, revoked, and takedown states. Any later permission change, including one performed after an unchanged first transition, requires `review_pending`, cleared review fields, a different evidence reference verified after the last approval, and fresh review. Emergency removal is the only exception and may change only `revoked_at`/reason while immediately failing lookup closed.
- Asset, view, and subject types distinguish photographs, illustrations, renders, package scans, car cutouts, package faces, base/chase/wheel details, and combined views.
- Identity and lifecycle are independent. A beautiful image remains unavailable when the exact variant is provisional, disputed, expired, revoked, rejected, or under takedown.
- Rights records name the rights holder and photographer; reference private permission evidence; enumerate allowed transformations and channels; and record attribution, license, normalized territory, effective/expiry dates, review, takedown contact, and revocation. Each evidence reference is an immutable version: its type, holder, private object path/hash, term, verifier/time, and notes cannot be edited. Withdrawal is one-way. A corrected or expanded permission creates a new evidence reference and fresh asset review. V1 public approval and lookup require the literal `worldwide`; regional permissions remain review-only/blocked until a trusted territory-aware delivery design exists. This policy does not claim IP geolocation enforcement.
- Each derivative carries dimensions, byte size, MIME type, SHA-256, rendition version, transformation version, and the transformations actually applied. A public derivative is eligible only when that list includes `strip_metadata` and is a subset of the asset's permitted transformations. Verified/current publication fields cannot be edited; replacement requires a new higher rendition version linked to the prior row, followed by verified supersession. Integrity revocation and current-state transitions are independently audited.
- Public callers cannot read the media tables directly. The approved-media function returns zero assets unless every predicate passes, including `evidence.verified_at <= now()`. Exported manifests carry a review expiry and sanitized evidence status/time metadata so stale permission snapshots also fail closed.
- Public manifest records omit permission-evidence references, takedown contacts, private territory/contract terms, private paths, evidence hashes, correspondence, and notes. They carry only the coarse literal `publicationTerritory: "worldwide"` eligibility marker. The TypeScript resolver rechecks that marker and then projects approved records into display fields only.

Storage is separated by purpose:

| Storage class | Content | Access |
|---|---|---|
| Private originals | Owner, commissioned, licensed, or contributor originals | Service role and authorized reviewer only |
| Private working | Temporary background-removal and formatting work | Service role and controlled processor only |
| Private evidence | Contracts, permission correspondence, releases, license snapshots, and evidence hashes | Service role and authorized reviewer only |
| Public-delivery derivatives | Sized, compressed, rights-approved display files | Served only after governed lookup; no originals or rights documents |

An analysis upload grants no catalog-reuse right. A contributor must take a separate affirmative action and accept a clear license before a submitted photo can enter private media review. Metadata stripping is a recorded, mandatory transformation for every public derivative—not an undocumented processor assumption.

Illustrations and renders are governed assets too. They must be independently authorized, tied to an exact release, human-checked against identifying characteristics, and visibly labeled as illustrations; they are supplemental recognition aids, not photographic evidence.

## Missing media and takedown

- Missing media returns the bundled placeholder without delaying the page.
- The application may create a private request for human research, commissioning, contributor outreach, or permission review. It does not fetch or transform the candidate image.
- Takedown or withdrawn permission changes the asset state, removes or blocks its public-delivery objects, records the event, invalidates caches where supported, and restores the placeholder.
- Rights evidence and audit history are retained according to counsel-approved legal and privacy requirements; they are not exposed to public clients.
