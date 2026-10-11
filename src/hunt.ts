// The hunt engine: one hunt = one Anbaric StateMachine job.
//
//   expand (AI) → screen (Code + Jev) → look (AI vision) → coach (AI) →
//   buyer_review (HUMAN) → route (Code: ShopGoodwill rule) →
//   challenge (Code) → seller_photo (HUMAN) → verify (AI + Code + Jev) →
//   buyer_decision (HUMAN) → decided
//
// Every step runs as a named actor, so the Anbaric audit trail records who
// decided what. Each step also appends to the job's `trail` property — the
// buyer-readable trust record — with the model, cost and latency of every call
// (ADR-004). Cheapest checker first (ADR-005): Code, then Jev on every listing,
// vision only on a filtered subset, reasoning only on finalists.
// The system never buys, bids or messages a seller (ADR-001, ADR-002).
import { randomInt } from "node:crypto";
import {
    Action, Await, FileStorageFactory, JobPersistenceFactory, PropertyDefinition,
    State, StateMachine, Terminal, Transition, type Job,
} from "anbaric";
import { ACTORS, MODELS, chatJSON, imageAsDataUrl, jev, readerJSON, visionJSON, type CallMeta, type JevQuestion } from "./models.js";
import { BY_ID, DEMO_CODE, DEMO_ID, DEMO_PHOTOS, IMAGE_HASHES, LISTINGS, normalize, searchHaystack, type RawListing } from "./haystack.js";
import { dhashJpeg, hamming } from "./dhash.js";

export const persistence = JobPersistenceFactory.instance();
export const files = FileStorageFactory.instance();

// ---------- Trust-record events ----------

export interface TrailEvent {
    id: string;
    at: string;
    step: string;
    actor: string; // display name: model id, "Code: <rule>", or the person's id
    actorId: string; // the Anbaric actor id that made the write
    actorKind: "model" | "code" | "you";
    action: string;
    decision: string;
    modelCost: number; // USD, actual model spend for this event (0 for code/human)
    costKnown: boolean; // false when a provider reported no cost
    latencyMs?: number;
    calls?: number; // how many model calls this event summarises
    serviceFee?: number;
}

let seq = 0;
export function ev(e: Omit<TrailEvent, "id" | "at" | "modelCost" | "costKnown"> & { modelCost?: number; costKnown?: boolean }): TrailEvent {
    return { modelCost: 0, costKnown: true, ...e, id: `${Date.now().toString(36)}-${(seq++).toString(36)}`, at: new Date().toISOString() };
}

/** Summarise many calls of one model into a single trust-record line. */
function sumCalls(metas: CallMeta[]) {
    const cost = metas.reduce((s, m) => s + (m.costUsd ?? 0), 0);
    const latency = metas.length ? Math.round(metas.reduce((s, m) => s + m.latencyMs, 0) / metas.length) : 0;
    return { modelCost: cost, costKnown: metas.every((m) => m.costUsd !== null), latencyMs: latency, calls: metas.length };
}

async function trailOf(job: Job): Promise<TrailEvent[]> {
    return ((await job.properties.get("trail")) as TrailEvent[] | undefined) ?? [];
}

/** Run `fn` over items with at most `limit` in flight. */
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
    }));
    return out;
}

// ---------- What the buyer sees for one listing ----------

export interface ListingView {
    id: string;
    source: string;
    sellerKind: "private" | "shopgoodwill";
    sellerName: string;
    location: string;
    originalTitle: string;
    price: number;
    goingPrice: number;
    matchConfidence: number; // Jev's "this is the target" probability, 0-100
    visionConfidence?: number; // vision model's "a 4090 is in the photo", 0-100
    risk: { kind: "scam" | "condition"; level: "low" | "medium" | "high"; reasons: string[] };
    tags: Array<"photo" | "pc" | "lot">;
    hiddenValue?: { amount: number; note: string };
    photos: string[];
    whyMatched: string[];
    fitQuestions: Array<{ id: string; prompt: string; placeholder: string }>;
    sellerQuestions: Array<{ id: string; text: string }>;
    checklist?: Array<{ item: string; why: string; severity: string }>;
    coachedBy?: string;
    listingUrl: string;
    postedAgo: string;
    finalist: boolean;
    bids?: number | null;
    ends?: string | null;
    kind: string;
}

export interface RejectedView { id: string; title: string; price: number; source: string; listingUrl: string; reason: string; jev: number }

// Going price per target, with where the number came from.
const GOING = {
    "4090": { price: 2500, source: "used RTX 4090 listings on eBay, Oct 11 2026: $2,450–3,200" },
};

const STANDARD_FIT = [
    { id: "psu", prompt: "What power supply do you have? An RTX 4090 wants 850 W or more and a 16-pin (12VHPWR) cable.", placeholder: "e.g. Corsair RM1000x" },
    { id: "case", prompt: "Will a 3- to 3.5-slot card about 304–358 mm long fit your case?", placeholder: "e.g. Lian Li O11, fits up to 420 mm" },
    { id: "use", prompt: "What will you mainly use it for?", placeholder: "Gaming at 4K, local AI models..." },
];
const STANDARD_ASK_PRIVATE = [
    { id: "repaste", text: "Has the card ever been opened or repasted?" },
    { id: "mining", text: "Was it ever used for crypto mining or 24/7 workloads?" },
    { id: "connector", text: "Can you send a close photo of the 16-pin power connector? Any melting or discoloration?" },
    { id: "damage", text: "Any scratches, a bent bracket, or card sag?" },
    { id: "receipt", text: "Do you still have the box and the receipt?" },
];
const STANDARD_ASK_GOODWILL = [
    { id: "tested", text: "Was the card powered on or tested at all before listing?" },
    { id: "connector", text: "Could you post a close photo of the 16-pin power connector?" },
    { id: "damage", text: "Any visible damage: bent pins, bracket, cracked PCB, missing screws?" },
    { id: "packing", text: "How will it be packed for shipping?" },
];

// ---------- Properties (the job's schema) ----------

