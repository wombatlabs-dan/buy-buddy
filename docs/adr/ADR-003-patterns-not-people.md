# ADR-003: Share patterns, not people

**Status:** Accepted (2026-10-11)

## Decision
The shared trust record stores and shows facts about listings and verification outcomes — "failed verification," "this photo appears in 40 other listings," "account created 3 days ago" — never labels or accusations about people. The words "scammer" or "fraudster" are never used for a seller.

## Why
A failed check is a fact; calling a private individual a scammer is an accusation we can't prove. The trust record is valuable because it is accurate and fair. Buyers' own personal details are never shared with other customers.

## Consequences
- UI copy and API fields use outcome language ("Failed verification", "Unverified", "Photo reused elsewhere").
- No public "scammer list" or seller blacklist.
- Buyer personal data is never written to the shared record.
