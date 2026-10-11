// Live provider: talks to the Buy Buddy backend (/api on the same origin, an
// Anbaric app). The backend is the source of truth for the hunt, its candidates,
// the challenge, the verdict and the trust record. A failed live request shows
// an error; it never turns into sample data.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChallengeCheck, Listing } from "./types";

export interface LiveEvent {
  id: string;
  at: string;
  step: string;
  actor: string;
  actorId: string;
  actorKind: "model" | "code" | "you";
  action: string;
  decision: string;
  modelCost: number;
  costKnown: boolean;
  latencyMs?: number;
  calls?: number;
  serviceFee?: number;
}

export interface LiveVerdict {
  scenario: "verified" | "unverified" | "failed";
  confidence: number;
  checks: ChallengeCheck[];
  model: string;
  simulated: false;
  photoVersion: number;
  listingId: string;
}

export interface Rejected { id: string; title: string; price: number; source: string; listingUrl: string; reason: string; jev: number }

export interface LiveHunt {
  id: string;
  state: string;
  status: string; // "active" | "Awaiting input" | "Failed" | "Stalled"
  waitingFor: string | null;
  query: string;
  maxPrice: number;
  plan: "per-hunt" | "monthly";
  supported: boolean;
  message: string | null;
  goingPrice: number | null;
  goingPriceSource: string | null;
  funnel: { scanned?: number; matched?: number; pool?: number; screened?: number; jevPassed?: number; visionChecked?: number; candidates?: number; finalists?: number };
  variants: Array<{ phrase: string; kind: string }>;
  candidates: Listing[];
  finalistIds: string[];
  rejected: Rejected[];
  selectedListingId: string | null;
  targetListingId: string | null;
  challenge: { listingId: string; code: string; shot: string; issuedAt: string } | null;
  sellerPhoto: { version: number; listingId: string; at: string } | null;
  verdict: LiveVerdict | null;
  decision: { choice: "meet" | "walk" | "goodwill"; at: string; by: string; listingId: string } | null;
  trail: LiveEvent[];
  startedAt: string;
  buyer: string;
  data: { label: string; capturedAt: string };
}

const TERMINAL = new Set(["decided", "no_finds"]);
/** Nothing more will happen without a person: parked on an await, ended, or failed. */
export const isSettled = (h: LiveHunt) => h.status !== "active" || TERMINAL.has(h.state);
export const isFailed = (h: LiveHunt) => h.status === "Failed" || h.status === "Stalled";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`, { credentials: "same-origin", ...init });
  // A lapsed session answers a POST with 401: reload (a GET re-authenticates).
  if (res.status === 401) throw new ApiError("Your sign-in has expired. Reload the page to sign in again.", 401);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

const post = <T,>(path: string, body: unknown) =>
  call<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const liveApi = {
  mode: "live" as const,
  me: () => call<{ id: string }>("api/me"),
  createHunt: (input: { query: string; maxPrice: number; plan: "per-hunt" | "monthly" }) => post<{ huntId: string }>("api/hunts", input),
  getHunt: (id: string) => call<LiveHunt>(`api/hunts/${id}`),
  select: (id: string, listingId: string) => post<{ ok: true }>(`api/hunts/${id}/select`, { listingId }),
  decide: (id: string, choice: "meet" | "walk" | "goodwill") => post<{ ok: true }>(`api/hunts/${id}/decision`, { choice }),
  async uploadPhoto(id: string, file: File): Promise<{ version: number }> {
    const jpeg = await toJpeg(file);
    return call(`api/hunts/${id}/photo`, { method: "POST", headers: { "content-type": "image/jpeg" }, body: jpeg });
  },
};

/** Downscale a photo to a JPEG of at most 1600 px (phones send 5-10 MB originals). */
export async function toJpeg(file: File, max = 1600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error("This browser can't read that image. Try a JPG or PNG."));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("Couldn't prepare the photo."))), "image/jpeg", 0.88));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- polling ----------
// Poll once a second while the hunt is working, or while we're waiting for the
// effect of something the buyer just did; stop when it settles, and give up
// (saying so) after a few minutes rather than spinning forever.

let expecting: { until: number; done: (h: LiveHunt) => boolean } | null = null;
const GIVE_UP_MS = 3 * 60 * 1000;

export function useLiveHunt(id: string | undefined) {
  return useQuery({
    queryKey: ["live-hunt", id],
    queryFn: () => liveApi.getHunt(id!),
    enabled: !!id,
    retry: (n, e) => !(e instanceof ApiError && [401, 403, 404].includes(e.status)) && n < 2,
    refetchInterval: (q) => {
      const h = q.state.data as LiveHunt | undefined;
      if (!h) return 1000;
      if (expecting) {
        if (expecting.done(h) || Date.now() > expecting.until) expecting = null;
        else return 1000;
      }
      if (isSettled(h)) return false;
      return Date.now() - new Date(h.startedAt).getTime() > GIVE_UP_MS ? false : 1000;
    },
  });
}

/** After an action, keep polling until `done` holds (or a minute passes). */
export function useExpect() {
  const qc = useQueryClient();
  return (id: string, done: (h: LiveHunt) => boolean) => {
    expecting = { until: Date.now() + 60_000, done };
    void qc.invalidateQueries({ queryKey: ["live-hunt", id] });
  };
}

/** Human-readable progress for a working hunt. */
export function stageText(h: LiveHunt): string {
  const f = h.funnel;
  switch (h.state) {
    case "expand": return "Expanding the search: misspellings, plain-language descriptions, whole PCs and thrift-store lots...";
    case "screen": return `Jev is screening ${f.pool ?? "the"} listings: is this really the card, and are there scam signals?`;
    case "look": return `${f.jevPassed ?? "The"} likely matches passed Jev. Vision is checking photos for a 4090 hidden in PCs, lots and mislabeled listings...`;
    case "coach": return `${f.candidates ?? ""} candidates. Writing fit questions, seller questions and a vetting checklist for the finalists...`;
    default: return "Working...";
  }
}
