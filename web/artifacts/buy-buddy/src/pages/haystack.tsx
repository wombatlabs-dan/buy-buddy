import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, RotateCcw, SearchX } from "lucide-react";
import { Page, Stepper, useMeta } from "@/components/shell";
import { ListingCard, ListingCardSkeleton } from "@/components/listing-card";
import { DiscoveryBadge } from "@/components/badges";
import { useHuntResult } from "@/hooks/use-hunt-data";
import { useHunt } from "@/lib/store";
import { usd } from "@/lib/pricing";
import type { DiscoveryTag } from "@/lib/types";
import { logHuntStart } from "./home";

type Sort = "match" | "price-asc" | "price-desc" | "deal" | "risk";
const riskRank = { low: 0, medium: 1, high: 2 };

export function NoHunt() {
  const [, navigate] = useLocation();
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="display text-4xl">No hunt yet.</h1>
      <p className="text-muted-foreground mt-3">Start one, or load the RTX 4090 sample hunt to walk through every stage.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/start" className="h-11 rounded-full border border-foreground px-6 inline-flex items-center" data-testid="link-start-empty">Start a hunt</Link>
        <button onClick={() => { logHuntStart("RTX 4090", 1500, "per-hunt", true); navigate("/hunt"); }} className="h-11 rounded-full bg-foreground text-background px-6" data-testid="button-load-demo">Load sample hunt</button>
      </div>
    </div>
  );
}

function Counter({ stage, scanned, candidates, finalists }: { stage: number; scanned: number; candidates: number; finalists: number }) {
  const items = [[scanned, "listings"], [candidates, "candidates"], [finalists, "finalists"]] as const;
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2" aria-live="polite" data-testid="text-funnel">
      {items.map(([n, l], i) => (
        <span key={l} className="flex items-baseline gap-4">
          <motion.span initial={false} animate={{ opacity: stage >= i ? 1 : 0.2 }} className="display text-4xl md:text-6xl">
            {n} <span className="text-lg md:text-2xl font-light">{l}</span>
          </motion.span>
          {i < 2 && <ArrowRight className={`h-6 w-6 transition-opacity ${stage > i ? "opacity-100" : "opacity-20"}`} aria-hidden />}
        </span>
      ))}
    </div>
  );
}