const def = (id: string, check?: (v: any) => boolean, required = false) => {
    const d = new PropertyDefinition(id);
    d.required = required;
    if (check) d.validation = check;
    return d;
};
const isObj = (v: any) => v !== null && typeof v === "object";
const schema = [
    def("query", (v) => typeof v === "string" && v.trim().length >= 2 && v.length <= 120, true),
    def("maxPrice", (v) => typeof v === "number" && v > 0 && v <= 100000, true),
    def("plan", (v) => v === "per-hunt" || v === "monthly"),
    def("buyer", (v) => typeof v === "string"),
    def("supported", (v) => typeof v === "boolean"),
    def("message", (v) => typeof v === "string"),
    def("goingPrice", (v) => typeof v === "number"),
    def("goingPriceSource", (v) => typeof v === "string"),
    def("variants", Array.isArray),
    def("poolIds", Array.isArray),
    def("screened", Array.isArray),
    def("candidates", Array.isArray),
    def("rejected", Array.isArray),
    def("finalistIds", Array.isArray),
    def("funnel", isObj),
    def("selectedListingId", (v) => typeof v === "string" && BY_ID.has(v)),
    def("targetListingId", (v) => typeof v === "string"),
    def("routeTo", (v) => v === "challenge" || v === "goodwill"),
    def("challenge", isObj),
    def("sellerPhoto", isObj),
    def("verdict", isObj),
    def("decision", isObj),
    def("trail", Array.isArray),
];

// ---------- 1. expand (AI) ----------

const VARIANT_KINDS = ["exact", "misspelling", "plain_language", "whole_pc", "lot"] as const;
// Used only if the expander model is unreachable — and the trail says so.
const BUILT_IN_VARIANTS: Array<{ phrase: string; kind: string }> = [
    { phrase: "rtx 4090", kind: "exact" }, { phrase: "4090", kind: "exact" }, { phrase: "geforce 4090", kind: "exact" },
    { phrase: "rtx4090", kind: "misspelling" }, { phrase: "4O90", kind: "misspelling" }, { phrase: "nvidea 4090", kind: "misspelling" },
    { phrase: "graphics card", kind: "plain_language" }, { phrase: "video card", kind: "plain_language" }, { phrase: "nvidia", kind: "plain_language" },
    { phrase: "gaming pc", kind: "whole_pc" }, { phrase: "son computer", kind: "whole_pc" }, { phrase: "computer not sure specs", kind: "whole_pc" },
    { phrase: "gaming computer", kind: "whole_pc" }, { phrase: "gaming desktop", kind: "whole_pc" }, { phrase: "gpu lot", kind: "lot" },
];
// Words that make a title worth a Jev look at all (Code's free first pass).
const HARDWARE = /\b(gpu|graphics?|video|rtx|gtx|geforce|nvidia|nvidea|4090|4o90|pc|computer|desktop|tower|gaming|rig|card|cards|workstation|strix|tuf|suprim|zotac|gigabyte|msi|asus|evga|pny|founders)\b/i;

const expand = new Action("Expand the search", ACTORS.expander);
expand.run = async (job) => {
    const query = String(await job.properties.get("query"));
    const trail = await trailOf(job);
    const supported = normalize(query).replace(/\s/g, "").includes("4090");
    if (!supported) {
        trail.push(ev({ step: "expand", actor: "Code: haystack-matcher", actorId: ACTORS.matcher.id, actorKind: "code", action: "Checked demo coverage",
            decision: `The demo haystack holds listings captured for an RTX 4090 hunt only, so "${query}" was not searched` }));
        return new Map<string, any>([["supported", false], ["trail", trail], ["candidates", []], ["finalistIds", []],
            ["message", "The demo haystack only holds real listings captured for an RTX 4090 hunt. Live search for other items isn't connected yet."]]);
    }

    let variants: Array<{ phrase: string; kind: string }>;
    try {
        const { data, meta } = await chatJSON(MODELS.expander,
            "You help a buyer find a used item whose sellers often describe it badly. Generate search phrases a confused or non-expert seller might have used in a listing title.",
            `Target item: ${query} (desktop graphics card).\nGive 24 short search phrases (1-5 words), mixing: exact names; misspellings and run-together forms (e.g. "4O90", "rtx4090", "nvidea"); plain-language descriptions by people who don't know what they have (e.g. "graphics card from my son's gaming PC", "big video card"); vague whole-PC titles likely to hide one (e.g. "gaming pc", "son computer", "computer not sure specs"); and thrift-store multi-card lots (e.g. "gpu lot", "graphics card lot untested").`,
            { type: "object", additionalProperties: false, required: ["variants"], properties: { variants: { type: "array", items: {
                type: "object", additionalProperties: false, required: ["phrase", "kind"],
                properties: { phrase: { type: "string" }, kind: { type: "string", enum: [...VARIANT_KINDS] } } } } } });
        variants = (data.variants as Array<{ phrase: string; kind: string }>).filter((v) => typeof v.phrase === "string" && v.phrase.trim()).slice(0, 40);
        variants.unshift({ phrase: query, kind: "exact" });
        trail.push(ev({ step: "expand", actor: meta.model, actorId: ACTORS.expander.id, actorKind: "model", action: "Expanded the search",
            decision: `${variants.length} search phrases, e.g. ${variants.slice(1, 7).map((v) => `"${v.phrase}"`).join(", ")}`,
            ...sumCalls([meta]) }));
    } catch (e) {
        variants = [{ phrase: query, kind: "exact" }, ...BUILT_IN_VARIANTS];
        trail.push(ev({ step: "expand", actor: "Code: haystack-matcher", actorId: ACTORS.matcher.id, actorKind: "code", action: "Expanded the search (fallback)",
            decision: `Expander model unavailable (${String(e).slice(0, 80)}); used ${variants.length} built-in phrases instead` }));
    }

    // Run each phrase against the haystack, as a marketplace search would.
    const hits = new Map<string, RawListing>();
    for (const v of variants) for (const l of searchHaystack(v.phrase)) hits.set(l.id, l);
    const all = [...hits.values()];
    const relevant = all.filter((l) => HARDWARE.test(l.title));
    trail.push(ev({ step: "expand", actor: "Code: haystack-matcher", actorId: ACTORS.matcher.id, actorKind: "code", action: "Searched the haystack",
        decision: `${LISTINGS.length} sample listings → ${all.length} matched a phrase → ${relevant.length} kept (dropped ${all.length - relevant.length} with no hardware words, e.g. magazines, controllers)` }));

    const g = GOING["4090"];
    return new Map<string, any>([
        ["supported", true], ["variants", variants], ["poolIds", relevant.map((l) => l.id)],
        ["goingPrice", g.price], ["goingPriceSource", g.source], ["trail", trail],
        ["funnel", { scanned: LISTINGS.length, matched: all.length, pool: relevant.length }],
    ]);
};

