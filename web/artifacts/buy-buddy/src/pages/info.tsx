import { Link } from "wouter";
import { Page, useMeta } from "@/components/shell";
import { MONTHLY_PRICE, perHuntFee, usd } from "@/lib/pricing";

export function PricingPage() {
  useMeta("Pricing", "2% of the item's going price per hunt, minimum $9, maximum $49, or $14.99 a month. Demo, no charge.");
  const ex = [[450, "Steam Deck"], [1200, "RTX 4090"], [3200, "MacBook Pro"]] as const;
  return (
    <Page>
      <div className="mx-auto max-w-5xl px-5 py-16">
        <h1 className="display text-5xl md:text-7xl">Priced on the item,<br /><span className="font-light">not your budget.</span></h1>
        <p className="text-muted-foreground mt-5 max-w-xl">Raising your max price never raises our fee. Prices are informational in this demo; nothing is charged.</p>
        <div className="mt-12 grid md:grid-cols-[1.3fr_1fr] gap-5">
          <div className="rounded-[2rem] bg-card border p-8">
            <p className="text-sm">Per hunt</p>
            <p className="display text-5xl mt-3">2% <span className="text-2xl font-light">of going price</span></p>
            <p className="text-muted-foreground mt-2">Minimum $9, maximum $49.</p>
            <table className="mt-8 w-full text-sm"><tbody>
              {ex.map(([g, n]) => <tr key={n} className="border-t"><td className="py-3">{n}</td><td className="text-muted-foreground">going {usd(g)}</td><td className="text-right text-lg tracking-tight">{usd(perHuntFee(g))}</td></tr>)}
            </tbody></table>
          </div>
          <div className="rounded-[2rem] bg-foreground text-background p-8 flex flex-col">
            <p className="text-sm opacity-70">Monthly</p>
            <p className="display text-5xl mt-3">{usd(MONTHLY_PRICE, 2)}</p>
            <p className="opacity-70 mt-2">Unlimited hunts. Cancel anytime.</p>
            <Link href="/start" className="mt-auto pt-10 inline-flex"><span className="rounded-full bg-background text-foreground px-6 h-11 inline-flex items-center">Try a demo hunt</span></Link>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-6">Demo / no charge: plan choices are recorded on the trust record for illustration only.</p>
      </div>
    </Page>
  );
}

export function HowPage() {
  useMeta("How it works", "Six steps from a search to a decision you understand.");
  const steps = [
    ["Start a hunt", "Say what you want and the most you'll pay. You see the fee up front."],
    ["The haystack", "Hundreds of listings narrow to candidates and finalists, including ones with misspelled titles, cards inside whole PCs, and thrift-store lots."],
    ["Listing detail", "Why it matched, the risk signals, fit questions for you, and questions to ask the seller. You copy the message; nothing is sent."],
    ["Photo challenge", "The seller photographs the serial sticker beside a unique handwritten code. Skipped for ShopGoodwill, which gets a condition-risk rating instead."],
    ["Your decision", "Go meet the seller, or walk away. For ShopGoodwill, open the listing and bid yourself."],
    ["Trust record", "A timeline of every step: which model, rule or person acted, what it decided, when, and what it cost."],
  ];
  return (
    <Page>
      <div className="mx-auto max-w-4xl px-5 py-16">
        <h1 className="display text-5xl md:text-7xl">How it works</h1>
        <ol className="mt-14 space-y-10">
          {steps.map(([t, d], i) => (
            <li key={t} className="grid grid-cols-[56px_1fr] gap-4 border-t pt-8">
              <span className="mono text-sm text-muted-foreground">0{i + 1}</span>
              <div><h2 className="text-3xl tracking-tight">{t}</h2><p className="text-muted-foreground mt-2 max-w-xl">{d}</p></div>
            </li>
          ))}
        </ol>
        <Link href="/start" className="mt-14 h-12 rounded-full bg-foreground text-background px-7 inline-flex items-center">Start a hunt</Link>
      </div>
    </Page>
  );
}
