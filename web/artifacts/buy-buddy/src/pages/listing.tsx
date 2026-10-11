import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, Check, Copy } from "lucide-react";
import { Stepper, useMeta } from "@/components/shell";
import { ListingGate } from "@/components/listing-gate";
import { DiscoveryBadge, MatchBadge, RiskBadge } from "@/components/badges";
import { hunt, type HuntState } from "@/lib/store";
import { asset, usd } from "@/lib/pricing";
import type { Listing } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

function Detail({ l, h }: { l: Listing; h: HuntState }) {
  const { toast } = useToast();
  const [photo, setPhoto] = useState(0);
  const [copied, setCopied] = useState(false);
  const goodwill = l.sellerKind === "shopgoodwill";
  const answers = h.answers[l.id] ?? {};
  const checks = h.checks[l.id] ?? {};

  useEffect(() => {
    const a = `Opened listing ${l.id}`;
    if (!hunt.hasEvent(a)) hunt.log({ actor: "You", actorKind: "you", action: a, decision: `Reviewing "${l.originalTitle}"`, modelCost: 0 });
  }, [l.id, l.originalTitle]);

  const picked = l.sellerQuestions.filter((q) => checks[q.id]);
  const message = `Hi ${l.sellerName.split(" ")[0]}, I'm interested in your listing "${l.originalTitle}" (${usd(l.price)}).${picked.length ? " A few questions before we go further:\n\n" + picked.map((q, i) => `${i + 1}. ${q.text}`).join("\n") : " Is it still available?"}\n\nThanks!`;

  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      hunt.log({ actor: "You", actorKind: "you", action: "Copied seller message", decision: `${picked.length} question(s) for ${l.sellerName}; not sent by Buy Buddy`, modelCost: 0 });
      toast({ title: "Message copied", description: "Paste it into the marketplace yourself. Nothing was sent." });
    } catch {
      toast({ title: "Couldn't copy", description: "Your browser blocked clipboard access. Select the text in the preview and copy it manually.", variant: "destructive" });
    }
  };

  const next = goodwill ? `/listing/${l.id}/decision` : `/listing/${l.id}/challenge`;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Stepper current={2} skipped={goodwill ? 3 : undefined} />
      <Link href="/hunt" className="mt-8 inline-flex items-center gap-1.5 text-sm hover:opacity-60" data-testid="link-back-haystack"><ArrowLeft className="h-4 w-4" />Haystack</Link>
      <div className="mt-6 grid lg:grid-cols-[1.1fr_1fr] gap-10">
        <div>
          <div className="aspect-[4/3] rounded-[2rem] overflow-hidden bg-muted">
            <img src={asset(l.photos[photo])} alt={`Seller photo ${photo + 1} of ${l.photos.length}`} className="h-full w-full object-cover" data-testid="img-listing-main" />
          </div>
          <div className="mt-3 flex gap-3">
            {l.photos.map((p, i) => (
              <button key={i} onClick={() => setPhoto(i)} aria-label={`Show photo ${i + 1}`} aria-pressed={photo === i} data-testid={`button-photo-${i}`}
                className={`h-20 w-24 rounded-2xl overflow-hidden transition ${photo === i ? "ring-2 ring-foreground ring-offset-2" : "opacity-70 hover:opacity-100"}`}>
                <img src={asset(p)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{l.source} · {l.sellerName} · {l.location} · {l.postedAgo}</p>
          <h1 className="display text-3xl md:text-5xl mt-3">"{l.originalTitle}"</h1>
          <p className="text-xs text-muted-foreground mt-2">Seller's original title</p>
          <div className="mt-6 flex items-baseline gap-3"><span className="text-4xl tracking-tight">{usd(l.price)}</span><span className="text-muted-foreground">going price {usd(l.goingPrice)}</span></div>
          <div className="mt-4 flex flex-wrap gap-1.5">{l.tags.map((t) => <DiscoveryBadge key={t} tag={t} />)}<MatchBadge value={l.matchConfidence} /><RiskBadge risk={l.risk} /></div>
          {l.hiddenValue && <p className="mt-4 rounded-2xl bg-secondary p-4 text-sm"><strong className="font-medium">Hidden value:</strong> {l.hiddenValue.note}. <span className="text-muted-foreground">Estimate based on typical used part prices.</span></p>}

          <section className="mt-8"><h2 className="text-lg font-medium">Why it matched</h2>
            <ul className="mt-3 space-y-2">{l.whyMatched.map((w) => <li key={w} className="flex gap-2.5 text-[15px]"><Check className="h-4 w-4 mt-1 shrink-0" aria-hidden />{w}</li>)}</ul></section>
          <section className="mt-8"><h2 className="text-lg font-medium">{goodwill ? "Condition signals" : "Scam signals"}</h2>
            <ul className="mt-3 space-y-2">{l.risk.reasons.map((r) => <li key={r} className="flex gap-2.5 text-[15px]"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent shrink-0" aria-hidden />{r}</li>)}</ul>
            {goodwill && <p className="text-sm text-muted-foreground mt-3">ShopGoodwill is an institutional seller, so we rate condition risk instead of scam risk and skip the photo challenge.</p>}</section>
        </div>
      </div>

      <div className="mt-16 grid lg:grid-cols-2 gap-6">
        <section className="rounded-[2rem] border bg-card p-7" aria-labelledby="fit-q">
          <h2 id="fit-q" className="display text-3xl">Questions for you</h2>
          <p className="text-sm text-muted-foreground mt-2">Quick fit checks. Saved on this device.</p>
          <div className="mt-6 space-y-5">
            {l.fitQuestions.map((q) => (
              <label key={q.id} className="block">
                <span className="text-sm">{q.prompt}</span>
                <input value={answers[q.id] ?? ""} onChange={(e) => hunt.answer(l.id, q.id, e.target.value)} placeholder={q.placeholder} data-testid={`input-fit-${q.id}`}
                  className="mt-2 w-full h-11 rounded-xl border border-input bg-background px-3 focus:outline-none focus:ring-2 focus:ring-ring" />
              </label>
            ))}
          </div>
        </section>
        <section className="rounded-[2rem] bg-secondary p-7" aria-labelledby="seller-q">
          <h2 id="seller-q" className="display text-3xl">Questions to ask the seller</h2>
          <div className="mt-6 space-y-3">
            {l.sellerQuestions.map((q) => (
              <label key={q.id} className="flex gap-3 items-start cursor-pointer">
                <input type="checkbox" checked={!!checks[q.id]} onChange={(e) => hunt.check(l.id, q.id, e.target.checked)} className="mt-1 h-4 w-4 accent-foreground" data-testid={`checkbox-seller-${q.id}`} />
                <span className="text-[15px]">{q.text}</span>
              </label>
            ))}
          </div>
          <pre className="mt-6 whitespace-pre-wrap text-sm bg-background rounded-2xl p-4 font-sans select-all" aria-label="Message preview" data-testid="text-message-preview">{message}</pre>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={copy} className="h-11 rounded-full bg-foreground text-background px-5 inline-flex items-center gap-2" data-testid="button-copy-message">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy message to send"}
            </button>
            <span className="text-xs text-muted-foreground">Nothing is sent automatically.</span>
          </div>
        </section>
      </div>

      <div className="mt-12 flex justify-end">
        <Link href={next} className="h-12 rounded-full bg-foreground text-background px-7 inline-flex items-center gap-2" data-testid="link-next-stage">
          {goodwill ? "Make your decision" : "Run the photo challenge"}<ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export default function ListingPage() {
  const { id } = useParams<{ id: string }>();
  useMeta("Listing detail", "Why this sample listing matched, its risk signals and the questions worth asking.");
  return <ListingGate id={id}>{(l, h) => <Detail l={l} h={h} />}</ListingGate>;
}