// ---------- 2. screen (Code signals + Jev) ----------

const DECOY = /\b(fan|fans|heat ?sink|heatsink|cooler|cooling|shroud|housing|cable|cables|adapter|riser|dock|egpu|backplate|bracket|water ?block|waterblock|box only|empty box|no core|for parts|parts only|laptop|notebook)\b/i;

function codeSignals(l: RawListing, going: number): string[] {
    const s: string[] = [];
    const ratio = l.price / going;
    const t = l.title;
    if (l.seller_type === "individual") {
        if (ratio < 0.25 && /4090|4080/.test(t)) s.push(`Price is ${Math.round(ratio * 100)}% of the going price — far below market`);
        if ((l.location ?? "").toLowerCase().includes("ships to you")) s.push(`"Ships to you" on a local marketplace listing`);
        if (!l.seller_account_age) s.push("Seller account age not shown");
    } else {
        if (/untested|as[- ]is/i.test(t)) s.push("Listed as untested / as-is");
        if (l.bids !== null) s.push(`Auction: ${l.bids} bid(s), current price $${l.price}${l.ends ? `, ends ${l.ends.replace("T", " ")} PT` : ""}`);
    }
    const d = t.match(DECOY);
    if (d) s.push(`Title mentions "${d[0]}" — may be a part or accessory, not the card`);
    if (!l.image) s.push("No photo captured");
    return s;
}

function jevQuestions(institutional: boolean, query: string): Record<string, JevQuestion> {
    return {
        is_target: { type: "noul",
            instructions: `Is this listing selling a working or repairable desktop NVIDIA ${query} graphics card itself, or a desktop PC / multi-card lot that likely contains one? Fans, heatsinks, coolers, shrouds, cables, docks, boxes, cards with no GPU core, laptops and other GPU models do not count.`,
            criteria: { true: `Sells a ${query} card, or a PC/lot likely containing one`, false: "Sells something else (accessory, part, laptop, other GPU, unrelated)" } },
        kind: { type: "choice", instructions: "What is actually for sale?",
            criteria: { card: "A desktop graphics card", whole_pc: "A whole desktop PC or workstation", lot: "A lot of several cards or parts",
                part_or_accessory: "A fan, heatsink, cooler, cable, dock, box or a card with no GPU core", laptop: "A laptop", unrelated: "Something unrelated to graphics cards" } },
        risk: institutional
            ? { type: "score", instructions: "How risky is this item's condition? (The seller is an institution, so this is about condition, not scams.)",
                criteria: ["Low: tested and working", "Medium: untested or unknown condition but complete", "High: as-is, for parts, or visibly damaged"] }
            : { type: "score", instructions: "How many scam warning signs does this listing show? Signs: price far below market, 'ships to you' on a local marketplace, new or hidden account, stock-looking photo, asks for Zelle, gift cards or a deposit.",
                criteria: ["Low: consistent with a genuine local sale", "Medium: one warning sign", "High: several warning signs"] },
    };
}

interface Screened { id: string; jev: number; kind: string; risk: number; signals: string[]; error?: string }

const screen = new Action("Screen every listing", ACTORS.screener);
screen.run = async (job) => {
    const ids = ((await job.properties.get("poolIds")) as string[]) ?? [];
    const going = Number(await job.properties.get("goingPrice"));
    const query = String(await job.properties.get("query"));
    const trail = await trailOf(job);
    const metas: CallMeta[] = [];
    const results = await pool(ids, 16, async (id): Promise<Screened> => {
        const l = BY_ID.get(id)!;
        const signals = codeSignals(l, going);
        const inst = l.seller_type === "institutional";
        const state = [
            `Target: ${query} (desktop graphics card). Typical used price today: $${going}.`,
            `Marketplace: ${l.source}. Seller type: ${inst ? "institution (ShopGoodwill thrift store)" : "private individual"}. Location: ${l.location ?? "not shown"}.`,
            `Listing title, in the seller's own words: "${l.title}"`,
            `Price: $${l.price} (${Math.round((l.price / going) * 100)}% of the typical used price).`,
            signals.length ? `Signals found by code: ${signals.join("; ")}.` : "Signals found by code: none.",
        ].join("\n");
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const { answers, meta } = await jev(state, jevQuestions(inst, query));
                metas.push(meta);
                return { id, signals, jev: answers.is_target?.noul ?? 0, kind: answers.kind?.choice ?? "unrelated", risk: answers.risk?.score ?? 1 };
            } catch (e) {
                if (attempt === 1) return { id, signals, jev: 0, kind: "unscreened", risk: 1, error: String(e).slice(0, 120) };
            }
        }
        throw new Error("unreachable");
    });
    const failed = results.filter((r) => r.error);
    if (failed.length === results.length && results.length > 0) throw new Error(`Jev could not screen any listing: ${failed[0].error}`);
    const passed = results.filter((r) => !r.error && r.jev >= 0.5 && ["card", "whole_pc", "lot"].includes(r.kind));
    const decoys = results.filter((r) => !r.error && (r.kind === "part_or_accessory" || r.kind === "laptop"));
    trail.push(ev({ step: "screen", actor: metas[0]?.model ?? MODELS.jev, actorId: ACTORS.screener.id, actorKind: "model", action: "Screened every listing",
        decision: `${results.length - failed.length} listings screened: ${passed.length} look like the target, ${decoys.length} parts/accessories/laptops rejected${failed.length ? `, ${failed.length} could not be screened` : ""}`,
        ...sumCalls(metas) }));
    return new Map<string, any>([["screened", results], ["trail", trail],
        ["funnel", { ...((await job.properties.get("funnel")) ?? {}), screened: results.length - failed.length, jevPassed: passed.length }]]);
};

// ---------- 3. look (AI vision on a filtered subset) ----------

