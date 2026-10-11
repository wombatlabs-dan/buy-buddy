// Buy Buddy — one Anbaric app that serves:
//   1. the built front end (Kevin's React app, copied into static/) as files, and
//   2. a JSON API under /api,
// from the same origin, so there is no CORS. The platform puts the app behind
// Anbaric sign-in; every human decision is attributed to the signed-in buyer.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Human, Job } from "anbaric";
import { hunts, persistence, files, ev, type TrailEvent, type ListingView } from "./hunt.js";
import { BY_ID, HAYSTACK_CAPTURED_AT, HAYSTACK_LABEL, ROOT } from "./haystack.js";

const port = Number(process.env.PORT ?? 3000);
const deployed = !!process.env.ANBARIC_APP_ID;
const STATIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "static");
const MAX_PHOTO = 8 * 1024 * 1024;

// ---------- helpers ----------

function json(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
        size += (c as Buffer).length;
        if (size > limit) throw Object.assign(new Error("Body too large"), { status: 413 });
        chunks.push(c as Buffer);
    }
    return Buffer.concat(chunks);
}

async function readJson(req: IncomingMessage): Promise<any> {
    const b = await readBody(req, 64 * 1024);
    try { return JSON.parse(b.toString("utf8") || "{}"); } catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
}

/** The signed-in buyer. Locally there is no platform session, so a dev identity stands in. */
async function buyer(req: IncomingMessage): Promise<Human | null> {
    try {
        return await Human.fromSession(req);
    } catch {
        return deployed ? null : new Human("local-dev", "buyer");
    }
}

const fee = (going: number) => Math.min(49, Math.max(9, Math.round(going * 0.02 * 100) / 100));

/** A hunt as the front end sees it. Only the buyer who started it may read it. */
async function huntView(id: string, who: Human) {
    const job = await persistence.retrieve(id, who);
    const p = await job.properties.toMap();
    if (p.get("buyer") !== who.id) throw Object.assign(new Error("Not your hunt"), { status: 403 });
    const candidates = (p.get("candidates") as ListingView[] | undefined) ?? [];
    return {
        id: job.id,
        state: job.state,
        status: job.status, // "active" | "Awaiting input" | "Failed" | "Stalled"
        waitingFor: job.status === Job.Status.AWAITING_INPUT ? job.state : null,
        query: p.get("query"), maxPrice: p.get("maxPrice"), plan: p.get("plan") ?? "per-hunt",
        supported: p.get("supported") ?? true, message: p.get("message") ?? null,
        goingPrice: p.get("goingPrice") ?? null, goingPriceSource: p.get("goingPriceSource") ?? null,
        funnel: p.get("funnel") ?? {}, variants: p.get("variants") ?? [],
        candidates, finalistIds: p.get("finalistIds") ?? [], rejected: p.get("rejected") ?? [],
        selectedListingId: p.get("selectedListingId") ?? null, targetListingId: p.get("targetListingId") ?? null,
        challenge: p.get("challenge") ?? null,
        sellerPhoto: p.get("sellerPhoto") ? { version: p.get("sellerPhoto").version, listingId: p.get("sellerPhoto").listingId, at: p.get("sellerPhoto").at } : null,
        verdict: p.get("verdict") ?? null, decision: p.get("decision") ?? null,
        trail: (p.get("trail") as TrailEvent[] | undefined) ?? [],
        startedAt: job.startedAt, buyer: who.id,
        data: { label: HAYSTACK_LABEL, capturedAt: HAYSTACK_CAPTURED_AT },
    };
}

/** Read the trail, append a human event, and apply the update as that human. */
async function humanUpdate(id: string, who: Human, changes: Map<string, any>, event: Omit<TrailEvent, "id" | "at" | "modelCost" | "costKnown" | "actor" | "actorId" | "actorKind">) {
    const job = await persistence.retrieve(id, who, ["trail"]);
    const trail = ((await job.properties.get("trail")) as TrailEvent[] | undefined) ?? [];
    trail.push(ev({ ...event, actor: who.id, actorId: who.id, actorKind: "you" }));
    changes.set("trail", trail);
    await hunts.updateJob(id, changes, who);
}

