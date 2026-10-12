# 🛒 Buy Buddy — a buyer's agent for used electronics

> **There's an RTX 4090 on ShopGoodwill right now with a $501 bid. Used, they sell for about $2,500. Nobody's found it, because the listing says "Unable to test."** Meanwhile, a "4080 Super" on Facebook Marketplace for $99 that "ships to you" is exactly what it looks like. Buy Buddy finds the first and catches the second.

**Built at** the Multi Model Hackathon · SF Tech Week · Frontier Tower, San Francisco · October 11, 2026

**Live app:** [buy-buddy.cloud.anbaric.ai](https://buy-buddy.cloud.anbaric.ai) (hosted on Anbaric; sign-in required) · **[▶ Demo video](https://drive.google.com/file/d/12a6I0IUdyR7W4chk2pq5QkspqkDtdBD4/view)**

---

<!-- SCREENSHOT: the haystack screen after a 4090 hunt (candidates, Jev confidence, "Rejected, and why") -->

---

## The problem

**#1 — Missing the deal.** The best deals on used, high-value electronics hide in listings that are misspelled ("4O90"), filed in the wrong category, or written by sellers who don't know what they have ("graphics card from my son's gaming PC"). A 4090 can sit inside a whole PC listed as "gaming computer, not sure specs," or in a ShopGoodwill lot of seven untested cards. Keyword alerts never see any of them.

**#2 — Getting scammed.** When a buyer *does* find a cheap one, it's often fake. Americans lost **$2.1 billion** to scams that started on social media in 2025; shopping scams were the most-reported type, and Facebook was the top platform ([FTC via TechCrunch](https://techcrunch.com/2026/04/27/consumers-lost-2-1-billion-to-social-media-scams-in-2025-ftc-reports/)). Beginners don't know what to ask a seller, or how to tell a real one from a scam.

Experienced buyers already protect themselves: r/hardwareswap requires sellers to post "timestamp" photos with a handwritten note. The community invented seller verification. Nobody has automated it for the people who need it most.

---

## What it does

You tell Buy Buddy what you want and your budget. It hunts, screens, coaches you, and makes the seller prove it — and then **you** decide.

1. 🔎 **Expands the search** the way real sellers write: misspellings, plain-language descriptions, whole-PC listings, Goodwill lots.
2. 🧹 **Screens every listing** — is this really a 4090, or a $24.99 set of 4090 fans, a heatsink, a cable, an eGPU dock? — and scores scam signals (far below market, "ships to you" for a local item, asks for Zelle or a deposit).
3. 👀 **Looks at the photos** to confirm the card when the title is wrong, and estimates hidden value in whole-PC finds (RAM, SSD, power supply), clearly labeled as an estimate.
4. 🧑‍🏫 **Coaches the buyer**: fit questions for you (power-supply wattage, case clearance) and the questions an expert would ask the seller (mined on? repasted? any melting on the power connector? box and receipt?).
5. 📸 **Runs a photo challenge**: a unique code like **BLUE FOX 4417** that the seller writes on paper and photographs next to the card. Models read the handwriting and compare the card to the listing photos (looking for a re-shot screen), code checks for a reused image, and Jev combines it all into one verdict. Result: **Verified, Unverified, or Failed verification** — with plain-language reasons, never "scammer."
6. ✋ **You decide**: go meet the seller, or walk away. Buy Buddy **never buys, never bids, and never messages a seller.**
7. 🧾 **Keeps a trust record**: every step, who decided it (AI, code, or you by name), which model, what it cost, and how long it took.

**ShopGoodwill rule:** an institutional seller can't take a photo for you, so those listings skip the photo challenge and show *condition* risk ("Unable to test," "as-is") instead of scam risk.

---

## The demo: catching a scam on stage

We had no graphics card at the venue — so we played the scammer. The "seller" photographed the listing's own photo **on a laptop screen** next to a napkin reading `BLUE FOX 4417`. Right code. Wrong card.

Buy Buddy reads the handwriting, sees the browser gallery, the glare and the screen bezel, matches the image to the listing photo, and returns **Failed verification: the card photo is this listing's own photo, shot off a screen.** A second napkin with the digits swapped (`BLUE FOX 4471`) fails on the code alone. The photos are in [`docs/demo/`](docs/demo/).

---

## Why multiple models

A scam check is only as good as the chain behind it. No single model reads handwriting, compares photos, spots a re-shot screen *and* makes a calibrated, auditable call. Each model below does one job, and its output becomes the next step's input.

| Step | Model | Why this model |
|---|---|---|
| Expand the search | **GLM 5.3 Flash** (via [OpenRouter](https://openrouter.ai/)) | Fast, cheap text generation for many search variants |
| Screen listings · final verdict | **[Jev](https://developers.cloudflare.com/ai/models/typesafe/jev/)** by TypeSafe (Cloudflare Workers AI) | Answers typed yes/no and score questions with calibrated probabilities instead of free text — auditable decisions for a fraction of a cent |
| Look at photos · read handwriting · coach | **Gemini 3.8 Flash** (via OpenRouter) | Strong vision and handwriting at low cost |
| Backup vision | **Kimi K2.6** (Cloudflare Workers AI) | Takes over the photo checks if Gemini is down or slow, on a second provider, so the demo and the buyer are never stuck |
| Photo-reuse fingerprint · ShopGoodwill rule · matching | **Plain code** | Free, instant, and the same answer every time |

**Models chosen by measurement, not brand.** Kimi K2.6 started as our main vision model. Measured live, it was slow and timed out in verification, so Gemini now leads and Kimi stands by on a second provider: the hunt dropped from 149 seconds to 31, and the photo verdict from 33 seconds to about 7.

**Cheapest checker first:** code runs before any model sees a listing; Jev's typed questions run before the more expensive vision calls. No Anthropic or Meta models are used in the product.

**Code where code is enough.** Every listing photo gets a 64-bit fingerprint of its light-and-dark pattern ([`src/dhash.ts`](src/dhash.ts)); a copied or re-saved listing photo lands within a few bits of the original, catching lazy scams without paying a model to look. The clever scam — a fresh phone photo of a screen — is the vision models' job.

---

## Human in the loop, enforced in the code review

Our product rules are written down as decision records in [`docs/adr/`](docs/adr/):

| Rule | |
|---|---|
| [ADR-001](docs/adr/ADR-001-never-buys.md) | The system never buys |
| [ADR-002](docs/adr/ADR-002-no-contact-without-approval.md) | The system never contacts a seller without the buyer's approval |
| [ADR-003](docs/adr/ADR-003-patterns-not-people.md) | Share patterns, not people |
| [ADR-004](docs/adr/ADR-004-everything-audited.md) | Every model decision is recorded in the audit trail |
| [ADR-005](docs/adr/ADR-005-cheapest-checker-first.md) | Cheapest checker first |
| [ADR-006](docs/adr/ADR-006-no-listing-without-live-link.md) | No listing without a live link |

[Prelint](https://prelint.com) reviews every pull request against these rules. To prove it, we opened [PR #5](https://github.com/wombatlabs-dan/buy-buddy/pull/5) — "Auto-send questions to seller." Prelint flagged it: *"ADR-002 names this exact case in its rejection rule: 'Any pull request that sends messages to sellers automatically contradicts this decision.'"* It stays unmerged.

Prelint also caught real issues during the build: it made us name each step's actor after the model that actually answered (PRs [#3](https://github.com/wombatlabs-dan/buy-buddy/pull/3) and [#4](https://github.com/wombatlabs-dan/buy-buddy/pull/4)), so the trust record never claims a model did work it didn't.

---

## Who it's for

People buying high-value used electronics **for themselves**: PC builders, gamers, and the fast-growing group building home AI rigs. They already gather in r/buildapc, r/pcmasterrace, r/PcBuild, r/hardwareswap, r/FacebookMarketplace and r/nvidia — and those forums are full of the same two stories: *"I got scammed on FB Marketplace buying a 4090"* and *"found a 4090 from a seller who didn't know what they had."*

They don't want to flip cards. They want one good card, at a fair price, without getting burned.

---

## Business case

### Pricing

- **$14.99 / month**, or
- **Per hunt: 2% of the item's going price**, set when the hunt starts — **$9 minimum, $49 maximum.** A used RTX 4090 (going price ~$2,500 on Oct 11, 2026; eBay listings $2,450–3,200) hits the $49 cap.

The per-hunt model has a working precedent: Auction Sniper charges buyers 1.95% of the winning price, $0.35–$35 per auction ([pricing](https://www.auctionsniper.com/help/auction-sniper-pricing/)). Buyers already pay a percentage for a tool that works only on their side.

**The value line:** one 4090 found $300 under market pays for 20 months of subscription. One avoided scam pays for years.

### Unit economics

Every model call's cost is logged to the trust record. A full RTX 4090 hunt plus one photo verification cost **$0.051 in model spend** (measured end to end on Oct 11, 2026: 157 calls for the hunt, 3 for the verification) against a **$49 fee** — model cost is about 0.1% of revenue. Jev screened 140 listings for $0.0044 total. Jev's screening questions cost about $0.04 per million input tokens with free output ([Cloudflare](https://developers.cloudflare.com/ai/models/typesafe/jev/)), so screening hundreds of listings costs fractions of a cent — which is what makes scanning the whole haystack, not just keyword hits, economically possible.

### No purchase liability

Buy Buddy never buys, bids, or messages a seller. It sells judgment and verification, not transactions — no escrow, no chargebacks, no marketplace terms-of-service fights over automated messaging.

### The competition

| | Flipify, SuperFlip, Flipr, Underpriced | Marketplace alerts | **Buy Buddy** |
|---|---|---|---|
| Built for | Resellers who already know what they're looking at | Anyone | **Non-expert buyers** |
| How it finds listings | Keywords | Keywords | **How sellers actually write + photos** |
| Coaches the buyer | No | No | **Fit and seller questions** |
| Makes the seller prove it | No | No | **Photo challenge, multi-model verdict** |
| Works across marketplaces | Varies | One marketplace | **Craigslist, Facebook, eBay, ShopGoodwill** |

### The moat

Every hunt adds to a **shared, buyer-side trust record**: which sellers passed verification, which questions caught real problems, which purchases buyers regretted — across every marketplace. No single marketplace can build it, because each one only sees, and protects, its own listings. (Per ADR-003, what's shared is *patterns*, never people.)

### Growth path

GPUs first, because the prices are high, the scams are common, and home-AI demand is growing. Then one category at a time — cameras, laptops, e-bikes — **only where we can vouch for the expert questions.**

---

## Founder story

Dan built this for himself first. From May 24 to June 3, 2026, a scheduled agent called `daily-3090-diamond-hunt` drove his browser every day looking for RTX 3090s hiding in vague whole-PC listings. Its core rule: *"This is NOT a keyword hunt… The 3090 won't be in the title. You have to find it in the photos."*

Two lessons shaped Buy Buddy. Real diamonds are rare — so screening has to be cheap enough to look at far more listings than a person could. And the browser-driving approach crashed repeatedly — so the demo runs on a captured haystack, and live search is the next build, not a demo risk.

---

## Architecture

```
Buyer (signed in) ── "RTX 4090, max $2,500"
        │
        ▼
Anbaric app (one origin: static front end + /api + hunt engine)
        │
        │   one hunt = one state-machine job; every step has a named actor
        ▼
 expand ──► screen ──► look ──► coach ──► buyer_review ──► challenge ──► seller_photo ──► verify ──► buyer_decision
 (GLM)      (code +    (Gemini   (Gemini)  (HUMAN)          (code:        (HUMAN uploads    (Gemini    (HUMAN:
            Jev)        vision)                              unique code)  the seller's      reader +   meet or
                                                                           photo)            vision +   walk away)
                                                                                             fingerprint
                                                                                             + Jev)
        │
        ▼
Trust record = the audit trail: actor · model · cost · latency · decision
```

ShopGoodwill listings route from `buyer_review` straight to `buyer_decision` (no photo challenge).

---

## Tech stack

| Layer | Technology |
|---|---|
| Hosting · hunt engine · sign-in · audit trail | [Anbaric](https://github.com/anbaric-ai/anbaric-cloud) — one app: StateMachine jobs with AI, Code and Human actors |
| Front end | React + Vite + Tailwind (prototyped in Replit by Kevin Ho), served as static files from the same app |
| Screening and verdicts | Jev (`typesafe/jev`) on Cloudflare Workers AI |
| Vision | Gemini 3.8 Flash (OpenRouter); Kimi K2.6 on Cloudflare Workers AI as backup |
| Search expansion | GLM 5.3 Flash (OpenRouter) |
| Photo-reuse check | Perceptual difference hash in pure TypeScript ([`src/dhash.ts`](src/dhash.ts)) |
| Code review against product rules | [Prelint](https://prelint.com) + `docs/adr/` |
| Data | `data/haystack.json` — 343 real listings captured Oct 11, 2026 |

---

## The haystack (sample data)

The demo runs on **343 real listings captured on October 11, 2026**, each with its live URL and clearly labeled as sample data: Craigslist 84, eBay 31, ShopGoodwill 183 (including 7 multi-card lots), Facebook Marketplace 45. It includes deliberate decoys — 4090 fans, heatsinks, cables, eGPU docks — and real scam patterns. Capture scripts are in [`data/capture/`](data/capture/).

---

## Project structure

```
buy-buddy/
├── src/
│   ├── main.ts          # Anbaric app: serves the front end + /api
│   ├── hunt.ts          # The hunt state machine and trust record
│   ├── models.ts        # Every model call: Jev, Gemini, GLM, Kimi (backup) — with cost and latency
│   ├── haystack.ts      # Loads the sample listings + the demo fixture
│   └── dhash.ts         # Photo-reuse fingerprint
├── web/                 # Front end source (React + Vite, pnpm workspace)
├── static/              # Built front end, served by src/main.ts
├── data/
│   ├── haystack.json    # 343 captured listings (sample data)
│   └── capture/         # Capture scripts
├── docs/
│   ├── adr/             # Product rules ADR-001 … ADR-006 (Prelint reviews against these)
│   ├── product-spec.md
│   └── demo/            # Demo listing photos + the two challenge photos
└── scripts/             # End-to-end test, model probe, photo-hash tools
```

---

## Run it

```bash
npm install
npm start                 # runs src/main.ts
npm run build:web         # rebuilds the front end into static/ (needs pnpm)
anbaric app update        # redeploy to Anbaric
```

Secrets (Cloudflare Workers AI token and OpenRouter key) are stored as Anbaric secrets, never in code. `scripts/e2e.sh` runs a full hunt and prints the trust record with per-step cost and latency.

---

## Honest limits

- **Sample data, not live search.** The demo hunts a captured haystack of real listings. Live marketplace search is the next build.
- **AI-generated-image detection is not checked yet**; the verdict says so rather than implying it.
- **Hidden-value estimates** for whole-PC finds are estimates, and labeled as such.
- **Jev's calibration** is the vendor's claim; we show its confidence, and a human makes every decision that matters.

---

## Team

- **Dan Harrison** — product, problem research, hunt engine, model routing, Anbaric deployment, Prelint product rules, demo
- **Kevin Ho** — front end and UX (Replit prototype), photo-challenge design, demo photos

[WombatLabs](https://www.wombatlabs.ai/) · San Francisco
