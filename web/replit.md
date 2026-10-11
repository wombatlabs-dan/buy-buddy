# Buy Buddy

A buyer's agent for used electronics, with an Altitude-inspired website and a six-step, clearly labeled sample-data experience.

## Run & Operate

- Use the managed `artifacts/buy-buddy: web` workflow to run the website. It supplies the required port and base path.
- `pnpm --filter @workspace/buy-buddy run typecheck` — check the website's TypeScript
- `pnpm run typecheck` — full typecheck across all packages
- The sample experience needs no API credentials, database, authentication, payment provider, or AI service.

## Stack

- pnpm workspaces, TypeScript, React, Vite
- The workspace's Express API and database packages are scaffolding, not the Buy Buddy intelligence backend.

## Where things live

- `artifacts/buy-buddy/` — Buy Buddy website
- `docs/backend-integration.md` — requirements for connecting the user's existing backend
- `.local/conversation-workspace/files/attached_assets/` — original user build prompt
- `.local/conversation-workspace/files/reference/altitude-desktop.png` — supplied reference site's appearance at initial build

## Architecture decisions

- The user already has an intelligence backend and has not yet provided its URL or API contract. Do not replace it with a new backend or add an AI integration.
- Keep sample data separate from any future live provider. Never fall back to samples after a live request fails.
- Demo photo-verification verdicts are illustrative, not conclusions about an uploaded image. All real verification must come from the user's backend.
- Prices in the first demo explain the product; selecting a plan does not start a subscription or charge the user.

## Product

- Start a hunt → live-style candidate narrowing → listing detail → photo challenge → buyer decision → trust record.
- Hunt price is 2% of the item's going price, minimum $9, maximum $49; the alternative is $14.99/month. The RTX 4090 example has a $1,200 going price and a $24 hunt fee.
- ShopGoodwill is an institutional seller: show condition risk instead of scam risk and skip photo challenges. Never place bids automatically.
- Expose the seller's original title, photo-only matches, whole-PC hidden-value estimates, and multi-item-lot discoveries.
- The trust record closes the demo and explains actors, decisions, times, and costs.

## User preferences

- Visual reference: https://altitude.xyz/ — adapt the visual language to Buy Buddy, without reusing Altitude's identity.
- “Friendly, clean, trustworthy look — a helpful friend, not a hacker tool.”
- Label all demo data “Sample data.”
- Use “failed verification,” never label a seller a “scammer.”
- Nothing is sent to sellers automatically; messages are copied for the buyer to send.

## Gotchas

- Do not fabricate real marketplace listing URLs or imply sample listings are currently available. The sample ShopGoodwill link opens search and must say so.
- Uploaded demo photographs are not retained across page reloads. Do not store images or secrets in localStorage.
- Vite commands require managed workflow configuration; do not start duplicate development servers.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