const LOOK_SCHEMA = {
    type: "object", additionalProperties: false,
    required: ["gpu_visible", "rtx_4090_likelihood", "cues", "card_brand_model", "cards_in_photo", "hidden_value_usd", "hidden_value_note", "notes"],
    properties: {
        gpu_visible: { type: "boolean" },
        rtx_4090_likelihood: { type: "integer", description: "0-100: how likely an RTX 4090 is visible in the photo" },
        cues: { type: "array", items: { type: "string" }, description: "Visual cues used, e.g. triple-slot cooler, ROG Strix shroud, 16-pin connector" },
        card_brand_model: { type: "string", description: "Best guess at brand and model, or 'unknown'" },
        cards_in_photo: { type: "integer" },
        hidden_value_usd: { type: "integer", description: "For a whole PC only: estimated used value of the non-GPU parts (CPU, RAM, SSD, PSU). 0 otherwise." },
        hidden_value_note: { type: "string", description: "For a whole PC: which parts the estimate covers. Empty otherwise." },
        notes: { type: "string" },
    },
};
const LOOK_SYSTEM = "You are an expert PC hardware buyer looking at a marketplace listing photo. Identify whether an NVIDIA RTX 4090 is visible, even if the title is wrong, the card is inside a whole PC, or it is one card among several in a lot. Cues: very large triple- or 3.5-slot cooler; ASUS ROG Strix or TUF, Gigabyte Gaming OC/Aorus, MSI Suprim or Gaming X Trio, Zotac Trinity/AMP, or Founders Edition shrouds; a single 16-pin (12VHPWR) power connector. Do not confuse with RTX 4080 or 3090 cards, which look similar; say so when unsure. Be honest about low-resolution photos.";

const look = new Action("Look at the photos", ACTORS.looker);
look.run = async (job) => {
    const screened = ((await job.properties.get("screened")) as Screened[]) ?? [];
    const going = Number(await job.properties.get("goingPrice"));
    const maxPrice = Number(await job.properties.get("maxPrice"));
    const trail = await trailOf(job);
    // Vision only where it can change the answer: likely cards to confirm, and
    // whole PCs / lots whose titles don't say what's inside. Capped (ADR-005).
    const subset = screened
        .filter((s) => !s.error && BY_ID.get(s.id)?.image)
        .filter((s) => (s.kind === "card" && s.jev >= 0.5) || ((s.kind === "whole_pc" || s.kind === "lot") && s.jev >= 0.2))
        .sort((a, b) => b.jev - a.jev)
        .slice(0, 12);
    const metas: Array<CallMeta & { fallbackFrom?: string }> = [];
    const seen = new Map<string, any>();
    await pool(subset, 4, async (s) => {
        const l = BY_ID.get(s.id)!;
        try {
            const img = await imageAsDataUrl(l.image!);
            const { data, meta } = await visionJSON(LOOK_SYSTEM, `Listing title (seller's words): "${l.title}". Price $${l.price}. What do you see?`, [img], LOOK_SCHEMA, { primary: "gemini" });
            metas.push(meta);
            seen.set(s.id, data);
        } catch (e) {
            seen.set(s.id, { error: String(e).slice(0, 120) });
        }
    });
    const ok = [...seen.values()].filter((v) => !v.error);
    const spotted = ok.filter((v) => v.rtx_4090_likelihood >= 60).length;
    const byModel = new Map<string, Array<CallMeta & { fallbackFrom?: string }>>();
    for (const m of metas) byModel.set(m.model, [...(byModel.get(m.model) ?? []), m]);
    for (const [model, ms] of byModel)
        trail.push(ev({ step: "look", actor: model, actorId: ACTORS.looker.id, actorKind: "model", action: "Looked at listing photos",
            decision: `${ms.length} photo(s) checked${ms.some((m) => m.fallbackFrom) ? ` (fallback: ${ms.find((m) => m.fallbackFrom)!.fallbackFrom})` : ""}; ${spotted} of all photos checked show a likely RTX 4090`,
            ...sumCalls(ms) }));
    if (!metas.length && subset.length)
        trail.push(ev({ step: "look", actor: "Code: haystack-matcher", actorId: ACTORS.matcher.id, actorKind: "code", action: "Vision unavailable",
            decision: `No photo could be checked (${[...seen.values()][0]?.error ?? "unknown error"}); candidates rely on Jev alone` }));

    // Build the candidate list (Code) from Jev + vision.
    const candidates: ListingView[] = [];
    const rejected: RejectedView[] = [];
    for (const s of screened) {
        const l = BY_ID.get(s.id)!;
        const v = seen.get(s.id);
        const vis = v && !v.error ? v : undefined;
        const visionYes = vis && vis.rtx_4090_likelihood >= 60;
        const jevYes = !s.error && s.jev >= 0.5 && ["card", "whole_pc", "lot"].includes(s.kind);
        // Vision overrules Jev only when it sees a physical card that clearly isn't a 4090
        // (a photo of the retail box, or a blurry shot, is not evidence against).
        const visionNo = vis && s.kind === "card" && vis.gpu_visible && vis.rtx_4090_likelihood < 25 && !/4090/.test(String(vis.card_brand_model)) && !/box/i.test(String(vis.card_brand_model) + String(vis.notes));
        if (typeof l.price !== "number") {
            rejected.push({ id: l.id, title: l.title, price: 0, source: l.source, listingUrl: l.url, jev: Math.round(s.jev * 100), reason: "Price wasn't captured from the listing page, so it can't be compared" });
            continue;
        }
        if (!(jevYes || visionYes) || visionNo) {
            if (s.jev >= 0.3 || s.kind === "part_or_accessory" || s.kind === "laptop" || /4090|4080/.test(l.title))
                rejected.push({ id: l.id, title: l.title, price: l.price, source: l.source, listingUrl: l.url, jev: Math.round(s.jev * 100),
                    reason: s.error ? `Not screened: ${s.error}` : visionNo ? `Photo doesn't show a 4090 (${vis.card_brand_model})` : s.kind === "part_or_accessory" ? "A part or accessory, not the card" : s.kind === "laptop" ? "A laptop, not a desktop card" : s.signals.find((x) => /below market|Ships to you/.test(x)) ? `Not the target, and: ${s.signals.filter((x) => /below market|Ships to you/.test(x)).join("; ")}` : "Not the target item" });
            continue;
        }
        const inst = l.seller_type === "institutional";
        const titleSays = /4090|4o90/i.test(l.title);
        const tags: ListingView["tags"] = [];
        if (visionYes && !titleSays) tags.push("photo");
        if (s.kind === "whole_pc") tags.push("pc");
        if (s.kind === "lot") tags.push("lot");
        const level = s.risk < 0.5 ? "low" : s.risk < 1.4 ? "medium" : "high";
        const whyMatched = [
            `Jev: ${Math.round(s.jev * 100)}% that this is the target (${s.kind.replace("_", " ")})`,
            ...(vis ? [`Vision: ${vis.rtx_4090_likelihood}% a 4090 is in the photo${vis.cues?.length ? ` — ${vis.cues.slice(0, 3).join(", ")}` : ""}`] : []),
            ...(titleSays ? [] : ["The title never says 4090"]),
            `Price $${l.price} vs going $${going}`,
        ];
        candidates.push({
            id: l.id, source: l.source, sellerKind: inst ? "shopgoodwill" : "private", sellerName: inst ? "ShopGoodwill" : `${l.source} seller`,
            location: l.location ?? "", originalTitle: l.title, price: l.price, goingPrice: going,
            matchConfidence: Math.round(s.jev * 100), visionConfidence: vis?.rtx_4090_likelihood,
            risk: { kind: inst ? "condition" : "scam", level, reasons: s.signals.length ? s.signals : ["No warning signs found by code"] },
            tags, photos: l.image ? [l.image.replace(/\\/g, "/")] : [],
            hiddenValue: s.kind === "whole_pc" && vis?.hidden_value_usd > 0 ? { amount: vis.hidden_value_usd, note: `AI estimate ~$${vis.hidden_value_usd} for ${vis.hidden_value_note || "the non-GPU parts"}` } : undefined,
            whyMatched, fitQuestions: STANDARD_FIT, sellerQuestions: inst ? STANDARD_ASK_GOODWILL : STANDARD_ASK_PRIVATE,
            listingUrl: l.url, postedAgo: inst && l.ends ? `auction ends ${l.ends.replace("T", " ")} PT` : "captured Oct 11", finalist: false,
            bids: l.bids, ends: l.ends, kind: s.kind,
        });
    }
    // The demo fixture listing is always shown (pinned, labeled Sample data), even if over budget.
    const demo = candidates.find((c) => c.id === DEMO_ID);
    if (demo) {
        demo.photos = DEMO_PHOTOS;
        const over = demo.price > maxPrice;
        demo.whyMatched = [`Featured demo listing: real photos from eBay item 128125153911, labeled Sample data${over ? `. Over your $${maxPrice} budget — shown so you can try the photo challenge` : ""}`, ...demo.whyMatched];
        if (over) demo.location = `Over your $${maxPrice} budget · featured demo`;
    }
    // Finalists: best in-budget candidates by confidence, discount and risk.
    const score = (c: ListingView) => Math.max(c.matchConfidence, c.visionConfidence ?? 0) / 100 + (1 - c.price / going) * 0.6 - (c.risk.level === "high" ? 0.5 : c.risk.level === "medium" ? 0.15 : 0);
    const finalists = [...candidates].filter((c) => c.price <= maxPrice && c.id !== DEMO_ID).sort((a, b) => score(b) - score(a)).slice(0, demo ? 3 : 4);
    if (demo) finalists.unshift(demo);
    for (const f of finalists) f.finalist = true;
    candidates.sort((a, b) => Number(b.finalist) - Number(a.finalist) || score(b) - score(a));
    rejected.sort((a, b) => b.jev - a.jev);
    trail.push(ev({ step: "look", actor: "Code: haystack-matcher", actorId: ACTORS.matcher.id, actorKind: "code", action: "Picked candidates and finalists",
        decision: `${candidates.length} candidates (${candidates.filter((c) => c.tags.includes("photo")).length} found only by photo); ${finalists.length} finalists within $${maxPrice}` }));
    return new Map<string, any>([["candidates", candidates], ["rejected", rejected.slice(0, 12)], ["finalistIds", finalists.map((f) => f.id)], ["trail", trail],
        ["funnel", { ...((await job.properties.get("funnel")) ?? {}), visionChecked: ok.length, candidates: candidates.length, finalists: finalists.length }]]);
};

