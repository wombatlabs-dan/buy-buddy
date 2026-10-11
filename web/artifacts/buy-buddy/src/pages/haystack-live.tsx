import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, Check, Loader2, SearchX } from "lucide-react";
import { Page, Stepper, useMeta } from "@/components/shell";
import { ListingCard, ListingCardSkeleton } from "@/components/listing-card";
import { DiscoveryBadge } from "@/components/badges";
import { useHunt } from "@/lib/store";
import { usd } from "@/lib/pricing";
import { isFailed, stageText, useLiveHunt, type LiveHunt } from "@/lib/live";
import type { DiscoveryTag } from "@/lib/types";
import { Counter, NoHunt } from "./haystack";

type Sort = "match" | "price-asc" | "price-desc" | "deal" | "risk";
const riskRank = { low: 0, medium: 1, high: 2 };
const STEPS = [
  ["expand", "Expand the search", "AI"],
  ["screen", "Screen every listing", "Jev"],
  ["look", "Look at the photos", "Vision"],
  ["coach", "Coach the finalists", "AI"],
] as const;

function Progress({ h }: { h: LiveHunt }) {
  const at = STEPS.findIndex(([s]) => s === h.state);
  return (
    <div className="mt-8 rounded-[2rem] border bg-card p-7" aria-live="polite" data-testid="status-working">
      <ol className="space-y-3">
        {STEPS.map(([s, label, who], i) => (
          <li key={s} className={`flex items-center gap-3 ${i > at ? "opacity-40" : ""}`}>
            <span className={`h-6 w-6 rounded-full grid place-items-center ${i < at ? "bg-foreground text-background" : "border"}`}>
              {i < at ? <Check className="h-3.5 w-3.5" /> : i === at ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            </span>
            <span className="text-[15px]">{label}</span><span className="text-xs text-muted-foreground mono">{who}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground mt-5">{stageText(h)}</p>
    </div>
  );
}

export default function LiveHaystack() {
  useMeta("The haystack", "Real captured listings narrowed by Jev, vision and a reasoning model, with reasons for each.");
  const h0 = useHunt();
  const { data: h, isLoading, isError, error, refetch } = useLiveHunt(h0?.huntId);
  const [view, setView] = useState<"all" | "finalists">("all");
  const [inBudget, setInBudget] = useState(false);
  const [sort, setSort] = useState<Sort>("match");
  const [tag, setTag] = useState<DiscoveryTag | null>(null);

  const shown = useMemo(() => {
    if (!h) return [];
    let ls = h.candidates;
    if (view === "finalists") ls = ls.filter((l) => h.finalistIds.includes(l.id));
    if (inBudget) ls = ls.filter((l) => l.price <= h.maxPrice);
    if (tag) ls = ls.filter((l) => l.tags.includes(tag));
    if (sort === "match") return ls; // backend order: finalists first, then best score
    const s = [...ls];
    s.sort((x, y) => sort === "price-asc" ? x.price - y.price : sort === "price-desc" ? y.price - x.price
      : sort === "deal" ? (x.price - x.goingPrice) - (y.price - y.goingPrice) : riskRank[x.risk.level] - riskRank[y.risk.level]);
    return s;
  }, [h, view, inBudget, tag, sort]);

  if (!h0?.huntId) return <Page><NoHunt /></Page>;
  const working = h && !isFailed(h) && STEPS.some(([s]) => s === h.state);

  return (
    <Page>
      <div className="mx-auto max-w-6xl px-5 py-10">
        <Stepper current={1} />
        <p className="text-sm text-muted-foreground mt-8">Hunting for <strong className="text-foreground font-medium">"{h0.query}"</strong> up to {usd(h0.maxPrice)}</p>

        {isLoading && <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{Array.from({ length: 3 }, (_, i) => <ListingCardSkeleton key={i} />)}</div>}
        {isError && (
          <div className="mt-10 rounded-3xl border p-8 text-center" role="alert">
            <p>We couldn't load this hunt: {error instanceof Error ? error.message : "unknown error"}</p>
            <div className="mt-4 flex justify-center gap-3">
              <button onClick={() => refetch()} className="h-10 rounded-full bg-foreground text-background px-5" data-testid="button-retry">Try again</button>
              <Link href="/start" className="h-10 rounded-full border border-foreground px-5 inline-flex items-center">Start a new hunt</Link>
            </div>
          </div>
        )}

        {h && isFailed(h) && (
          <div className="mt-10 rounded-[2rem] border-2 border-destructive/40 p-8" role="alert" data-testid="status-failed">
            <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
            <h1 className="display text-3xl mt-4">The hunt stopped at "{h.state}".</h1>
            <p className="text-muted-foreground mt-2">A step failed, so nothing below it ran. The trust record shows what happened and why.</p>
            <div className="mt-6 flex gap-3">
              <Link href="/record" className="h-11 rounded-full bg-foreground text-background px-6 inline-flex items-center">See the trust record</Link>
              <Link href="/start" className="h-11 rounded-full border border-foreground px-6 inline-flex items-center">Start a new hunt</Link>
            </div>
          </div>
        )}

        {working && <Progress h={h} />}

        {h && h.state === "no_finds" && (
          <div className="mt-10 rounded-[2rem] bg-secondary p-10 md:p-14 text-center" data-testid="status-unsupported">
            <SearchX className="h-8 w-8 mx-auto" aria-hidden />
            <h1 className="display text-3xl md:text-4xl mt-5">{h.supported ? "No compelling finds today." : `No listings for "${h.query}".`}</h1>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">{h.message ?? "Nothing passed the checks. We'd rather show nothing than show you a lead you can't trust."}</p>
            <Link href="/start" className="mt-7 h-11 rounded-full border border-foreground px-6 inline-flex items-center">Try another search</Link>
          </div>
        )}

        {h && !working && !isFailed(h) && h.candidates.length > 0 && (
          <>
            <div className="mt-6"><Counter stage={2} scanned={h.funnel.scanned ?? 0} candidates={h.candidates.length} finalists={h.finalistIds.length} /></div>
            <p className="text-sm text-muted-foreground mt-3 max-w-3xl" data-testid="text-funnel-detail">
              {h.funnel.pool} matched the expanded search · Jev screened {h.funnel.screened} · vision checked {h.funnel.visionChecked ?? 0} photos · {h.candidates.length} candidates · {h.finalistIds.length} finalists coached.
              {h.goingPrice ? ` Going price ${usd(h.goingPrice)} (${h.goingPriceSource}).` : ""}
            </p>

            <div className="mt-8 flex flex-col lg:flex-row lg:items-center gap-4 justify-between border-y py-4">
              <div className="inline-flex rounded-full bg-muted p-1 self-start" role="tablist">
                {(["all", "finalists"] as const).map((v) => (
                  <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} data-testid={`tab-${v}`}
                    className={`rounded-full px-4 py-1.5 text-sm transition-colors ${view === v ? "bg-foreground text-background" : ""}`}>
                    {v === "all" ? `All candidates (${h.candidates.length})` : `Finalists (${h.finalistIds.length})`}
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
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" data-testid="select-sort" className="rounded-full border bg-background px-3 py-1.5 text-sm">
                  <option value="match">Best match</option><option value="deal">Biggest discount</option>
                  <option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option>
                  <option value="risk">Lowest risk</option>
                </select>
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="py-20 text-center"><p className="display text-3xl">Nothing matches those filters.</p>
                <button onClick={() => { setTag(null); setInBudget(false); setView("all"); }} className="mt-5 underline underline-offset-4">Clear filters</button></div>
            ) : (
              <motion.div layout className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <AnimatePresence mode="popLayout">
                  {shown.map((l, i) => <ListingCard key={l.id} l={l} index={i} finalist={h.finalistIds.includes(l.id)} />)}
                </AnimatePresence>
              </motion.div>
            )}

            {h.rejected.length > 0 && (
              <section className="mt-16" aria-labelledby="rejected-title">
                <h2 id="rejected-title" className="display text-3xl">Rejected, and why</h2>
                <p className="text-sm text-muted-foreground mt-2">Listings that looked close but didn't pass. Decoys and warning signs stay visible so you can judge for yourself.</p>
                <ul className="mt-6 divide-y border-y" data-testid="list-rejected">
                  {h.rejected.map((r) => (
                    <li key={r.id} className="py-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <span className="text-[15px]">"{r.title}" <span className="text-muted-foreground text-sm">· {r.source} · {usd(r.price)}</span></span>
                      <span className="text-sm text-muted-foreground flex items-center gap-3">
                        {r.reason} · Jev {r.jev}%
                        <a href={r.listingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline underline-offset-4">Listing<ArrowUpRight className="h-3 w-3" /></a>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </Page>
  );
}
