# ADR-006: No listing without a live link

**Status:** Accepted (2026-10-11)

## Decision
A listing is shown to the buyer only if it has its own listing URL and a spec read from that same page. If nothing qualifies, the honest result is "no compelling finds today."

## Why
A lead the buyer can't open is worse than no lead — they may drive somewhere for nothing. Honest emptiness beats invented leads. (Carried over from Dan's daily-3090-diamond-hunt rule, May 2026.)

## Consequences
- No candidates reconstructed from search snippets or memory.
- Demo data is real captured listings, clearly labeled "Sample data."
- A pull request that fills empty results with placeholder or generated listings contradicts this decision.
