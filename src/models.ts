// Every model call Buy Buddy makes goes through this file, so each one is
// timed and costed the same way and lands on the hunt's trust record.
//
// Providers (no Anthropic API key, no Meta/Llama models — product rules):
//   - Jev (TypeSafe) on Cloudflare Workers AI — fast typed yes/no, choice and score answers
//   - Kimi K2.6 on Cloudflare Workers AI — vision (photos)
//   - OpenRouter — GLM (search variants), Gemini Flash (coaching, text reading),
//     and the fallback route for vision if Workers AI fails
// Keys come from the Anbaric secret store, never from code or the front end.
import { Agent, Code, SecretStoreFactory, type AgentRequest } from "anbaric";

const CF_ACCOUNT = "22bb00110b044861ce53a223ab39d1cf"; // WombatLabs Cloudflare account (never Steadfast)
const secrets = SecretStoreFactory.instance();
const secretReader = new Code("secret-reader", "code");
const secretCache = new Map<string, string>();

async function secret(name: string): Promise<string> {
    const hit = secretCache.get(name);
    if (hit) return hit;
    const value = await secrets.retrieve(name, secretReader);
    secretCache.set(name, value);
    return value;
}

// Model identifiers, in one place so the trust record and code agree.
export const MODELS = {
    jev: "typesafe/jev",
    kimiVision: "@cf/moonshotai/kimi-k2.6",
    expander: "z-ai/glm-5.3-flash",
    coach: "google/gemini-3.8-flash",
    reader: "google/gemini-3.8-flash",
    visionFallback: "google/gemini-3.8-flash",
};

// Published list prices (USD per 1M tokens) for providers that don't return a cost.
// Jev: https://developers.cloudflare.com/ai/models/typesafe/jev/ ($0.042 input, $0 output).
// OpenRouter calls report their own cost per call, so they need no table.
const CF_PRICES: Record<string, { input: number; output: number } | undefined> = {
    "typesafe/jev": { input: 0.042, output: 0 },
};

export interface CallMeta {
    model: string;
    provider: "Cloudflare Workers AI" | "OpenRouter";
    costUsd: number | null; // null = provider didn't report it and no published price on file
    latencyMs: number;
    inputTokens?: number;
    outputTokens?: number;
}

function cfCost(model: string, inTok?: number, outTok?: number): number | null {
    const p = CF_PRICES[model];
    if (!p || inTok === undefined) return null;
    return (inTok * p.input + (outTok ?? 0) * p.output) / 1_000_000;
}

// ---------- Jev ----------

export type JevQuestion =
    | { type: "noul"; instructions: string; criteria: { true: string; false: string } }
    | { type: "choice"; instructions: string; criteria: Record<string, string> }
    | { type: "score"; instructions: string; criteria: string[] };

export interface JevAnswers {
    [key: string]: { type: string; noul?: number; choice?: string; confidence?: number; score?: number; probabilities?: Record<string, number> };
}

/** Ask Jev typed questions about one piece of text ("state"). */
export async function jev(state: string, questions: Record<string, JevQuestion>): Promise<{ answers: JevAnswers; meta: CallMeta }> {
    const token = await secret("cloudflare-ai-token");
    const t0 = Date.now();
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${MODELS.jev}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ state: state.slice(0, 60_000), questions }),
        signal: AbortSignal.timeout(30_000),
    });
    const latencyMs = Date.now() - t0;
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false) throw new Error(`Jev failed (${res.status}): ${JSON.stringify(body.errors ?? body).slice(0, 200)}`);
    const r = body.result ?? body;
    const inTok = r.usage?.input_tokens, outTok = r.usage?.output_tokens;
    return {
        answers: r.answers,
        meta: { model: `${MODELS.jev} (${r.model ?? "jev"})`, provider: "Cloudflare Workers AI", latencyMs, costUsd: cfCost(MODELS.jev, inTok, outTok), inputTokens: inTok, outputTokens: outTok },
    };
}

// ---------- Chat models (JSON out) ----------

export type ChatContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
export interface ChatMessage { role: "system" | "user" | "assistant"; content: ChatContent }

