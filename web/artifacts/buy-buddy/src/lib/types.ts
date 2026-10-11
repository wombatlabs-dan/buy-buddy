export type SellerKind = "private" | "shopgoodwill";
export type DiscoveryTag = "photo" | "pc" | "lot";
export type RiskLevel = "low" | "medium" | "high";

export interface RiskAssessment {
  /** "scam" for private sellers, "condition" for institutional sellers (ShopGoodwill). */
  kind: "scam" | "condition";
  level: RiskLevel;
  reasons: string[];
}

export interface FitQuestion {
  id: string;
  prompt: string;
  placeholder: string;
}

export interface SellerQuestion {
  id: string;
  text: string;
}

export interface Listing {
  id: string;
  source: string; // e.g. "Facebook Marketplace", "ShopGoodwill"
  sellerKind: SellerKind;
  sellerName: string;
  location: string;
  originalTitle: string;
  price: number;
  goingPrice: number;
  matchConfidence: number; // 0-100
  risk: RiskAssessment;
  tags: DiscoveryTag[];
  hiddenValue?: { amount: number; note: string };
  photos: string[];
  whyMatched: string[];
  fitQuestions: FitQuestion[];
  sellerQuestions: SellerQuestion[];
  /** True listing URL when a real adapter provides one. */
  listingUrl?: string;
  /** Fallback search URL used by the sample provider. */
  searchUrl?: string;
  postedAgo: string;
  finalist: boolean;
  // Live-only fields from the backend
  visionConfidence?: number;
  checklist?: Array<{ item: string; why: string; severity: string }>;
  coachedBy?: string;
  bids?: number | null;
  ends?: string | null;
  kind?: string;
}

export interface HuntResult {
  query: string;
  supported: boolean;
  goingPrice: number;
  scanned: number;
  listings: Listing[]; // candidates
  finalistIds: string[];
  message?: string;
}

export type ChallengeScenario = "verified" | "unverified" | "failed";

export interface ChallengeCheck {
  id: string;
  label: string;
  status: "pass" | "fail" | "unknown";
  detail: string;
}

export interface ChallengeVerdict {
  scenario: ChallengeScenario;
  confidence: number;
  checks: ChallengeCheck[];
  simulated: true;
  model: string;
}

export interface Pricing {
  goingPrice: number;
  perHuntFee: number;
  monthly: number;
}

export interface BuyBuddyApi {
  readonly mode: "sample" | "live";
  startHunt(input: { query: string; maxPrice: number }): Promise<HuntResult>;
  getListing(query: string, id: string): Promise<Listing | null>;
  createChallengeCode(listingId: string): Promise<string>;
  submitChallenge(input: {
    listingId: string;
    code: string;
    file: File;
    scenario: ChallengeScenario;
  }): Promise<ChallengeVerdict>;
  getPricing(goingPrice: number): Pricing;
}
