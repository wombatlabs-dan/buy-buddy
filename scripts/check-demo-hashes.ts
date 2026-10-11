// Adds the demo fixture photo hashes to data/image-hashes.json and checks that
// the app's JPEG hasher agrees with the precompute (sharp) on the same file.
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { dhashRaw, dhashJpeg, hamming } from "../src/dhash.js";
const h = JSON.parse(readFileSync("data/image-hashes.json", "utf8"));
for (const [k, f] of [["demo-ebay-128125153911", "docs/demo/listing-1.jpg"], ["demo-ebay-128125153911#2", "docs/demo/listing-2.jpg"]]) {
    const { data, info } = await sharp(readFileSync(f)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    h[k] = dhashRaw(new Uint8Array(data), info.width, info.height, info.channels);
}
writeFileSync("data/image-hashes.json", JSON.stringify(h));
const j = dhashJpeg(new Uint8Array(readFileSync("docs/demo/listing-1.jpg")));
console.log("jpeg-js vs sharp on listing-1 (want ~0):", hamming(j, h["demo-ebay-128125153911"]));
const f = dhashJpeg(new Uint8Array(readFileSync("docs/demo/challenge-fail.jpg")));
console.log("challenge-fail vs listing-1 (re-shoot, expected large):", hamming(f, h["demo-ebay-128125153911"]));
