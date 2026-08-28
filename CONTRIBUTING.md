# Contributing

Use a small branch and pull request. Every behavioral change needs a deterministic test or a governed eval case. Never weaken exact-release confidence, chase-marker requirements, provenance/freshness dates, owner authorization, or the separation between collection priority, visual evidence, market evidence, condition, and price.

Run `npm run check`, `npm run test:coverage`, and `npm audit --audit-level=high` before opening a pull request. Do not commit secrets, raw user photos, source workbooks, scraped copyrighted datasets, collection exports, direct third-party image copies, or unlicensed market data. Schema changes are append-only SQL migrations. Record consequential architecture choices as an ADR under `docs/adr/`.

Source changes must update `data/source-catalog.json`, preserve attribution and retrieval date, pass `tests/source-registry.test.ts`, and remain provisional after expiry until re-reviewed. Never turn a blank, starred, future-year, or contradictory field into a verified fact.
