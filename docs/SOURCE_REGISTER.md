# Governed collector-source register

This register defines how Hot Wheels Collector Intelligence may use the eight collector pages reviewed on 2026-08-28. They are specialist secondary sources, not Mattel records and not market-value evidence. Use them to form or cross-check a candidate claim; preserve the source URL and retrieval date; keep unresolved or future-year claims provisional.

The machine-readable policy is [`data/source-catalog.json`](../data/source-catalog.json). Runtime helpers in [`lib/source-registry.ts`](../lib/source-registry.ts) fail closed when a source review has expired or a claim falls outside the source's approved scope.

## Live source brief

The **Observed coverage** column records what was visible at retrieval. The **Use rule** column is this project's governance decision, not a statement made by the source.

| Source | Purpose and observed coverage | Useful normalized fields | Authority and use rule |
|---|---|---|---|
| [HWtreasure T-Hunts](https://www.hwtreasure.com/t-hunts/) | Year index for regular Treasure Hunts, with links from 1995 through 2026. Current-year detail pages identify the mix and describe the low-production symbols used on the vehicle and card. | year, hunt type, casting, mix, product code, mainline number, subseries and number, color/livery, observed marker | Specialist chase reference. Use for a TH candidate and recognition cues; require the package plus another trusted source before `verified`. |
| [HWtreasure complete sets](https://www.hwtreasure.com/complete-sets/) | Historical boxed Treasure Hunt/Super Treasure Hunt sets from 1995 through 2025. Year pages may describe contents, edition size, packaging, certificate, sale channel, original price, and allocation method. | set year, included hunt types, vehicle count, edition size, numbered status, packaging, certificate, original channel/price | Historical secondary reference. Production quantities and original prices remain provisional until supported by Mattel, the certificate, or original packaging. Do not use affiliate listings as sold comps. |
| [HWtreasure chase cars](https://www.hwtreasure.com/category/chase-cars/) | Car Culture `0/5` chase index covering 2022 through 2026. Detail pages can include product code, set, series year, chase color/livery, interior, base, and Real Rider wheel description. | year, line, set/mix, `0/5`, casting, product code, color/livery, interior, base, wheel type, recognition markers | Specialist premium-chase reference. Exact code and variant must be cross-checked; the index contains editorial inconsistencies, so never promote from name or color alone. |
| [HWtreasure checklist](https://www.hwtreasure.com/treasure-hunt-checklist/) | Flat regular/Super Treasure Hunt checklist from 1995 to the present. At retrieval it included a partial four-car 2027 Super section and complete-looking 2026 regular/Super lists. | year, regular-or-super, ordinal, casting, detail URL | Discovery/completeness aid, not proof of exact version. Treat future and incomplete year sections as provisional and never infer that an unlisted item does not exist. |
| [HWtreasure glossary](https://www.hwtreasure.com/category/glossary/) | Non-year-specific visual vocabulary for wheel styles and collector terms, including the low-production symbol, Real Riders, Spectraflame, Red Line Club, and vintage Redlines. | term, abbreviation, definition, marker category, reference URL | Vocabulary aid only. It cannot establish SKU, chase status, scarcity, production count, or value. Some abbreviations are context-dependent, so retain the full term rather than abbreviation alone. |
| [Orange Track casting database](https://orangetrackdiecast.com/hot-wheels-casting-database/) | Broad casting/tooling index organized by modeled-vehicle decade and alphabet. Rows expose casting name, Hot Wheels debut year, designer(s), and sometimes a detail link; visible entries run through 2026. | canonical casting label, debut year, designer(s), section, detail URL | Strong specialist source for casting/tooling candidates. It is not a release, SKU, chase, case, price, or availability database. Name plus debut year is safer than name alone because distinct tools can share a name. |
| [Orange Track 2026 master list](https://orangetrackdiecast.com/2026-hot-wheels-master-list-of-all-lines/) | Working 2026 lineup last labeled updated 2026-08-21. It spans premium, Silver Series, Mattel Creations/ultra-premium, basics, and extensions, with many assortment, retailer, mix, set-number, chase, color, and sale-date fields. | release year, product family/line, assortment code, retailer/channel, mix/case, set number, casting, ordinal, chase flag, product code, color, sale date, source/detail link | Current-year specialist tracker. `*` means unconfirmed; blank/upcoming rows are unknown. Mix letters are product-line-specific. Cross-check exact releases and all chase claims before verification. |
| [Orange Track 2027 master list](https://orangetrackdiecast.com/2027-hot-wheels-master-list-of-all-lines/) | Early future-year working list, published and modified on 2026-08-28. It uses the same broad line structure as 2026 but contains many blank rows; some initial Boulevard, Car Culture, two-pack, display-set, entertainment, and Silver Series entries are populated. | same fields as the 2026 list, plus explicit completeness/provisional state | Watchlist input only. Every 2027 entry is provisional until the release is supported by packaging or an authoritative announcement; starred names and blank cells must never become asserted facts. |

## Collector identification rules supported by these pages

- A regular Treasure Hunt candidate uses the low-production symbol on the vehicle; newer cards may also show the silver circle-and-flame marker behind it. These are recognition cues, not a substitute for exact release matching.
- A Super Treasure Hunt candidate combines the exact mainline release with Spectraflame paint, Real Rider wheels, a `TH` graphic, and potentially the gold card emblem. Verify the exact product code, colorway, year, and card before promotion.
- A Car Culture chase is represented as the additional `0/5` member of its named set. Match the line, set, product code, color/livery, base, and wheels; black or gold paint by itself is not proof.
- A case or mix letter belongs to a specific product line. Never use a premium mix letter to infer a mainline case, and never infer case contents from one casting alone.
- A casting record describes tooling history. A release record additionally needs year, line, mix/set, collector number, product code, color/livery, chase/variant, wheels, and card/region evidence.

## Freshness and provisional handling

1. Reject an expired source for new verified claims until its catalog entry is reviewed and re-dated.
2. Treat current-year indexes and the 2026 master list as weekly-refresh sources. Treat the 2027 future list as a three-day watchlist source while it is changing rapidly.
3. Absence, blank cells, `TBD`, starred names, partial future-year lists, and conflicting product codes mean `unknown` or `provisional`—never `false` or `verified`.
4. For TH/STH/premium-chase claims, use the collector page as one source and require visible package evidence plus an independent trusted confirmation.
5. These sources cannot support fair value, resale upside, sold-comparable counts, live availability, or production quantity on their own.

## Copyright, images, and attribution

- Store derived factual fields only. Do not copy tables, checklist collections, glossary prose, page layout, or substantial descriptions.
- Do not download, commit, proxy, rehost, or embed source images. Link to the relevant source page; a direct image URL may be retained only as non-displayed provenance when necessary and should not be treated as licensed media.
- Attribute every derived claim with publisher, canonical source-page URL, and retrieval date. Preserve any detail-page URL used for an exact item.
- Do not treat Amazon, eBay, or retailer affiliate links as identity authority, availability evidence, or sold-market evidence.
- Names, product codes, years, set numbers, and other facts may be normalized, but the source's selection, arrangement, photographs, and original wording must not be reproduced wholesale.

These source entries are not media licenses. “Official,” publisher attribution, a visible copyright notice, a non-affiliation disclosure, or another shop's use does not authorize copying. Background removal, cropping, tracing, animation, or generative restyling does not convert an unlicensed source photograph or package design into an approved asset.

If a source publisher or photographer grants written permission, register it through migration `006` as a separate governed media asset. Confirm that the grantor owns or can sublicense the exact photograph, pin the reviewed release fingerprint, and record the allowed channels, transformations, attribution, term, territory, and takedown contact privately. V1 may publish only a normalized worldwide grant; keep regional permissions review-only until trusted territory-aware delivery exists. The public manifest receives only sanitized display metadata, a coarse worldwide-eligibility marker, and metadata-stripped derivatives. Until approval, retain only the canonical page link and use the local placeholder.

## Review workflow

1. Open the canonical URL directly and record the retrieval date and any visible source update date.
2. Confirm coverage, incomplete sections, unconfirmed markers, and contradictions.
3. Update only derived metadata and normalized facts needed by the application.
4. Run `npm test -- tests/source-registry.test.ts` and the normal repository checks.
5. Preserve prior evaluation snapshots; a source correction creates new evidence and does not silently rewrite history.
