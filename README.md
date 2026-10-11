# Buy Buddy

**A buyer's agent for used electronics.** It finds the thing you want for sale online even when the seller described it wrong, and warns you if the listing is a trick.

Built at the Multi Model Hackathon, SF Tech Week (Oct 11, 2026) by Dan Harrison and Kevin Ho, WombatLabs.

## What it does
- **Finds what keyword alerts miss:** misspelled and mis-categorized listings, a 4090 hiding inside a whole PC, or one valuable card in a ShopGoodwill lot — across Craigslist, Facebook Marketplace, OfferUp, eBay and ShopGoodwill.
- **Coaches a non-expert buyer:** fit questions and the expert questions to ask the seller.
- **Makes the seller prove it:** a unique photo challenge, checked by several models.
- **Keeps the human in charge:** the system never buys and never contacts a seller on its own.

## How it's built
- **Anbaric** — the hunt engine: one hunt is one job moving through AI, code and human steps, with a full audit trail (the trust record).
- **Base44** — the screens the buyer uses.
- **Prelint** — reviews every pull request against our product rules in `docs/adr/`.
- **Models** — Jev (TypeSafe) for fast screening, a vision model for photos, a reasoning model for expert questions. Cheapest checker first.

## Product rules
See `docs/adr/` (ADR-001 to ADR-006) and `docs/product-spec.md`.

## Run locally
```
npm install
npm start
```
Then open http://localhost:3000/health

## Deploy
`anbaric login` then `anbaric app deploy` (see `.anbaric/app-config.json`).
