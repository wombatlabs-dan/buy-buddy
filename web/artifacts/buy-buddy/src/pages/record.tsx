import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { Bot, Cog, User } from "lucide-react";
import { Page, Stepper, useMeta } from "@/components/shell";
import { NoHunt } from "./haystack";
import { hunt, useHunt } from "@/lib/store";
import { usd } from "@/lib/pricing";
import { isLive } from "@/lib/api";
import LiveRecord from "./record-live";

const icon = { model: Bot, code: Cog, you: User };

export default function RecordPage() {
  return isLive ? <LiveRecord /> : <SampleRecord />;
}

function SampleRecord() {
  useMeta("Trust record", "Every step of your hunt: who or what did it, what it decided, when, and what it cost.");
  const h = useHunt();
  const [, navigate] = useLocation();
  if (!h) return <Page><NoHunt /></Page>;

  let running = 0;
  const rows = h.events.map((e) => { running += e.modelCost; return { ...e, running }; });
  const modelTotal = running;
  const fee = h.events.reduce((s, e) => s + (e.serviceFee ?? 0), 0);
  const d = h.decision;

  return (
    <Page>
      <div className="mx-auto max-w-4xl px-5 py-10">
        <Stepper current={5} />
        <h1 className="display text-5xl md:text-7xl mt-10">Trust record</h1>
        <p className="text-muted-foreground mt-3">Every step of your "{h.query}" hunt, started {format(new Date(h.startedAt), "MMM d, h:mm a")}.</p>
        {d && <p className="mt-6 inline-flex rounded-full bg-secondary px-4 py-2 text-sm" data-testid="text-decision">Decision: {d.choice === "meet" ? "Go meet the seller" : d.choice === "walk" ? "Walk away" : "Bid or buy on ShopGoodwill (opened externally)"} · {format(new Date(d.at), "h:mm a")}</p>}

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
                <p className="text-sm text-muted-foreground mt-0.5">{e.actor}</p>
                <p className="text-[15px] mt-1.5">{e.decision}</p>
                <p className="mono text-xs text-muted-foreground mt-1.5">
                  model cost {usd(e.modelCost, 2)}{e.actorKind === "model" ? " (illustrative)" : ""} · running {usd(e.running, 2)}
                  {e.serviceFee !== undefined && <> · service fee {usd(e.serviceFee, 2)} (demo, not charged)</>}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div className="rounded-[2rem] bg-secondary p-6"><p className="text-sm">Illustrative model costs</p><p className="display text-4xl mt-2" data-testid="text-model-total">{usd(modelTotal, 2)}</p><p className="text-xs text-muted-foreground mt-2">What the sample models would roughly cost to run. Not billed to you.</p></div>
          <div className="rounded-[2rem] border p-6"><p className="text-sm">Buy Buddy service fee</p><p className="display text-4xl mt-2" data-testid="text-service-fee">{h.plan === "monthly" ? "$14.99/mo" : usd(fee, 2)}</p><p className="text-xs text-muted-foreground mt-2">Demo only. No charge has been made and no payment details were collected.</p></div>
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/hunt" className="h-11 rounded-full border border-foreground px-6 inline-flex items-center">Back to the haystack</Link>
          <button onClick={() => { hunt.reset(); navigate("/start"); }} className="h-11 rounded-full bg-foreground text-background px-6" data-testid="button-new-hunt">Start a new hunt</button>
        </div>
      </div>
    </Page>
  );
}
