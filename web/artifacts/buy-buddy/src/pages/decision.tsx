import { Link, useLocation, useParams } from "wouter";
import { ArrowUpRight, Footprints, Handshake } from "lucide-react";
import { Stepper, useMeta } from "@/components/shell";
import { ListingGate } from "@/components/listing-gate";
import { RiskBadge } from "@/components/badges";
import { hunt, type HuntState } from "@/lib/store";
import { asset, usd } from "@/lib/pricing";
import type { Listing } from "@/lib/types";

function Decision({ l, h }: { l: Listing; h: HuntState }) {
  const [, navigate] = useLocation();
  const goodwill = l.sellerKind === "shopgoodwill";
  const verdict = h.challenges[l.id]?.verdict;
  const url = l.listingUrl ?? l.searchUrl ?? "https://shopgoodwill.com";

  const decide = (choice: "meet" | "walk" | "goodwill") => {
    hunt.decide(l.id, choice);
    hunt.log({ actor: "You", actorKind: "you", action: "Made the decision",
      decision: choice === "meet" ? `Go meet the seller (${l.sellerName})` : choice === "walk" ? "Walk away" : "Bid or buy on ShopGoodwill (opened externally, nothing bid)", modelCost: 0 });
    navigate("/record");
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Stepper current={4} skipped={goodwill ? 3 : undefined} />
      <div className="mt-10 flex gap-5 items-center">
        <img src={asset(l.photos[0])} alt="" className="h-20 w-24 rounded-2xl object-cover" />
        <div><p className="text-sm text-muted-foreground">{l.source} · {usd(l.price)}</p><p className="text-lg">"{l.originalTitle}"</p></div>
      </div>
      <h1 className="display text-5xl md:text-7xl mt-10">Your call.</h1>
      <div className="mt-6 flex flex-wrap gap-2 items-center text-sm">
        <RiskBadge risk={l.risk} />
        {goodwill ? <span className="text-muted-foreground">Photo challenge skipped: institutional seller.</span>
          : verdict ? <span className="text-muted-foreground">Sample photo verdict: {verdict.scenario === "failed" ? "failed verification" : verdict.scenario} ({verdict.confidence}%, simulated)</span>
          : <span className="text-muted-foreground">No photo challenge run yet.</span>}
      </div>
      <div className="mt-10 grid md:grid-cols-2 gap-5">
        {goodwill ? (
          <div>
            <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => decide("goodwill")} data-testid="button-goodwill"
              className="group flex flex-col justify-between min-h-[220px] rounded-[2rem] bg-foreground text-background p-8 hover:-translate-y-1 transition-transform">
              <ArrowUpRight className="h-7 w-7 group-hover:rotate-12 transition-transform" aria-hidden />
              <span className="display text-3xl md:text-4xl">Bid or buy on ShopGoodwill</span>
            </a>
            {!l.listingUrl && <p className="text-xs text-muted-foreground mt-3">Sample link: opens a ShopGoodwill search for RTX 4090, not a specific item. Nothing is bid automatically.</p>}
          </div>
        ) : (
          <button onClick={() => decide("meet")} data-testid="button-meet"
            className="group text-left flex flex-col justify-between min-h-[220px] rounded-[2rem] bg-foreground text-background p-8 hover:-translate-y-1 transition-transform">
            <Handshake className="h-7 w-7" aria-hidden />
            <span className="display text-3xl md:text-4xl">Go meet the seller</span>
          </button>
        )}
        <button onClick={() => decide("walk")} data-testid="button-walk"
          className="text-left flex flex-col justify-between min-h-[220px] rounded-[2rem] border-2 border-foreground p-8 hover:-translate-y-1 transition-transform">
          <Footprints className="h-7 w-7" aria-hidden />
          <span className="display text-3xl md:text-4xl">Walk away</span>
        </button>
      </div>
      {!goodwill && <p className="text-sm text-muted-foreground mt-6 max-w-xl">Meeting tip: pick a busy public place with a power outlet, or a store that tests hardware. Bring the questions you checked.</p>}
      <Link href={`/listing/${l.id}`} className="mt-10 inline-block text-sm underline underline-offset-4">Back to listing</Link>
    </div>
  );
}

export default function DecisionPage() {
  const { id } = useParams<{ id: string }>();
  useMeta("Your decision", "Go meet the seller or walk away. Every choice lands on your trust record.");
  return <ListingGate id={id}>{(l, h) => <Decision l={l} h={h} />}</ListingGate>;
}
