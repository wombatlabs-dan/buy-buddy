// One-off: download every haystack listing photo and record its dHash in
// data/image-hashes.json, so the deployed app can check whether a seller's
// "proof" photo is really a copy of a photo from another listing.
// Run locally: npx tsx scripts/hash-haystack-images.ts
// (sharp is a dev dependency used only here; the app itself uses jpeg-js.)
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { dhashRaw } from "../src/dhash.js";

type L = { id: string; image: string | null };
const listings: L[] = JSON.parse(readFileSync("data/haystack.json", "utf8")).listings;
const out: Record<string, string> = {};
let ok = 0, failed = 0;

async function one(l: L) {
    if (!l.image) return;
    try {
        const res = await fetch(l.image.replace(/\\/g, "/"), { signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        out[l.id] = dhashRaw(new Uint8Array(data), info.width, info.height, info.channels);
        ok++;
    } catch (e) {
        failed++;
        console.error(l.id, String(e));
    }
}

// The demo fixture's own photos (docs/demo/), keyed "<id>" and "<id>#2"
for (const [k, f] of [["demo-ebay-128125153911", "docs/demo/listing-1.jpg"], ["demo-ebay-128125153911#2", "docs/demo/listing-2.jpg"]]) {
    const { data, info } = await sharp(readFileSync(f)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    out[k] = dhashRaw(new Uint8Array(data), info.width, info.height, info.channels);
}
const queue = [...listings];
await Promise.all(Array.from({ length: 8 }, async () => { while (queue.length) await one(queue.shift()!); }));
writeFileSync("data/image-hashes.json", JSON.stringify(out, null, 0));
console.log(`hashed ${ok}, failed ${failed}`);
