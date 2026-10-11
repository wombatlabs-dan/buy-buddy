# ADR-004: Every model decision is recorded in the audit trail

**Status:** Accepted (2026-10-11)

## Decision
Every step of a hunt — each AI model call, each code check, each human decision — is recorded in the Anbaric audit trail with its actor (which model, which code step, or which person), what it decided, when, and its cost and latency.

## Why
The audit trail is the product's trust record and the basis of our moat: a shared, buyer-side record of which sellers passed verification, which questions caught real problems, and which purchases buyers regretted. It also lets a buyer see exactly why the system flagged or cleared a listing.

## Consequences
- No model call or decision happens outside an Anbaric actor.
- The API exposes the audit trail so the app can show it ("Trust record" screen).
- Cost and latency are logged per call.