// ---------- 4. coach (AI reasoning, finalists only) ----------

const COACH_SCHEMA = {
    type: "object", additionalProperties: false, required: ["fit_questions", "seller_questions", "checklist", "summary"],
    properties: {
        fit_questions: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "prompt", "placeholder"],
            properties: { id: { type: "string" }, prompt: { type: "string" }, placeholder: { type: "string" } } } },
        seller_questions: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "text"],
            properties: { id: { type: "string" }, text: { type: "string" } } } },
        checklist: { type: "array", items: { type: "object", additionalProperties: false, required: ["item", "why", "severity"],
            properties: { item: { type: "string" }, why: { type: "string" }, severity: { type: "string", enum: ["dead_end", "walk_away", "caution", "check"] } } } },
        summary: { type: "string" },
    },
};

const coach = new Action("Coach the buyer", ACTORS.coach);
coach.run = async (job) => {
    const candidates = ((await job.properties.get("candidates")) as ListingView[]) ?? [];
    const finalistIds = ((await job.properties.get("finalistIds")) as string[]) ?? [];
    const trail = await trailOf(job);
    const metas: CallMeta[] = [];
    let failures = 0;
    await pool(candidates.filter((c) => finalistIds.includes(c.id)), 4, async (c) => {
        const inst = c.sellerKind === "shopgoodwill";
        try {
            const { data, meta } = await chatJSON(MODELS.coach,
                "You are a seasoned used-GPU buyer coaching a beginner. Be concrete and brief. Never call a seller a scammer; describe facts and checks. The buyer sends every message themselves; you only draft.",
                [
                    `Listing: "${c.originalTitle}" on ${c.source}, $${c.price} (going price for a used RTX 4090: $${c.goingPrice}).`,
                    `What we know: ${c.whyMatched.join("; ")}. Risk signals: ${c.risk.reasons.join("; ")}.`,
                    inst ? "Seller is ShopGoodwill, an institutional thrift store: there is no photo challenge; condition is the risk (often 'Unable to test', sold as-is). Questions go through ShopGoodwill's Contact Seller."
                        : "Seller is a private individual meeting locally; a photo challenge comes next.",
                    "Write: 3 fit questions for the buyer (PSU wattage and 16-pin cable, case clearance for a 3-3.5 slot card, and one more); 5 short questions for the seller (repasted? mined on? scratches or bent bracket? box and receipt? any melting on the 16-pin power connector?) adapted to this listing; a vetting checklist of 4-6 items with severity (OEM PSU or OEM case = dead_end for a 4090; mining signs = walk_away; card sag = caution, solder risk; seller account age = check); and a one-sentence summary.",
                ].join("\n"), COACH_SCHEMA);
            metas.push(meta);
            c.fitQuestions = data.fit_questions.slice(0, 4).map((q: any, i: number) => ({ id: q.id || `fit${i}`, prompt: q.prompt, placeholder: q.placeholder }));
            c.sellerQuestions = data.seller_questions.slice(0, 6).map((q: any, i: number) => ({ id: q.id || `ask${i}`, text: q.text }));
            c.checklist = data.checklist.slice(0, 6);
            c.coachedBy = meta.model;
            if (data.summary) c.whyMatched = [...c.whyMatched, `Coach: ${data.summary}`];
        } catch {
            failures++;
        }
    });
    trail.push(ev({ step: "coach", actor: metas[0]?.model ?? MODELS.coach, actorId: ACTORS.coach.id, actorKind: "model", action: "Wrote questions and a vetting checklist",
        decision: `${metas.length} finalist(s) coached${failures ? `; ${failures} fell back to the standard checklist` : ""}. Other candidates use the standard checklist.`,
        ...sumCalls(metas) }));
    return new Map<string, any>([["candidates", candidates], ["trail", trail]]);
};