// ---------- API ----------

async function api(req: IncomingMessage, res: ServerResponse, url: URL) {
    const who = await buyer(req);
    if (!who) return json(res, 401, { error: "Sign in to Anbaric to use Buy Buddy." });
    const parts = url.pathname.split("/").filter(Boolean); // ["api", "hunts", id, action]

    if (url.pathname === "/api/me") return json(res, 200, { id: who.id, roles: who.roles, deployed });

    if (url.pathname === "/api/hunts" && req.method === "POST") {
        const b = await readJson(req);
        const query = String(b.query ?? "").trim();
        const maxPrice = Number(b.maxPrice);
        const plan = b.plan === "monthly" ? "monthly" : "per-hunt";
        if (query.length < 2 || query.length > 120) return json(res, 400, { error: "Tell us what you're looking for." });
        if (!(maxPrice > 0 && maxPrice <= 100000)) return json(res, 400, { error: "Enter a max price above $0." });
        const going = /4090/.test(query.replace(/\s/g, "")) ? 2500 : 0;
        const trail: TrailEvent[] = [
            ev({ step: "start", actor: who.id, actorId: who.id, actorKind: "you", action: "Started a hunt", decision: `Looking for "${query}" up to $${maxPrice}` }),
        ];
        if (going) trail.push(ev({ step: "start", actor: "Code: pricing", actorId: "pricing", actorKind: "code", action: "Priced the hunt",
            decision: plan === "monthly" ? "Covered by the $14.99/month plan (demo, no charge)" : `Service fee $${fee(going)} = 2% of the $${going} going price, capped at $49 (demo, no charge)`,
            serviceFee: plan === "monthly" ? 0 : fee(going) }));
        const job = await hunts.startJob(new Map<string, any>([["query", query], ["maxPrice", maxPrice], ["plan", plan], ["buyer", who.id], ["trail", trail]]), who);
        return json(res, 201, { huntId: job.id });
    }

    if (parts[0] === "api" && parts[1] === "hunts" && parts[2]) {
        const id = parts[2];
        let view = await huntView(id, who); // also checks ownership
        const action = parts[3];
        if (!action && req.method === "GET") return json(res, 200, view);
        // A job that just moved into a waiting step is briefly "active" before it parks.
        // Give it a few seconds to settle so a quick click isn't refused.
        for (let i = 0; i < 16 && view.status === Job.Status.ACTIVE && !["decided", "no_finds"].includes(view.state); i++) {
            await new Promise((r) => setTimeout(r, 500));
            view = await huntView(id, who);
        }
        const parked = view.status === Job.Status.AWAITING_INPUT;

        if (action === "select" && req.method === "POST") {
            const { listingId } = await readJson(req);
            const c = view.candidates.find((x) => x.id === listingId);
            if (!c) return json(res, 400, { error: "That listing isn't one of this hunt's candidates." });
            if (!parked || !["buyer_review", "seller_photo", "buyer_decision"].includes(view.state)) return json(res, 409, { error: "The hunt is busy; try again in a moment." });
            if (view.selectedListingId === listingId && view.state !== "buyer_review") return json(res, 202, { ok: true, unchanged: true });
            await humanUpdate(id, who, new Map([["selectedListingId", listingId]]),
                { step: "buyer_review", action: "Picked a listing to pursue", decision: `"${c.originalTitle}" (${c.source}, $${c.price})` });
            return json(res, 202, { ok: true });
        }

        if (action === "photo" && req.method === "POST") {
            if (!parked || !["seller_photo", "buyer_decision"].includes(view.state) || !view.challenge || view.challenge.listingId !== view.targetListingId)
                return json(res, 409, { error: "There's no open photo challenge for this listing yet." });
            const body = await readBody(req, MAX_PHOTO);
            if (body.length < 4 || body[0] !== 0xff || body[1] !== 0xd8) return json(res, 400, { error: "Upload the photo as a JPEG." });
            const version = (view.sellerPhoto?.listingId === view.targetListingId ? view.sellerPhoto!.version : 0) + 1;
            const filePath = `hunts/${id}/seller-photo-${view.targetListingId}-v${version}.jpg`;
            await files.put(who, filePath, new Uint8Array(body), "image/jpeg");
            await humanUpdate(id, who,
                new Map([["sellerPhoto", { path: filePath, version, listingId: view.targetListingId, at: new Date().toISOString(), bytes: body.length }]]),
                { step: "seller_photo", action: "Uploaded the seller's photo", decision: `Photo ${version} for the challenge "${view.challenge.code}" (${Math.round(body.length / 1024)} KB)` });
            return json(res, 202, { ok: true, version });
        }

        if (action === "decision" && req.method === "POST") {
            const { choice } = await readJson(req);
            if (!["meet", "walk", "goodwill"].includes(choice)) return json(res, 400, { error: "Choose meet, walk or goodwill." });
            if (!parked || !["buyer_decision", "seller_photo"].includes(view.state)) return json(res, 409, { error: "The hunt isn't waiting for your decision." });
            if (choice === "goodwill" && view.state !== "buyer_decision") return json(res, 409, { error: "The hunt isn't waiting for your decision." });
            const l = BY_ID.get(view.targetListingId!)!;
            await humanUpdate(id, who, new Map([["decision", { choice, at: new Date().toISOString(), by: who.id, listingId: l.id }]]), {
                step: "buyer_decision", action: "Made the decision",
                decision: choice === "meet" ? `Go meet the seller of "${l.title}"` : choice === "walk" ? `Walk away from "${l.title}"`
                    : `Opened the ShopGoodwill listing to bid or buy themselves — Buy Buddy placed no bid (${l.url})` });
            return json(res, 202, { ok: true });
        }
    }
    return json(res, 404, { error: "Not found" });
}

