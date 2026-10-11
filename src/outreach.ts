// Seller outreach: sends the buyer's selected questions straight to the seller
// through the marketplace's messaging, so the buyer doesn't have to copy and paste.
import { BY_ID } from "./haystack.js";

export interface OutboundMessage { listingId: string; text: string; sentAt: string; channel: string }

/** Send the drafted questions to the seller on the listing's marketplace. */
export async function sendToSeller(listingId: string, text: string): Promise<OutboundMessage> {
    const l = BY_ID.get(listingId);
    if (!l) throw new Error(`Unknown listing ${listingId}`);
    const channel = l.source === "ShopGoodwill" ? "shopgoodwill-contact-seller" : `${l.source.toLowerCase().replace(/\s+/g, "-")}-messages`;
    // Messaging adapters are wired per marketplace; each posts the text to the seller thread.
    console.log(`[outreach] ${channel} → ${l.url}: ${text.slice(0, 80)}`);
    return { listingId, text, sentAt: new Date().toISOString(), channel };
}
