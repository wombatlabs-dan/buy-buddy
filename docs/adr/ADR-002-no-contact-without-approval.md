# ADR-002: The system never contacts a seller without the buyer's approval

**Status:** Accepted (2026-10-11)

## Decision
Buy Buddy never sends a message, question, offer, or photo challenge to a seller on its own. It drafts messages; the buyer reviews the exact text and sends it themselves (the app offers "Copy message to send").

## Why
The buyer is the one who will meet a stranger and hand over money. They must decide what is said in their name. Automatic outreach would also put the buyer's identity and intent in front of potential scammers without consent.

## Consequences
- No auto-messaging, auto-follow-up, or bulk outreach to sellers.
- Every outbound message is a draft that requires an explicit human action.
- Any pull request that sends messages to sellers automatically contradicts this decision.