// ---------- 5. buyer_review (HUMAN) ----------

const buyerReview = new Await("Buyer picks a listing to pursue", "HUMAN", "The buyer reviews the candidates and picks one to pursue");
buyerReview.fields = ["selectedListingId"];
buyerReview.resolveUrl = (job) => `/hunt?id=${job.id}`;

// ---------- route (Code: the ShopGoodwill rule) ----------

const route = new Action("Apply the ShopGoodwill rule", ACTORS.router);
route.run = async (job) => {
    const id = String(await job.properties.get("selectedListingId"));
    const l = BY_ID.get(id)!;
    const trail = await trailOf(job);
    const inst = l.seller_type === "institutional";
    trail.push(ev({ step: "route", actor: "Code: shopgoodwill-rule", actorId: ACTORS.router.id, actorKind: "code", action: inst ? "Skipped the photo challenge" : "Routed to the photo challenge",
        decision: inst ? `"${l.title}" is sold by ShopGoodwill, an institutional seller: condition risk applies, no photo challenge` : `"${l.title}" is a private sale: the seller must prove possession` }));
    return new Map<string, any>([["targetListingId", id], ["routeTo", inst ? "goodwill" : "challenge"], ["trail", trail]]);
};

// ---------- 6. challenge (Code) ----------

const COLORS = ["BLUE", "RED", "GREEN", "AMBER", "SILVER", "COPPER", "VIOLET", "GOLD", "TEAL", "CORAL"];
const ANIMALS = ["FOX", "KITE", "OWL", "ELK", "HARE", "WREN", "OTTER", "LYNX", "HERON", "BISON"];

const challenge = new Action("Issue the photo challenge", ACTORS.challenger);
challenge.run = async (job) => {
    const id = String(await job.properties.get("targetListingId"));
    const trail = await trailOf(job);
    // The demo listing uses a fixed code so the pre-shot demo photos line up with it.
    const code = id === DEMO_ID ? DEMO_CODE : `${COLORS[randomInt(COLORS.length)]} ${ANIMALS[randomInt(ANIMALS.length)]} ${randomInt(1000, 10000)}`;
    const shot = "the serial-number sticker on the back of the card, with this code handwritten on paper beside it";
    trail.push(ev({ step: "challenge", actor: "Code: challenge-issuer", actorId: ACTORS.challenger.id, actorKind: "code", action: "Issued a photo challenge",
        decision: `Code "${code}" + a photo of ${shot}. Drafted for the buyer to send; Buy Buddy sends nothing.` }));
    return new Map<string, any>([["challenge", { listingId: id, code, shot, issuedAt: new Date().toISOString() }], ["trail", trail]]);
};

// ---------- 7. seller_photo (HUMAN uploads what the seller sent) ----------

const sellerPhoto = new Await("Buyer uploads the seller's photo", "HUMAN", "The buyer uploads the photo the seller sent back");
sellerPhoto.fields = ["sellerPhoto"];
sellerPhoto.resolveUrl = (job) => `/hunt?id=${job.id}`;

// ---------- 8. verify (AI + Code + Jev) ----------

function editDistance(a: string, b: string): number {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
        for (let j = 1; j <= b.length; j++)
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
}

const READ_SCHEMA = { type: "object", additionalProperties: false, required: ["handwritten_text", "legible"],
    properties: { handwritten_text: { type: "string", description: "All handwritten text on paper in the photo, exactly as written. Empty if none." }, legible: { type: "boolean" } } };
const SAME_SCHEMA = { type: "object", additionalProperties: false,
    required: ["card_visible", "serial_sticker_visible", "rtx_4090_likelihood", "same_model_as_listing", "photo_of_screen", "screen_evidence", "same_photo_as_listing", "notes"],
    properties: {
        photo_of_screen: { type: "boolean", description: "True if the proof photo is a picture of a screen (laptop/monitor/phone) rather than the real object" },
        screen_evidence: { type: "string", description: "Plain words: what shows it is a screen (bezel, glare, moire, pixels, browser or gallery UI such as 'Gallery (1 of 12)', a close button). Empty if none." },
        same_photo_as_listing: { type: "integer", description: "0-100: the proof photo contains or displays one of the listing photos (same picture: same angle, background and lighting), for example the listing photo shown on a laptop or phone screen and photographed again. 0 if it is a genuinely new picture." },
        card_visible: { type: "boolean" }, serial_sticker_visible: { type: "boolean" },
        rtx_4090_likelihood: { type: "integer", description: "0-100" },
        same_model_as_listing: { type: "integer", description: "0-100: the card in the new photo is the same make and model as in the listing photo. 50 if there is no listing photo to compare." },
        notes: { type: "string" },
    } };