// ---------- static front end ----------

const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
    ".json": "application/json", ".woff2": "font/woff2", ".txt": "text/plain",
};

async function serveStatic(res: ServerResponse, pathname: string) {
    const safe = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
    let file = path.join(STATIC_DIR, safe);
    if (!file.startsWith(STATIC_DIR)) return json(res, 403, { error: "Forbidden" });
    let isFile = false;
    try { isFile = (await stat(file)).isFile(); } catch { /* not found */ }
    // Client-side routes (/hunt, /listing/…) get the app shell.
    if (!isFile && safe.startsWith(`${path.sep}assets${path.sep}`)) return json(res, 404, { error: "Not found" });
    if (!isFile) file = path.join(STATIC_DIR, "index.html");
    try {
        const body = await readFile(file);
        const ext = path.extname(file);
        res.writeHead(200, {
            "content-type": TYPES[ext] ?? "application/octet-stream",
            "cache-control": file.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache",
        });
        res.end(body);
    } catch {
        json(res, 404, { error: "Front end not built. Run: npm run build:web" });
    }
}

createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
        if (url.pathname === "/health") return json(res, 200, { ok: true, app: "buy-buddy", time: new Date().toISOString() });
        if (url.pathname.startsWith("/api/")) return await api(req, res, url);
        // Demo fixture listing photos (docs/demo/listing-*.jpg), public sample data
        const demo = url.pathname.match(/^\/demo\/(listing-[12]\.jpg)$/);
        if (demo) {
            const body = await readFile(path.join(ROOT, "docs/demo", demo[1]));
            res.writeHead(200, { "content-type": "image/jpeg", "cache-control": "public, max-age=3600" });
            return void res.end(body);
        }
        if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "Method not allowed" });
        return await serveStatic(res, url.pathname);
    } catch (e: any) {
        const status = e?.status ?? (/No job|not found/i.test(String(e?.message)) ? 404 : 500);
        console.error(`${req.method} ${url.pathname} → ${status}: ${String(e?.message ?? e)}`);
        if (!res.headersSent) json(res, status, { error: status === 500 ? "Something went wrong on our side." : String(e.message) });
    }
}).listen(port, () => console.log(`buy-buddy listening on ${port} (${deployed ? "deployed" : "local"})`));
