import type { Listing } from "./types";

// Going price for a used RTX 4090: about $2,500 (eBay used listings, Oct 11 2026: $2,450–3,200)
export const SAMPLE_GOING_PRICE = 2500;
export const SAMPLE_SCANNED = 200;
export const GOODWILL_SEARCH = "https://shopgoodwill.com/categories/listing?st=RTX%204090";

const P = {
  carpet: "images/l-carpet.jpg",
  pc: "images/l-pc.jpg",
  lot: "images/l-lot.jpg",
  box: "images/l-box.jpg",
  serial: "images/l-serial.jpg",
  hand: "images/l-hand.jpg",
};

const fit = [
  { id: "case", prompt: "Will a 3.5-slot, 336 mm card fit your case?", placeholder: "e.g. Lian Li O11, fits up to 420 mm" },
  { id: "psu", prompt: "What power supply do you have? (850 W+ recommended)", placeholder: "e.g. Corsair RM1000x" },
  { id: "use", prompt: "What will you mainly use it for?", placeholder: "Gaming at 4K, local AI models..." },
];

const askPrivate = [
  { id: "receipt", text: "Do you still have the original receipt or proof of purchase?" },
  { id: "mining", text: "Was it ever used for crypto mining or 24/7 workloads?" },
  { id: "connector", text: "Can you send a close photo of the 16-pin power connector?" },
  { id: "test", text: "Can I see it running a benchmark when we meet?" },
  { id: "warranty", text: "Is the manufacturer warranty transferable?" },
];

const askGoodwill = [
  { id: "tested", text: "Does the listing say the item was tested or untested?" },
  { id: "returns", text: "What is the return policy for this lot?" },
  { id: "shipping", text: "Is shipping insured and how is it packed?" },
];

type Seed = Omit<Listing, "fitQuestions" | "sellerQuestions" | "goingPrice" | "searchUrl">;

