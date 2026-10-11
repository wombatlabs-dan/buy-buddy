// Probe each model route once (Jev, Kimi vision on Workers AI, Gemini reader on
// OpenRouter) and print outcome, latency and cost — never the keys.
// Locally the secret store reads CLOUDFLARE_AI_TOKEN and OPENROUTER_KEY from the environment.
// Run: npx tsx scripts/probe-models.ts
import { readFileSync } from "node:fs";
import { MODELS, jev, readerJSON, visionJSON } from "../src/models.js";

const img = (f: string) => `data:image/jpeg;base64,${readFileSync(f).toString("base64")}`;
const show = (name: string, p: Promise<{ meta: any; [k: string]: any }>) =>
    p.then((r) => console.log(`OK   ${name}: ${r.meta.model} ${r.meta.latencyMs}ms cost=${r.meta.costUsd}${r.meta.fallbackFrom ? ` (fell back from ${r.meta.fallbackFrom})` : ""}\n     ${JSON.stringify(r.data ?? r.answers).slice(0, 400)}`))
        .catch((e) => console.log(`FAIL ${name}: ${String(e).slice(0, 300)}`));

await show("reader (wrong-code.jpg)", readerJSON(MODELS.reader, "You read handwriting in photos exactly as written.", "Read all handwritten text on paper in this photo exactly as written.",
    [img("docs/demo/challenge-wrong-code.jpg")], { type: "object", additionalProperties: false, required: ["handwritten_text", "legible"], properties: { handwritten_text: { type: "string" }, legible: { type: "boolean" } } }));
await show("jev", jev("Listing title: Rtx 4090 For repair or parts. Price $700.", {
    is_target: { type: "noul", instructions: "Is this listing selling an RTX 4090 card itself?", criteria: { true: "Sells the card", false: "Sells something else" } },
}) as any);
await show("reader (fail.jpg)", readerJSON(MODELS.reader, "You read handwriting in photos exactly as written.", "Read all handwritten text on paper in this photo exactly as written.",
    [img("docs/demo/challenge-fail.jpg")], { type: "object", additionalProperties: false, required: ["handwritten_text", "legible"], properties: { handwritten_text: { type: "string" }, legible: { type: "boolean" } } }));
await show("vision kimi (screen check)", visionJSON("Is the LAST image a photo of a screen showing the listing photo? Look for bezel, glare, moire, browser/gallery UI.",
    "Images 1 is the listing photo; the last image is the proof photo.", [img("docs/demo/listing-1.jpg"), img("docs/demo/challenge-fail.jpg")],
    { type: "object", additionalProperties: false, required: ["photo_of_screen", "screen_evidence", "same_photo_as_listing"], properties: { photo_of_screen: { type: "boolean" }, screen_evidence: { type: "string" }, same_photo_as_listing: { type: "integer", description: "0-100: the proof photo contains or displays one of the listing photos (same picture), for example shown on a screen and photographed again. 0 if genuinely new." } } }));