const verify = new Action("Verify the seller's photo", ACTORS.verifier);
verify.run = async (job) => {
    const photo = (await job.properties.get("sellerPhoto")) as { path: string; version: number; listingId: string };
    const ch = (await job.properties.get("challenge")) as { code: string; listingId: string };
    const l = BY_ID.get(ch.listingId)!;
    const trail = await trailOf(job);
    const stored = await files.get(photo.path, ACTORS.verifier);
    const sellerUrl = `data:image/jpeg;base64,${Buffer.from(stored.contents).toString("base64")}`;
    const listingSources = l.id === DEMO_ID ? ["local:docs/demo/listing-1.jpg", "local:docs/demo/listing-2.jpg"] : l.image ? [l.image] : [];
    const listingUrls = (await Promise.all(listingSources.map((u) => imageAsDataUrl(u).catch(() => null)))).filter((u): u is string => !!u);
    const listingUrl = listingUrls[0] ?? null;

    // a) text reader + b) vision run in parallel; c) image reuse is free code.
    const [read, same] = await Promise.allSettled([
        readerJSON(MODELS.reader, "You read handwriting in photos exactly as written.", "Read all handwritten text on paper in this photo exactly as written.", [sellerUrl], READ_SCHEMA),
        visionJSON("You verify that a used-GPU seller physically has the card from their listing. A real proof photo shows the physical card in a room with a handwritten code beside it. Scammers who don't have the card often photograph the listing picture on a laptop or phone screen next to the code: look for a screen bezel, glare, moire patterns, visible pixels, and browser or gallery interface (for example 'Gallery (1 of 12)', arrows, a close button, page text). Also say whether the proof photo shows the same photograph as the listing photo.",
            listingUrls.length ? `Images 1-${listingUrls.length} are the original listing photos. The LAST image is the seller's new proof photo (should be the card with a handwritten code). Is the card in the last image the same make and model? Is the serial sticker visible? Is the last image a photo of a screen, or the same photograph as a listing photo?` : "This is the seller's proof photo (the card with a handwritten code). There is no listing photo to compare. Is a card and its serial sticker visible? Is it a photo of a screen?",
            [...listingUrls, sellerUrl], SAME_SCHEMA, { kimiTimeoutMs: 25_000 }),
    ]);

    const checks: Array<{ id: string; label: string; status: "pass" | "fail" | "unknown"; detail: string }> = [];
    // Code: compare the code the reader saw with the one issued.
    let codeStatus: "pass" | "fail" | "unknown" = "unknown";
    if (read.status === "fulfilled" && read.value) {
        const seen = normalize(read.value.data.handwritten_text ?? "").replace(/\s/g, "");
        const want = normalize(ch.code).replace(/\s/g, "");
        // The number must match exactly (4471 is not 4417); the words may have one slip of handwriting.
        const digits = (x: string) => x.replace(/\D/g, "");
        const letters = (x: string) => x.replace(/\d/g, "");
        let dist = seen ? editDistance(letters(seen), letters(want)) : 99;
        for (let i = 0; seen && i + letters(want).length <= letters(seen).length; i++) dist = Math.min(dist, editDistance(letters(seen).slice(i, i + letters(want).length), letters(want)));
        const numberOk = !!seen && digits(seen).includes(digits(want));
        const wordsOk = dist <= 1;
        codeStatus = !seen ? (read.value.data.legible ? "fail" : "unknown") : numberOk && wordsOk ? "pass" : "fail";
        const said = read.value.data.handwritten_text;
        checks.push({ id: "code", label: "Code matches", status: codeStatus,
            detail: !seen ? "No handwritten code found in the photo"
                : codeStatus === "pass" ? `The paper reads "${said}", which matches the code we issued ("${ch.code}")`
                : `The paper reads "${said}", but the code we issued is "${ch.code}"${!numberOk ? " — the number is different" : " — the words are different"}` });
        trail.push(ev({ step: "verify", actor: read.value.meta.model, actorId: ACTORS.verifier.id, actorKind: "model", action: "Read the handwritten code",
            decision: seen ? `Read "${read.value.data.handwritten_text}" → ${codeStatus === "pass" ? "matches" : "does not match"} the issued code` : "No readable code", ...sumCalls([read.value.meta]) }));
    } else {
        checks.push({ id: "code", label: "Code matches", status: "unknown", detail: `Text reader unavailable: ${read.status === "rejected" ? String(read.reason).slice(0, 80) : "no result"}` });
    }
    if (same.status === "fulfilled") {
        const d = same.value.data;
        const sameStatus = !d.card_visible ? "fail" : listingUrl ? (d.same_model_as_listing >= 60 ? "pass" : d.same_model_as_listing < 30 ? "fail" : "unknown") : (d.rtx_4090_likelihood >= 60 ? "pass" : "unknown");
        checks.push({ id: "same", label: listingUrl ? "Same card as listing" : "Card visible", status: sameStatus,
            detail: `${d.card_visible ? "A card is visible" : "No physical card is visible"}; serial sticker ${d.serial_sticker_visible ? "visible" : "not visible"}; ${listingUrl ? `same model as the listing ${d.same_model_as_listing}%` : `RTX 4090 ${d.rtx_4090_likelihood}%`}.`.slice(0, 260) });
        const screenFail = d.photo_of_screen || d.same_photo_as_listing >= 70;
        checks.push({ id: "screen", label: "Real photo, not a screen or a reused listing image", status: screenFail ? "fail" : "pass",
            detail: screenFail
                ? [d.photo_of_screen ? `This is a photo of a screen, not of the card${d.screen_evidence ? ` (${d.screen_evidence})` : ""}` : "",
                   d.same_photo_as_listing >= 70 ? `It shows the listing's own photo (${d.same_photo_as_listing}% match), re-shot rather than a new picture of the card` : ""].filter(Boolean).join(". ")
                : "Looks like a fresh photo of a physical object, not a screen or a listing image" });
        trail.push(ev({ step: "verify", actor: same.value.meta.model, actorId: ACTORS.verifier.id, actorKind: "model", action: "Compared the photo with the listing",
            decision: `${checks[checks.length - 2].detail} | ${checks[checks.length - 1].detail}`.slice(0, 400), ...sumCalls([same.value.meta]) }));
    } else {
        checks.push({ id: "same", label: "Same card as listing", status: "unknown", detail: `Vision unavailable: ${String(same.reason).slice(0, 80)}` });
        checks.push({ id: "screen", label: "Real photo, not a screen or a reused listing image", status: "unknown", detail: "Vision unavailable, so this wasn't checked" });
    }
    // Code: is this photo a copy of a photo from any listing in the haystack?
    let reuse = { status: "unknown" as "pass" | "fail" | "unknown", detail: "Could not read the photo" };
    try {
        const h = dhashJpeg(stored.contents);
        let best = { id: "", dist: 65 };
        for (const [id, hh] of Object.entries(IMAGE_HASHES)) { const dd = hamming(h, hh); if (dd < best.dist) best = { id, dist: dd }; }
        const match = BY_ID.get(best.id.split("#")[0]);
        reuse = best.dist <= 10 && match
            ? { status: "fail", detail: `This is a copy of the photo from ${best.id.split("#")[0] === l.id ? "this same listing" : `another listing ("${match.title.slice(0, 60)}", ${match.source})`} — ${best.dist}/64 bits differ` }
            : { status: "pass", detail: `Not an exact copy of any of the ${Object.keys(IMAGE_HASHES).length} listing photos on file (closest differs by ${best.dist}/64 bits; a re-shoot off a screen is caught by the vision check above)` };
    } catch (e) { reuse.detail = `Could not hash the photo: ${String(e).slice(0, 60)}`; }
    checks.push({ id: "reverse", label: "Not a copied file", status: reuse.status, detail: reuse.detail });
    trail.push(ev({ step: "verify", actor: "Code: image-reuse-check", actorId: ACTORS.verifier.id, actorKind: "code", action: "Checked for a reused photo", decision: reuse.detail }));
    checks.push({ id: "ai-image", label: "AI-generated image check", status: "unknown", detail: "Not checked in this version" });

    // Jev combines the checks into one verdict.
    const state = `A buyer asked a private seller to prove they have the card by photographing its serial sticker beside a handwritten code.\n` +
        checks.map((c) => `- ${c.label}: ${c.status.toUpperCase()} — ${c.detail}`).join("\n");
    let scenario = "unverified" as "verified" | "unverified" | "failed";
    let confidence = 50;
    let model = "Code (Jev unavailable)";
    try {
        const { answers, meta } = await jev(state, { verdict: { type: "choice", instructions: "What is the verification outcome?", criteria: {
            verified: "Every essential check passed: the code matches, the card is visible and matches the listing, the photo is not reused",
            unverified: "Nothing contradicts the claim, but at least one essential check could not be confirmed",
            failed: "At least one check contradicts the claim: wrong or missing code, a different card, a photo of a screen, or a photo copied from a listing" } } });
        scenario = (answers.verdict?.choice as typeof scenario) ?? "unverified";
        confidence = Math.round((answers.verdict?.confidence ?? 0.5) * 100);
        model = meta.model;
        trail.push(ev({ step: "verify", actor: meta.model, actorId: ACTORS.verifier.id, actorKind: "model", action: "Combined the checks into a verdict",
            decision: `${scenario === "failed" ? "Failed verification" : scenario === "verified" ? "Verified" : "Unverified"} (${confidence}% confidence)`, ...sumCalls([meta]) }));
    } catch (e) {
        trail.push(ev({ step: "verify", actor: "Code: verdict-rule", actorId: ACTORS.verifier.id, actorKind: "code", action: "Combined the checks (Jev unavailable)", decision: String(e).slice(0, 100) }));
    }
    // Code guard: a contradicting check can never come out "Verified".
    // Code guard: a check that contradicts the claim always means Failed verification.
    const failedChecks = checks.filter((c) => c.status === "fail");
    if (scenario !== "failed" && failedChecks.length) {
        trail.push(ev({ step: "verify", actor: "Code: verdict-rule", actorId: ACTORS.verifier.id, actorKind: "code", action: "Applied the contradiction rule",
            decision: `Jev said ${scenario}, but a check contradicts the claim (${failedChecks.map((c) => c.label).join("; ")}) → Failed verification` }));
        scenario = "failed";
    }
    const reasons = failedChecks.map((c) => c.detail);
    return new Map<string, any>([["verdict", { scenario, confidence, checks, reasons, model, simulated: false, photoVersion: photo.version, listingId: ch.listingId }], ["trail", trail]]);
};

