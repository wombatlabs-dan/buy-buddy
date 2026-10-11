// The demo haystack: 343 real listings captured on 2026-10-11 (SAMPLE DATA),
// each with its own live listing URL (ADR-006). Loaded once at startup —
// it is ~200 KB, far inside the 1 GB memory limit — and never mutated.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export interface RawListing {
    id: string;
    source: string; // "Craigslist" | "eBay" | "ShopGoodwill" | "Facebook Marketplace"
    title: string;
    price: number;
    url: string;
    image: string | null;
    description: string;
    location: string | null;
    seller_type: "individual" | "institutional";
    seller_account_age: string | null;
    bids: number | null;
    ends: string | null;
    captured_query: string;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = JSON.parse(readFileSync(path.join(root, "data/haystack.json"), "utf8"));

export const HAYSTACK_LABEL: string = file.label;
export const HAYSTACK_CAPTURED_AT: string = file.captured_at;
// ADR-006: only listings with their own live URL are ever shown.
export const LISTINGS: RawListing[] = (file.listings as RawListing[]).filter((l) => typeof l.url === "string" && l.url.startsWith("http"));
// The demo fixture: one real eBay listing (item 128125153911) with its own photos
// saved in docs/demo/ (see docs/demo/SOURCE.md). Labeled Sample data like the rest.
// Its photos are served by the app at /demo/… and read from disk for the vision models.
export const DEMO_ID = "demo-ebay-128125153911";
export const DEMO_CODE = "BLUE FOX 4417";
export const DEMO_PHOTOS = ["/demo/listing-1.jpg", "/demo/listing-2.jpg"];
LISTINGS.unshift({
    id: DEMO_ID, source: "Demo seller", title: "GIGABYTE RTX 4090 GAMING OC 24G", price: 2450,
    url: "https://www.ebay.com/itm/128125153911", image: "local:docs/demo/listing-1.jpg", description: "",
    location: "Demo seller (sample data from eBay item 128125153911)", seller_type: "individual",
    seller_account_age: null, bids: null, ends: null, captured_query: "rtx 4090",
});
export const BY_ID = new Map(LISTINGS.map((l) => [l.id, l]));
export const ROOT = root;

/** dHash of each listing photo, precomputed by scripts/hash-haystack-images.ts. */
export const IMAGE_HASHES: Record<string, string> = JSON.parse(readFileSync(path.join(root, "data/image-hashes.json"), "utf8"));

/** Lowercase, strip punctuation, and split glued model numbers ("rtx4090" -> "rtx 4090"). */
export function normalize(s: string): string {
    return s.toLowerCase()
        .replace(/([a-z])(\d)/g, "$1 $2")
        .replace(/(\d)([a-z])/g, "$1 $2")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

/**
 * Run one search phrase against the haystack the way a marketplace search would:
 * a listing matches when every word of the phrase is in its title, or when the
 * marketplace's own search for that phrase returned it during capture.
 */
export function searchHaystack(phrase: string): RawListing[] {
    const words = normalize(phrase).split(" ").filter(Boolean);
    const q = normalize(phrase);
    if (!words.length) return [];
    return LISTINGS.filter((l) => {
        const t = ` ${normalize(l.title)} `;
        return words.every((w) => t.includes(` ${w} `)) || normalize(l.captured_query) === q;
    });
}