export default function Haystack() {
  useMeta("The haystack", "Watch 200 sample listings narrow to 12 candidates and 3 finalists, with reasons for each.");
  const h = useHunt();
  const { data, isLoading, isError, refetch } = useHuntResult(h?.query, h?.maxPrice);
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [view, setView] = useState<"all" | "finalists">("all");
  const [inBudget, setInBudget] = useState(false);
  const [sort, setSort] = useState<Sort>("match");
  const [tag, setTag] = useState<DiscoveryTag | null>(null);

  useEffect(() => {
    if (!data?.supported) return;
    if (reduce) { setStage(2); return; }
    setStage(0);
    const a = setTimeout(() => setStage(1), 900);
    const b = setTimeout(() => setStage(2), 2000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [data, reduce]);

  const shown = useMemo(() => {
    if (!data) return [];
    let ls = data.listings;
    if (view === "finalists") ls = ls.filter((l) => data.finalistIds.includes(l.id));
    if (inBudget && h) ls = ls.filter((l) => l.price <= h.maxPrice);
    if (tag) ls = ls.filter((l) => l.tags.includes(tag));
    const s = [...ls];
    s.sort((x, y) => sort === "match" ? y.matchConfidence - x.matchConfidence : sort === "price-asc" ? x.price - y.price : sort === "price-desc" ? y.price - x.price
      : sort === "deal" ? (x.price - x.goingPrice) - (y.price - y.goingPrice) : riskRank[x.risk.level] - riskRank[y.risk.level]);
    return s;
  }, [data, view, inBudget, tag, sort, h, stage]);

  if (!h) return <Page><NoHunt /></Page>;

  return (
    <Page>
      <div className="mx-auto max-w-6xl px-5 py-10">
        <Stepper current={1} />
        <p className="text-sm text-muted-foreground mt-8">Hunting for <strong className="text-foreground font-medium">"{h.query}"</strong> up to {usd(h.maxPrice)}</p>

        {isLoading && (
          <div className="mt-8"><div className="h-14 w-2/3 bg-muted rounded-2xl animate-pulse" />
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{Array.from({ length: 6 }, (_, i) => <ListingCardSkeleton key={i} />)}</div></div>
        )}
        {isError && (
          <div className="mt-10 rounded-3xl border p-8 text-center">
            <p>We couldn't load this hunt.</p>
            <button onClick={() => refetch()} className="mt-4 h-10 rounded-full bg-foreground text-background px-5 inline-flex items-center gap-2" data-testid="button-retry"><RotateCcw className="h-4 w-4" />Try again</button>
          </div>
        )}
        {data && !data.supported && (
          <div className="mt-10 rounded-[2rem] bg-secondary p-10 md:p-14 text-center" data-testid="status-unsupported">
            <SearchX className="h-8 w-8 mx-auto" aria-hidden />
            <h1 className="display text-3xl md:text-4xl mt-5">No sample listings for "{data.query}".</h1>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">{data.message} We'd rather show nothing than show you unrelated listings.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/start" className="h-11 rounded-full border border-foreground px-6 inline-flex items-center">Try another search</Link>
              <NoHuntDemoButton />
            </div>
          </div>
        )}
        {data?.supported && (
          <>
            <div className="mt-6"><Counter stage={stage} scanned={data.scanned} candidates={data.listings.length} finalists={data.finalistIds.length} /></div>
            <p className="text-sm text-muted-foreground mt-3 max-w-2xl">
              {stage === 0 ? "Reading 200 listings, including the ones with vague titles..." : stage === 1 ? "Kept 12 that look like the real thing. Scoring price, match and risk..." : "3 finalists stand out. Every candidate stays visible so you can judge for yourself."}
            </p>

            <div className="mt-8 flex flex-col lg:flex-row lg:items-center gap-4 justify-between border-y py-4">
              <div className="inline-flex rounded-full bg-muted p-1 self-start" role="tablist">
                {(["all", "finalists"] as const).map((v) => (
                  <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} data-testid={`tab-${v}`}
                    className={`rounded-full px-4 py-1.5 text-sm transition-colors ${view === v ? "bg-foreground text-background" : ""}`}>
                    {v === "all" ? `All candidates (${data.listings.length})` : `Finalists (${data.finalistIds.length})`}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(["photo", "pc", "lot"] as DiscoveryTag[]).map((t) => (
                  <button key={t} onClick={() => setTag(tag === t ? null : t)} aria-pressed={tag === t} data-testid={`filter-tag-${t}`}
                    className={`rounded-full transition-opacity ${tag && tag !== t ? "opacity-40" : ""} ${tag === t ? "ring-2 ring-foreground ring-offset-2" : ""}`}>
                    <DiscoveryBadge tag={t} />
                  </button>
                ))}
                <label className="flex items-center gap-2 text-sm rounded-full border px-3 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={inBudget} onChange={(e) => setInBudget(e.target.checked)} className="accent-foreground" data-testid="checkbox-budget" />
                  Within {usd(h.maxPrice)}
                </label>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" data-testid="select-sort"
                  className="rounded-full border bg-background px-3 py-1.5 text-sm">
                  <option value="match">Best match</option><option value="deal">Biggest discount</option>
                  <option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option>
                  <option value="risk">Lowest risk</option>
                </select>
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="py-20 text-center"><p className="display text-3xl">Nothing matches those filters.</p>
                <button onClick={() => { setTag(null); setInBudget(false); setView("all"); }} className="mt-5 underline underline-offset-4" data-testid="button-clear-filters">Clear filters</button></div>
            ) : (
              <motion.div layout className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <AnimatePresence mode="popLayout">
                  {shown.map((l, i) => <ListingCard key={l.id} l={l} index={i} finalist={stage === 2 && data.finalistIds.includes(l.id)} />)}
                </AnimatePresence>
              </motion.div>
            )}
          </>
        )}
      </div>
    </Page>
  );
}

function NoHuntDemoButton() {
  const [, navigate] = useLocation();
  return <button onClick={() => { logHuntStart("RTX 4090", 1500, "per-hunt", true); navigate("/hunt"); }} className="h-11 rounded-full bg-foreground text-background px-6" data-testid="button-load-demo-unsupported">Load RTX 4090 sample</button>;
}
