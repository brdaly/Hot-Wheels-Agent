# Architecture and decision records

## ADR-001 — The model does not own the score

Vision returns strict, bounded observations. TypeScript validates components, totals the score, assigns the tier, calculates evidence grade, applies condition policy and evaluates regional price. This prevents prompt drift from changing arithmetic.

## ADR-002 — Preference is not market evidence

Collection priority measures fit. Market Evidence Grade reports support quality. Condition and price remain explicit gates. A high preference score is never an investment claim.

## ADR-003 — Exact release is the primary entity

Recommendations attach to year, line, mix, livery, wheels, card, code and chase status. A photo creates an observation; ownership requires an explicit action.

## ADR-004 — Knowledge is temporal and attributable

Regional retail, case lists, targets and evidence are dated snapshots. Corrections append evidence or supersede insights; they do not silently rewrite evaluations.

## Request topology

1. Validate rate, count, size and magic bytes.
2. Send images server-side to Responses with `store: false`.
3. Parse structured output with Zod; ambiguous images stay low confidence.
4. Deterministic policy ranks every car and returns four signals.
5. Persist structured results and trace metadata, not raw photos.
6. Human review promotes candidates to exact releases and owned inventory.

## Scaling boundaries

The in-process limiter is a development safety net; production should use a distributed limiter. Retrieval belongs behind an approved provider interface. Valuation needs an authorized sold-transaction feed. Background imports and evals should move to queues at volume.
