# Buy Buddy

## The Category (one noun)
A buyer's agent.

## The Problem
The best deals on used, high-value items (like a $1,100+ RTX 4090) hide in listings that are misspelled, mis-categorized or described by sellers who don't know what they have, so keyword search and alert tools never surface them. When buyers do find a cheap one, many are fakes: shopping scams were the most-reported social-media scam type in 2025, and Facebook the top platform. Beginners don't know what to ask or how to tell a real seller from a scam.

## The Solution
It finds the thing you want for sale online even when the seller described it wrong, and warns you if the listing is a trick.

## Target Customer (and buyer)
People buying high-value used electronics for themselves: PC builders, gamers, home-AI-rig builders. They gather on r/buildapc, r/pcmasterrace, r/PcBuild, r/hardwareswap, r/FacebookMarketplace, r/nvidia.
Buyer sentence: "Buyers of used, high-value items who shop on Craigslist, Facebook Marketplace, eBay and ShopGoodwill pay us $14.99 a month, or 2% of an item's price per hunt ($9 minimum, $49 maximum), to find what everyone else missed and avoid scams."

## Market Evidence
- FTC (via TechCrunch, 2026-04-27): $2.1B lost to scams that started on social media in 2025, up eightfold; shopping scams the most-reported type; Facebook the top platform.
- Reddit: "I Got Scammed on FB Marketplace RTX 4090"; "4090 scams are rampant on fb marketplace"; first-time buyers asking strangers whether a 4090 seller is trustworthy; "a seller who didn't know what they had."
- r/hardwareswap already requires "timestamp" photos — the community invented seller verification; nobody automated it for beginners.

## Competitive Landscape
Flipify ($5–10/mo per watchlist), SuperFlip, Flipr, Underpriced, free marketplace alerts. All serve resellers who already know what they're looking at, all search by keyword. None coach beginners or make the seller prove possession.
Single differentiator: making a non-expert buyer as safe and sharp as an expert.

## Founder story (lived problem)
Dan built a Claude scheduled task for himself, `daily-3090-diamond-hunt`, that ran daily May 24 – Jun 3, 2026, driving his own Chrome to hunt for RTX 3090s hiding in vague whole-PC listings ("son's old gaming pc," "not sure specs"). Its rule: "This is NOT a keyword hunt… The 3090 won't be in the title. You have to find it in the photos." A count of its 10 reports found no runs with a lead scored 7+ (moderate confidence) — true diamonds are rare, which is why screening must be cheap enough to scan far more listings. It depended on a browser bridge that crashed repeatedly — why Buy Buddy doesn't rely on live scraping for the demo.

## Two kinds of finds
1. Mislabeled card listings (misspelled, wrong category, found only by photo).
2. Whole PCs hiding the card ("Found inside a PC"), with a hidden-value estimate for RAM, SSD and power supply the seller isn't pricing in.
3. ShopGoodwill multi-card lots ("Found in a lot") — staff-written, often "untested, as-is"; for this institutional seller the risk is condition, not scams, so no photo challenge. ShopGoodwill showed 696,923 live listings on Oct 11; a search for "nvidia" returned 45, including untested 7-card lots.

## How it works (multi-model)
1. Small language model expands the search (misspellings, plain-language descriptions).
2. Vision model spots the item in photos when the title is wrong.
3. Jev (decision model) triages every listing in milliseconds: target match + scam signals, with confidence.
4. Reasoning model generates expert questions: fit questions for the buyer (PSU wattage, case clearance) and questions for the seller (repasted? mined on? scratches? box/receipt? power-connector damage?).
5. Seller photo challenge: a unique code + specific shot; text reader, vision match, image-reuse check and AI-image detector feed one Jev verdict.
6. The human decides. The system never contacts, never buys.

## The Moat (one sentence)
Every hunt adds to a shared, buyer-side trust record (which sellers passed verification, which questions caught real problems, which purchases buyers regretted) across every marketplace, and no single marketplace can build it because each one only sees, and protects, its own listings.

## Market Opportunity
$14.99/mo or $9–49 per hunt against hundreds of dollars saved per purchase (one 4090 found $300 under market pays for 20 months). Scam losses growing eightfold since 2020; used-GPU demand rising with home AI. Categories added one at a time, only where expert questions can be vouched for.
Killer stat: "Last year, Americans lost $2.1 billion to scams that started on social media. Shopping scams were the number one type, and Facebook was the number one platform. Meanwhile, the best deals are hiding under typos nobody searches for. We find them, and we make the seller prove it's real."

## The Big Bet
That a buyer's agent working only for the buyer — finding what's mislabeled, asking the expert questions, and making the seller prove it — beats faster alerts.
