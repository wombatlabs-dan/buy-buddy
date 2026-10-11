import { useSyncExternalStore } from "react";
import type { ChallengeVerdict } from "./types";

export interface TrustEvent {
  id: string;
  at: string;
  actor: string; // model name, "Code", or "You"
  actorKind: "model" | "code" | "you";
  action: string;
  decision: string;
  modelCost: number; // illustrative only
  serviceFee?: number;
}

export interface HuntState {
  query: string;
  maxPrice: number;
  startedAt: string;
  plan: "per-hunt" | "monthly";
  answers: Record<string, Record<string, string>>;
  checks: Record<string, Record<string, boolean>>;
  challenges: Record<string, { code: string; verdict?: ChallengeVerdict }>;
  events: TrustEvent[];
  decision?: { listingId: string; choice: "meet" | "walk" | "goodwill"; at: string };
}

const KEY = "buy-buddy:hunt:v1";
let state: HuntState | null = load();
const subs = new Set<() => void>();

function load(): HuntState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v.query !== "string" || typeof v.maxPrice !== "number" || !Array.isArray(v.events)) return null;
    return { answers: {}, checks: {}, challenges: {}, plan: "per-hunt", ...v };
  } catch {
    return null;
  }
}

function set(next: HuntState | null) {
  state = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable; keep in memory */
  }
  subs.forEach((f) => f());
}

export function useHunt() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
  );
}

const nid = () => Math.random().toString(36).slice(2, 10);

export const hunt = {
  get: () => state,
  reset: () => set(null),
  start(query: string, maxPrice: number, plan: HuntState["plan"]) {
    set({ query, maxPrice, plan, startedAt: new Date().toISOString(), answers: {}, checks: {}, challenges: {}, events: [] });
  },
  log(e: Omit<TrustEvent, "id" | "at">) {
    if (!state) return;
    set({ ...state, events: [...state.events, { ...e, id: nid(), at: new Date().toISOString() }] });
  },
  hasEvent(action: string) {
    return !!state?.events.some((e) => e.action === action);
  },
  answer(listingId: string, qid: string, v: string) {
    if (!state) return;
    set({ ...state, answers: { ...state.answers, [listingId]: { ...state.answers[listingId], [qid]: v } } });
  },
  check(listingId: string, qid: string, v: boolean) {
    if (!state) return;
    set({ ...state, checks: { ...state.checks, [listingId]: { ...state.checks[listingId], [qid]: v } } });
  },
  setChallenge(listingId: string, c: { code: string; verdict?: ChallengeVerdict }) {
    if (!state) return;
    set({ ...state, challenges: { ...state.challenges, [listingId]: c } });
  },
  decide(listingId: string, choice: "meet" | "walk" | "goodwill") {
    if (!state) return;
    set({ ...state, decision: { listingId, choice, at: new Date().toISOString() } });
  },
};