// ---------- 9. buyer_decision (HUMAN) ----------

const buyerDecision = new Await("Buyer decides", "HUMAN", "Go meet the seller (or open the ShopGoodwill listing), or walk away");
buyerDecision.fields = ["decision"];
buyerDecision.resolveUrl = (job) => `/hunt?id=${job.id}`;

// ---------- Transitions ----------

const get = (job: Job, k: string) => job.properties.get(k);
const reselected = async (job: Job) => (await get(job, "selectedListingId")) !== (await get(job, "targetListingId"));
const newPhoto = async (job: Job) => {
    const p = await get(job, "sellerPhoto"), v = await get(job, "verdict"), t = await get(job, "targetListingId");
    return !!p && p.listingId === t && p.version > (v?.listingId === t ? v.photoVersion : 0);
};

export const hunts = new StateMachine("hunt", [
    new State("expand", [expand], [
        new Transition("no_finds", async (j) => (await get(j, "supported")) === false),
        new Transition("screen"),
    ]),
    new State("screen", [screen], [new Transition("look")]),
    new State("look", [look], [
        new Transition("no_finds", async (j) => ((await get(j, "candidates")) ?? []).length === 0),
        new Transition("coach"),
    ]),
    new State("coach", [coach], [new Transition("buyer_review")]),
    new State("buyer_review", [buyerReview], [new Transition("route", async (j) => !!(await get(j, "selectedListingId")))]),
    new State("route", [route], [
        new Transition("buyer_decision", async (j) => (await get(j, "routeTo")) === "goodwill"),
        new Transition("challenge"),
    ]),
    new State("challenge", [challenge], [new Transition("seller_photo")]),
    new State("seller_photo", [sellerPhoto], [
        new Transition("route", reselected),
        new Transition("verify", newPhoto),
        new Transition("decided", async (j) => !!(await get(j, "decision"))), // e.g. walked away before any photo
    ]),
    new State("verify", [verify], [new Transition("buyer_decision")]),
    new State("buyer_decision", [buyerDecision], [
        new Transition("route", reselected),
        new Transition("verify", newPhoto),
        new Transition("decided", async (j) => !!(await get(j, "decision"))),
    ]),
    new Terminal("decided", Terminal.Outcome.SUCCESS),
    new Terminal("no_finds", Terminal.Outcome.SUCCESS),
], "expand", schema, persistence);