const seeds: Seed[] = [
  {
    id: "bb-01", source: "Facebook Marketplace", sellerKind: "private", sellerName: "Marcus T.", location: "Oakland, CA",
    originalTitle: "gaming pc i9 13900k 64gb ram MUST GO moving", price: 2150, matchConfidence: 91, tags: ["pc", "photo"],
    hiddenValue: { amount: 300, note: "+$300 in RAM, SSD and power supply the seller isn't pricing in" },
    risk: { kind: "scam", level: "low", reasons: ["Account is 6 years old with 14 completed sales", "Photos taken in the same room, consistent lighting", "Will meet in person and let you test"] },
    photos: [P.pc, P.hand, P.serial], postedAgo: "3 hours ago", finalist: true,
    whyMatched: ["Title never says 4090, but the glass panel shows a triple-fan card with the 4090 shroud", "Sticker in photo 3 reads an RTX 4090 part number", "Whole PC priced near card value plus CPU only"],
  },
  {
    id: "bb-02", source: "Craigslist", sellerKind: "private", sellerName: "jen_k_sells", location: "San Jose, CA",
    originalTitle: "RTX 4090 Founders Edtion - barely used", price: 1290, matchConfidence: 97, tags: [],
    risk: { kind: "scam", level: "low", reasons: ["Receipt shown in photos with matching serial", "Price is close to going rate, not suspiciously low"] },
    photos: [P.box, P.serial, P.hand], postedAgo: "yesterday", finalist: true,
    whyMatched: ["Exact model in title despite the typo", "Box, card and receipt visible", "Within 8% of the going price"],
  },
  {
    id: "bb-03", source: "ShopGoodwill", sellerKind: "shopgoodwill", sellerName: "Goodwill of Silicon Valley", location: "Ships from San Jose, CA",
    originalTitle: "LOT OF 4 GRAPHICS CARDS NVIDIA AMD UNTESTED", price: 940, matchConfidence: 84, tags: ["lot", "photo"],
    risk: { kind: "condition", level: "medium", reasons: ["Listed as untested; no power-on check", "One card in the lot shows bent fins", "Sold as-is, limited returns"] },
    photos: [P.lot, P.serial], postedAgo: "auction ends in 2 days", finalist: true,
    whyMatched: ["Card at top-left of the lot matches the RTX 4090 cooler", "Lot title does not name the model", "Other three cards add resale value"],
  },
  {
    id: "bb-04", source: "OfferUp", sellerKind: "private", sellerName: "deal_hunter_88", location: "Fremont, CA",
    originalTitle: "nvidia 4090 24gb grafics card no box", price: 780, matchConfidence: 72, tags: [],
    risk: { kind: "scam", level: "high", reasons: ["Price is 35% below going rate", "Account created 4 days ago", "Asks for payment before meeting", "Photo appears in an older listing elsewhere"] },
    photos: [P.carpet, P.hand], postedAgo: "5 hours ago", finalist: false,
    whyMatched: ["Model and memory size in title", "Photo shows the right cooler, but see risk signals"],
  },
  {
    id: "bb-05", source: "eBay", sellerKind: "private", sellerName: "pcparts_reno", location: "Reno, NV",
    originalTitle: "MSI Suprim X 4090 - works great, small scratch", price: 1240, matchConfidence: 95, tags: [],
    risk: { kind: "scam", level: "low", reasons: ["99.6% positive over 412 ratings", "Buyer protection applies"] },
    photos: [P.hand, P.box], postedAgo: "2 days ago", finalist: false,
    whyMatched: ["Exact model", "Disclosed cosmetic scratch honestly", "Slightly above going price"],
  },
  {
    id: "bb-06", source: "Facebook Marketplace", sellerKind: "private", sellerName: "Priya R.", location: "Sacramento, CA",
    originalTitle: "Big graphic card from sons old computer", price: 650, matchConfidence: 66, tags: ["photo"],
    risk: { kind: "scam", level: "medium", reasons: ["Seller unsure of model", "Only one photo", "Local pickup only, which is good"] },
    photos: [P.carpet], postedAgo: "1 day ago", finalist: false,
    whyMatched: ["Title gives no model; the cooler shape and 16-pin connector match a 4090", "Needs a serial photo to confirm"],
  },
  {
    id: "bb-07", source: "Craigslist", sellerKind: "private", sellerName: "workstation_guy", location: "Palo Alto, CA",
    originalTitle: "Workstation tower w/ Geforce 4090, Ryzen 9, 2TB nvme", price: 2400, matchConfidence: 88, tags: ["pc"],
    hiddenValue: { amount: 300, note: "+$300 in RAM, SSD and power supply the seller isn't pricing in" },
    risk: { kind: "scam", level: "low", reasons: ["Will demo running in person", "Specs list matches photos"] },
    photos: [P.pc, P.serial], postedAgo: "4 days ago", finalist: false,
    whyMatched: ["Card named in title", "Full system could be parted out"],
  },
  {
    id: "bb-08", source: "OfferUp", sellerKind: "private", sellerName: "alex.m", location: "Hayward, CA",
    originalTitle: "rtx4090 gigabyte gaming oc", price: 1175, matchConfidence: 93, tags: [],
    risk: { kind: "scam", level: "low", reasons: ["Verified ID on platform", "Serial sticker shown"] },
    photos: [P.hand, P.serial], postedAgo: "6 hours ago", finalist: false,
    whyMatched: ["Exact model", "Just under going price"],
  },
  {
    id: "bb-09", source: "ShopGoodwill", sellerKind: "shopgoodwill", sellerName: "Goodwill Industries of Orange County", location: "Ships from Santa Ana, CA",
    originalTitle: "Computer Parts Lot - Video Cards, Cables, Fans", price: 610, matchConfidence: 61, tags: ["lot", "photo"],
    risk: { kind: "condition", level: "high", reasons: ["Box of mixed parts, no testing", "Card partly hidden under cables", "Shipping damage risk on loose parts"] },
    photos: [P.lot], postedAgo: "auction ends in 5 days", finalist: false,
    whyMatched: ["A partly visible card has the 4090 backplate pattern", "Low confidence until more photos"],
  },
  {
    id: "bb-10", source: "eBay", sellerKind: "private", sellerName: "flipz_tech", location: "Phoenix, AZ",
    originalTitle: "RTX 4090 FOR PARTS fan noise", price: 690, matchConfidence: 79, tags: [],
    risk: { kind: "scam", level: "medium", reasons: ["Sold for parts, condition unclear", "Returns not accepted"] },
    photos: [P.carpet, P.serial], postedAgo: "3 days ago", finalist: false,
    whyMatched: ["Exact model, but sold as faulty"],
  },
  {
    id: "bb-11", source: "Facebook Marketplace", sellerKind: "private", sellerName: "Danny O.", location: "Berkeley, CA",
    originalTitle: "Asus Strix 4090 OC + original box", price: 1395, matchConfidence: 96, tags: [],
    risk: { kind: "scam", level: "low", reasons: ["Long-standing account", "Box serial visible and matches card"] },
    photos: [P.box, P.hand], postedAgo: "8 hours ago", finalist: false,
    whyMatched: ["Exact model", "Premium variant, priced above going rate"],
  },
  {
    id: "bb-12", source: "Craigslist", sellerKind: "private", sellerName: "no name given", location: "Stockton, CA",
    originalTitle: "4090 brand new sealed $700 cash app only", price: 700, matchConfidence: 58, tags: [],
    risk: { kind: "scam", level: "high", reasons: ["Sealed new card far below retail", "Payment app only, no meeting", "No phone number or history"] },
    photos: [P.box], postedAgo: "1 hour ago", finalist: false,
    whyMatched: ["Model in title, but the offer pattern is unusual"],
  },
];

export const SAMPLE_LISTINGS: Listing[] = seeds.map((s) => ({
  ...s,
  goingPrice: SAMPLE_GOING_PRICE,
  fitQuestions: fit,
  sellerQuestions: s.sellerKind === "shopgoodwill" ? askGoodwill : askPrivate,
  searchUrl: s.sellerKind === "shopgoodwill" ? GOODWILL_SEARCH : undefined,
}));

export function isSupportedQuery(q: string) {
  return /4090/.test(q.replace(/\s+/g, ""));
}
