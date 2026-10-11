# ADR-001: The system never buys

**Status:** Accepted (2026-10-11)

## Decision
Buy Buddy never purchases, pays for, reserves, or bids on an item. Purchases happen only between the buyer and the seller, outside the system.

## Why
We chose a subscription business with no purchase liability. If the system transacted, a missed scam would become our loss and our responsibility, and casual marketplace sellers (cash at pickup) can't be paid by an agent anyway. Keeping the human as the buyer also keeps a person in control of the moment that matters.

## Consequences
- No payment integrations, checkout flows, or saved payment methods.
- No auction bidding or "snipe" features, even with approval, unless this ADR is replaced.
- For ShopGoodwill listings, the final button opens the listing so the buyer bids or buys themselves.
- Any pull request that adds buying, paying, or bidding contradicts this decision.