/** Pull the first JSON object out of a model reply (tolerates code fences and preambles). */
function parseJsonReply(text: string): any {
    const cleaned = text.replace(/```(?:json)?/g, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error(`Model reply was not JSON: ${text.slice(0, 160)}`);
    return JSON.parse(cleaned.slice(start, end + 1));
}

async function openRouterJSON(model: string, messages: ChatMessage[], schema: object, timeoutMs = 60_000): Promise<{ data: any; meta: CallMeta }> {
    const key = await secret("openrouter-key");
    const t0 = Date.now();
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "content-type": "application/json", "X-Title": "Buy Buddy" },
        body: JSON.stringify({
            model,
            messages,
            response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema } },
            usage: { include: true },
            temperature: 0.2,
        }),
        signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Date.now() - t0;
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || body.error) throw new Error(`OpenRouter ${model} failed (${res.status}): ${JSON.stringify(body.error ?? body).slice(0, 200)}`);
    const text = body.choices?.[0]?.message?.content ?? "";
    return {
        data: parseJsonReply(text),
        meta: {
            model, provider: "OpenRouter", latencyMs,
            costUsd: typeof body.usage?.cost === "number" ? body.usage.cost : null,
            inputTokens: body.usage?.prompt_tokens, outputTokens: body.usage?.completion_tokens,
        },
    };
}

async function workersAiJSON(model: string, messages: ChatMessage[], timeoutMs = 60_000): Promise<{ data: any; meta: CallMeta }> {
    const token = await secret("cloudflare-ai-token");
    const t0 = Date.now();
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, temperature: 0.2, max_tokens: 1500 }),
        signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Date.now() - t0;
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false || body.error) throw new Error(`Workers AI ${model} failed (${res.status}): ${JSON.stringify(body.errors ?? body.error ?? body).slice(0, 200)}`);
    const msg = body.choices?.[0]?.message ?? body.result?.choices?.[0]?.message;
    const text: string = msg?.content ?? body.result?.response ?? "";
    const usage = body.usage ?? body.result?.usage;
    return {
        data: parseJsonReply(text),
        meta: {
            model, provider: "Cloudflare Workers AI", latencyMs,
            costUsd: cfCost(model, usage?.prompt_tokens, usage?.completion_tokens),
            inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens,
        },
    };
}

/** Text-only structured call via OpenRouter. */
export function chatJSON(model: string, system: string, user: string, schema: object): Promise<{ data: any; meta: CallMeta }> {
    return openRouterJSON(model, [{ role: "system", content: system }, { role: "user", content: user }], schema);
}

/** Image + text structured call on OpenRouter (used for the handwriting reader). */
export function readerJSON(model: string, system: string, text: string, imageDataUrls: string[], schema: object): Promise<{ data: any; meta: CallMeta }> {
    return openRouterJSON(model, [{ role: "system", content: system },
        { role: "user", content: [{ type: "text", text }, ...imageDataUrls.map((url) => ({ type: "image_url" as const, image_url: { url } }))] }], schema);
}

/**
 * Vision call: Kimi K2.6 on Workers AI first; if that fails, the same request
 * goes to Gemini Flash on OpenRouter. The meta says which model actually answered,
 * plus `fallbackFrom` when the first choice failed.
 */
export async function visionJSON(system: string, text: string, imageDataUrls: string[], schema: object): Promise<{ data: any; meta: CallMeta & { fallbackFrom?: string } }> {
    const content: ChatContent = [{ type: "text", text }, ...imageDataUrls.map((url) => ({ type: "image_url" as const, image_url: { url } }))];
    const messages: ChatMessage[] = [
        { role: "system", content: `${system}\nReply with one JSON object matching this JSON Schema, and nothing else:\n${JSON.stringify(schema)}` },
        { role: "user", content },
    ];
    try {
        return await workersAiJSON(MODELS.kimiVision, messages, 45_000);
    } catch (e) {
        console.warn(`vision: Kimi on Workers AI failed, falling back: ${String(e).slice(0, 200)}`);
        const r = await openRouterJSON(MODELS.visionFallback, messages, schema);
        return { data: r.data, meta: { ...r.meta, fallbackFrom: `${MODELS.kimiVision} (${String(e).slice(0, 80)})` } };
    }
}

/** Fetch an image (listing photo) and return it as a data URL the vision models accept. */
export async function imageAsDataUrl(url: string): Promise<string> {
    if (url.startsWith("local:")) {
        // Demo fixture photos live in the repo (docs/demo/)
        const { readFile } = await import("node:fs/promises");
        const { ROOT } = await import("./haystack.js");
        const buf = await readFile(`${ROOT}/${url.slice(6)}`);
        return `data:image/jpeg;base64,${buf.toString("base64")}`;
    }
    const res = await fetch(url.replace(/\\/g, "/"), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`image fetch ${res.status}`);
    const type = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
}

// ---------- Anbaric actor identities ----------
// Each AI step runs as a named Anbaric Agent so the platform's audit trail
// attributes its writes to that model. The client lets the agent also be used
// with Anbaric's own agentic actions; Buy Buddy's steps call the helpers above.
class OpenRouterClient extends Agent.Client {
    constructor(private model: string) { super(); }
    async generate(request: AgentRequest): Promise<Record<string, any>> {
        const r = await openRouterJSON(this.model, request.messages as ChatMessage[], request.outputSchema);
        return r.data;
    }
}

// Jev answers typed questions (yes/no, choice, score), not free-form JSON, so its
// actor's client says so rather than pretending to be a chat model. Screening and
// verification call jev() directly.
class JevClient extends Agent.Client {
    async generate(): Promise<Record<string, any>> {
        throw new Error(`${MODELS.jev} answers typed questions only; call jev(state, questions)`);
    }
}

export const ACTORS = {
    expander: new Agent("expander-glm-5.3-flash", "search", new OpenRouterClient(MODELS.expander)),
    screener: new Agent("screener-jev", "screening", new JevClient()),
    // Vision runs Kimi K2.6 on Workers AI via visionJSON(); this client is the OpenRouter fallback route.
    looker: new Agent("vision-kimi-k2.6", "vision", new OpenRouterClient(MODELS.visionFallback)),
    coach: new Agent("coach-gemini-3.8-flash", "coaching", new OpenRouterClient(MODELS.coach)),
    // Verification combines several models (reader, vision, Jev); each call is named on the trail.
    verifier: new Agent("verifier-kimi-gemini-jev", "verification", new OpenRouterClient(MODELS.reader)),
    matcher: new Code("haystack-matcher", "code"),
    router: new Code("shopgoodwill-rule", "code"),
    challenger: new Code("challenge-issuer", "code"),
};
