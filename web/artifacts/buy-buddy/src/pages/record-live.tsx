import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { Bot, Cog, User } from "lucide-react";
import { Page, Stepper, useMeta } from "@/components/shell";
import { hunt, useHunt } from "@/lib/store";
import { usd } from "@/lib/pricing";
import { useLiveHunt } from "@/lib/live";
import { NoHunt } from "./haystack";

const icon = { model: Bot, code: Cog, you: User };
// Model spend is fractions of a cent per call: show enough digits that real spend never reads $0.00.
const money = (n: number) => (n > 0 && n < 0.01 ? `$${n.toFixed(5)}` : n > 0 && n < 1 ? `$${n.toFixed(3)}` : usd(n, 2));
const buyFee = (price: number) => Math.min(49, Math.max(9, Math.round(price * 0.02 * 100) / 100));

/** The trust record, read from the hunt's backend record (each line is a write attributed to an Anbaric actor). */
export default function LiveRecord() {
  useMeta("Trust record", "Every step of your hunt: which model, rule or person acted, what it decided, when, and what it cost.");
  const h0 = useHunt();
  const [, navigate] = useLocation();
  const { data: h, isLoading, isError, refetch } = useLiveHunt(h0?.huntId);
  if (!h0?.huntId) return <Page><NoHunt /></Page>;
  if (isLoading) return <Page><div className="mx-auto max-w-4xl px-5 py-16 animate-pulse"><div className="h-14 w-2/3 bg-muted rounded-2xl" /></div></Page>;
  if (isError || !h) return <Page><div className="py-24 text-center"><p>We couldn't load the trust record.</p><button onClick={() => refetch()} className="mt-4 h-10 rounded-full bg-foreground text-background px-5">Try again</button></div></Page>;

  let running = 0;
  const rows = h.trail.map((e) => { running += e.modelCost; return { ...e, running }; });
  // Pay only if you buy: the fee is 2% of the price of the listing you went for.
  const target = h.candidates.find((c) => c.id === (h.decision?.listingId ?? h.targetListingId));
  const walked = h.decision?.choice === "walk";
  const calls = h.trail.reduce((s, e) => s + (e.calls ?? 0), 0);
  const unknownCost = h.trail.some((e) => e.actorKind === "model" && !e.costKnown);
  const d = h.decision;

  return (
    <Page>
      <div className="mx-auto max-w-4xl px-5 py-10">
        <Stepper current={5} />
        <h1 className="display text-5xl md:text-7xl mt-10">Trust record</h1>
        <p className="text-muted-foreground mt-3">Every step of your "{h.query}" hunt, started {format(new Date(h.startedAt), "MMM d, h:mm a")}. Each line was written by the named actor and is also in the Anbaric audit trail for job <span className="mono text-xs">{h.id}</span>.</p>
        {d && <p className="mt-6 inline-flex rounded-full bg-secondary px-4 py-2 text-sm" data-testid="text-decision">Decision: {d.choice === "meet" ? "Go meet the seller" : d.choice === "walk" ? "Walk away" : "Bid or buy on ShopGoodwill (opened externally, nothing bid)"} · {format(new Date(d.at), "h:mm a")}</p>}
        {h.status === "Failed" && <p className="mt-6 rounded-2xl border-2 border-destructive/40 p-4 text-sm" role="alert">This hunt stopped at "{h.state}" because a step failed. The last lines below show what ran.</p>}

        <ol className="mt-12 relative border-l ml-3" data-testid="list-timeline">
          {rows.map((e) => {
            const Icon = icon[e.actorKind];
            return (
              <li key={e.id} className="pl-8 pb-8 relative rise">
                <span className={`absolute -left-[13px] top-0 h-6 w-6 rounded-full grid place-items-center ${e.actorKind === "you" ? "bg-accent text-accent-foreground" : "bg-foreground text-background"}`}><Icon className="h-3.5 w-3.5" aria-hidden /></span>
                <div className="flex flex-wrap justify-between gap-x-6 gap-y-1">
                  <p className="font-medium">{e.action}</p>
                  <time className="mono text-xs text-muted-foreground" dateTime={e.at}>{format(new Date(e.at), "h:mm:ss a")}</time>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{e.actorKind === "you" ? `You (${e.actor})` : e.actor}</p>
                <p className="text-[15px] mt-1.5">{e.decision}</p>
                <p className="mono text-xs text-muted-foreground mt-1.5">
                  {e.actorKind === "model"
                    ? <>{e.calls && e.calls > 1 ? `${e.calls} calls · ` : ""}cost {e.costKnown ? money(e.modelCost) : "not reported by provider"}{e.latencyMs !== undefined ? ` · ${e.latencyMs} ms${e.calls && e.calls > 1 ? " avg" : ""}` : ""} · running {money(e.running)}</>
                    : <>no model cost · running {money(e.running)}</>}
                  {e.serviceFee !== undefined && <> · service fee {usd(e.serviceFee, 2)} (demo, not charged)</>}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div className="rounded-[2rem] bg-secondary p-6"><p className="text-sm">Model spend for this hunt</p><p className="display text-4xl mt-2" data-testid="text-model-total">{money(running)}</p>
            <p className="text-xs text-muted-foreground mt-2">{calls} model calls, as reported by each provider{unknownCost ? "; some calls didn't report a cost and aren't included" : ""}. Not billed to you.</p></div>
          <div className="rounded-[2rem] border p-6"><p className="text-sm">Buy Buddy service fee</p>
            <p className="display text-4xl mt-2" data-testid="text-service-fee">{h.plan === "monthly" ? "$14.99/mo" : walked || !target ? "$0.00" : usd(buyFee(target.price), 2)}</p>
            <p className="text-xs text-muted-foreground mt-2" data-testid="text-service-fee-note">{h.plan === "monthly" ? "Monthly plan. Demo only, no charge made."
              : walked ? "You walked away, so no fee. Buy Buddy charges 2% of the price ($9 min, $49 max) only when you buy."
              : target && h.decision ? "Charged only if you complete the purchase. Demo only, no charge made."
              : target ? `${usd(buyFee(target.price), 2)} only if you buy "${target.originalTitle}". Demo only, no charge made.`
              : "Buy Buddy charges 2% of the price ($9 min, $49 max) only when you buy."}</p></div>
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/hunt" className="h-11 rounded-full border border-foreground px-6 inline-flex items-center">Back to the haystack</Link>
          <button onClick={() => { hunt.reset(); navigate("/start"); }} className="h-11 rounded-full bg-foreground text-background px-6" data-testid="button-new-hunt">Start a new hunt</button>
        </div>
      </div>
    </Page>
  );
}
