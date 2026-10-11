import type { BuyBuddyApi, ChallengeVerdict, ChallengeScenario } from "./types";
import { SAMPLE_GOING_PRICE, SAMPLE_LISTINGS, SAMPLE_SCANNED, isSupportedQuery } from "./sample-data";
import { MONTHLY_PRICE, perHuntFee } from "./pricing";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const WORDS = ["BLUE FOX", "RED KITE", "GREEN OWL", "AMBER ELK", "SILVER HARE", "COPPER WREN"];

function verdictFor(s: ChallengeScenario): ChallengeVerdict {
  const base = { simulated: true as const, model: "GPT-4.1 vision (sample)" };
  if (s === "verified")
    return { ...base, scenario: s, confidence: 92, checks: [
      { id: "code", label: "Code matches", status: "pass", detail: "Handwritten code would be read and compared (simulated)." },
      { id: "same", label: "Same card as listing", status: "pass", detail: "Serial and cooler would be compared to listing photos (simulated)." },
      { id: "reverse", label: "Photo not found elsewhere", status: "pass", detail: "Reverse image search would run here (simulated)." },
    ] };
  if (s === "unverified")
    return { ...base, scenario: s, confidence: 54, checks: [
      { id: "code", label: "Code matches", status: "pass", detail: "Code readable (simulated)." },
      { id: "same", label: "Same card as listing", status: "unknown", detail: "Serial sticker too blurry to compare (simulated)." },
      { id: "reverse", label: "Photo not found elsewhere", status: "pass", detail: "No matches found (simulated)." },
    ] };
  return { ...base, scenario: s, confidence: 81, checks: [
    { id: "code", label: "Code matches", status: "fail", detail: "Code in photo differs from the one issued (simulated)." },
    { id: "same", label: "Same card as listing", status: "unknown", detail: "Could not compare without a matching code (simulated)." },
    { id: "reverse", label: "Photo not found elsewhere", status: "fail", detail: "A near-identical image appears in an older listing (simulated)." },
  ] };
}

/** Sample provider. Replace with an HTTP adapter implementing BuyBuddyApi when the backend contract is known. */
export const sampleApi: BuyBuddyApi = {
  mode: "sample",
  async startHunt({ query }) {
    await wait(500);
    if (!isSupportedQuery(query))
      return { query, supported: false, goingPrice: 0, scanned: 0, listings: [], finalistIds: [],
        message: "This sample demo only includes listings for an RTX 4090. Live search for other items arrives when Buy Buddy is connected to its backend." };
    return { query, supported: true, goingPrice: SAMPLE_GOING_PRICE, scanned: SAMPLE_SCANNED, listings: SAMPLE_LISTINGS,
      finalistIds: SAMPLE_LISTINGS.filter((l) => l.finalist).map((l) => l.id) };
  },
  async getListing(query, id) {
    await wait(250);
    if (!isSupportedQuery(query)) return null;
    return SAMPLE_LISTINGS.find((l) => l.id === id) ?? null;
  },
  async createChallengeCode(listingId) {
    let h = 0;
    for (const c of listingId + Date.now()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `${WORDS[h % WORDS.length]} ${1000 + (h % 9000)}`;
  },
  async submitChallenge({ scenario }) {
    await wait(1400);
    return verdictFor(scenario);
  },
  getPricing(goingPrice) {
    return { goingPrice, perHuntFee: perHuntFee(goingPrice), monthly: MONTHLY_PRICE };
  },
};

export const api: BuyBuddyApi = sampleApi;
