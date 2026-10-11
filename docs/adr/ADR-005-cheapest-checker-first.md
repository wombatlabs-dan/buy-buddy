# ADR-005: Cheapest checker first

**Status:** Accepted (2026-10-11)

## Decision
Every listing is checked by the cheapest tool that can settle the question before anything more expensive runs: plain code and the Jev decision model first; the vision model only on candidates that pass; the reasoning model only on finalists.

## Why
True finds are rare (Dan's May 2026 diamond-hunt runs found few strong leads), so the system must scan many listings for little money. This is also our unit economics: a subscription only works if most listings never touch an expensive model.

## Consequences
- Screening (Jev, text-only) runs on every listing; vision runs on a filtered subset; reasoning runs on finalists.
- Cost per hunt is tracked and shown ("200 listings → 12 candidates → 3 finalists, $X").
- A pull request that sends every listing to an expensive model contradicts this decision.
