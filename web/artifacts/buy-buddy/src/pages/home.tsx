import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Camera, Cpu, Layers, MessageSquareText, ScrollText } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Footer, Header, SampleBanner, useMeta } from "@/components/shell";
import { asset, MONTHLY_PRICE, perHuntFee, usd } from "@/lib/pricing";
import { hunt } from "@/lib/store";
import { SAMPLE_GOING_PRICE } from "@/lib/sample-data";
import { HeroCrate } from "@/components/hero-crate";
import { isLive } from "@/lib/api";
import { liveApi } from "@/lib/live";

const schema = z.object({
  query: z.string().trim().min(2, "Tell us what you're looking for."),
  maxPrice: z.coerce.number({ invalid_type_error: "Enter a number." }).positive("Max price must be above $0.").max(100000, "That's above what we can hunt for."),
  plan: z.enum(["per-hunt", "monthly"]),
});
type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

export function logHuntStart(query: string, maxPrice: number, plan: "per-hunt" | "monthly", supported: boolean) {
  hunt.start(query, maxPrice, plan);
  hunt.log({ actor: "You", actorKind: "you", action: "Started a hunt", decision: `Looking for "${query}" up to ${usd(maxPrice)}`, modelCost: 0 });
  if (!supported) {
    hunt.log({ actor: "Code", actorKind: "code", action: "Checked sample coverage", decision: "No sample listings for this item; nothing searched", modelCost: 0 });
    return;
  }
  hunt.log({ actor: "Code", actorKind: "code", action: "Collected listings", decision: "200 listings gathered from 5 marketplaces (sample)", modelCost: 0 });
  hunt.log({ actor: "GPT-4.1 mini (sample)", actorKind: "model", action: "Read titles and photos", decision: "Kept 12 candidates, 3 found only by photo", modelCost: 0.38 });
  hunt.log({ actor: "GPT-4.1 (sample)", actorKind: "model", action: "Scored price, match and risk", decision: "Picked 3 finalists", modelCost: 0.21 });
  hunt.log({ actor: "Code", actorKind: "code", action: "Priced the hunt", decision: plan === "monthly" ? `Covered by ${usd(MONTHLY_PRICE, 2)}/month plan (demo, no charge)` : `Service fee ${usd(perHuntFee(SAMPLE_GOING_PRICE))} = 2% of ${usd(SAMPLE_GOING_PRICE)} going price (demo, no charge)`, modelCost: 0, serviceFee: plan === "monthly" ? 0 : perHuntFee(SAMPLE_GOING_PRICE) });
}

export default function Home({ focusStart = false }: { focusStart?: boolean }) {
  useMeta("Buy used electronics with a friend", "Buy Buddy finds overlooked used-electronics deals, checks every listing and shows its reasoning. Sample data demo.");
  const [, navigate] = useLocation();
  const startRef = useRef<HTMLElement>(null);
  const form = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(schema), defaultValues: { query: "RTX 4090", maxPrice: 2500, plan: "per-hunt" } });

  useEffect(() => {
    if (focusStart) startRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusStart]);

  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const onSubmit = async (v: FormOut) => {
    if (isLive) {
      // Live: the backend starts the hunt (an Anbaric job) and records who started it.
      setBusy(true);
      setStartError(null);
      try {
        const { huntId } = await liveApi.createHunt({ query: v.query, maxPrice: v.maxPrice, plan: v.plan });
        hunt.startLive(huntId, v.query, v.maxPrice, v.plan);
        navigate("/hunt");
      } catch (e) {
        setStartError(e instanceof Error ? e.message : "Couldn't start the hunt.");
      } finally {
        setBusy(false);
      }
      return;
    }
    logHuntStart(v.query, v.maxPrice, v.plan, /4090/.test(v.query.replace(/\s+/g, "")));
    navigate("/hunt");
  };
  const fee = perHuntFee(SAMPLE_GOING_PRICE);

  return (
    <div className="min-h-[100dvh] grain">
      <SampleBanner />
      <section className="relative overflow-hidden" aria-label="Introduction">
        <div className="absolute inset-0 h-[560px] md:h-[620px]" style={{ background: `url(${asset("images/sky.jpg")}) center/cover` }} aria-hidden />
        <Header transparent />
        <div className="relative pt-32 md:pt-36 text-center">
          <p className="text-sm rise">The friend who checks the listing first</p>
        </div>
        <div className="relative mt-6 h-[380px] md:h-[440px]">
          <svg className="absolute bottom-0 left-0 w-full h-[260px] md:h-[300px]" viewBox="0 0 1440 300" preserveAspectRatio="none" aria-hidden>
            <path d="M0 120 Q720 -40 1440 120 V300 H0Z" fill="hsl(var(--background))" />
          </svg>
          <HeroCrate />
          <h1 className="sr-only">Buy used. Buy sure.</h1>
          <div className="absolute inset-x-0 bottom-4 lg:bottom-28 mx-auto max-w-6xl px-5 flex justify-center gap-6 lg:justify-between lg:gap-0 pointer-events-none" aria-hidden>
            <span className="display text-3xl sm:text-4xl lg:text-7xl -rotate-2 rise" style={{ animationDelay: ".15s" }}>Buy <span className="font-light">used.</span></span>
            <span className="display text-3xl sm:text-4xl lg:text-7xl rotate-2 rise" style={{ animationDelay: ".3s" }}>Buy <span className="font-light">sure.</span></span>
          </div>
        </div>
        <div className="relative text-center max-w-xl mx-auto px-5 mt-4">
          <p className="text-[17px] leading-relaxed">Buy Buddy reads hundreds of listings like a friend who knows hardware: spotting the card hiding inside a gaming PC, the one in a thrift-store lot, the seller who misspelled the title. Then it shows you exactly why.</p>
        </div>
      </section>

      <section id="start" ref={startRef} className="mx-auto max-w-3xl px-5 mt-14 scroll-mt-24" aria-labelledby="start-title">
        <div className="rounded-[2rem] bg-card border p-6 md:p-10 shadow-[0_30px_60px_-40px_hsl(196_50%_30%/0.4)]">
          <h2 id="start-title" className="display text-3xl md:text-4xl">Start a hunt</h2>
          <p className="text-sm text-muted-foreground mt-2">This demo has sample listings for an RTX 4090. Other searches show an honest empty result.</p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-7 grid gap-5 md:grid-cols-[1fr_180px]" noValidate>
              <FormField control={form.control} name="query" render={({ field }) => (
                <FormItem>
                  <FormLabel>What are you looking for?</FormLabel>
                  <FormControl><input {...field} placeholder="RTX 4090" className="w-full h-14 rounded-2xl border border-input bg-background px-4 text-lg focus:outline-none focus:ring-2 focus:ring-ring" data-testid="input-query" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="maxPrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>Max price</FormLabel>
                  <FormControl>
                    <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <input {...field} value={String(field.value ?? "")} inputMode="decimal" className="w-full h-14 rounded-2xl border border-input bg-background pl-8 pr-4 text-lg focus:outline-none focus:ring-2 focus:ring-ring" data-testid="input-max-price" /></div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="plan" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>How you'd pay <span className="text-muted-foreground font-normal">(demo, no charge)</span></FormLabel>
                  <div className="grid sm:grid-cols-2 gap-3" role="radiogroup">
                    {([["per-hunt", `${usd(fee)} this hunt`, `2% of the ${usd(SAMPLE_GOING_PRICE)} going price, min $9, max $49`], ["monthly", `${usd(MONTHLY_PRICE, 2)} / month`, "Unlimited hunts"]] as const).map(([v, t, d]) => (
                      <button type="button" key={v} role="radio" aria-checked={field.value === v} onClick={() => field.onChange(v)} data-testid={`radio-plan-${v}`}
                        className={`text-left rounded-2xl border p-4 transition-colors ${field.value === v ? "border-foreground bg-secondary" : "hover:bg-muted"}`}>
                        <span className="block text-lg tracking-tight">{t}</span>
                        <span className="block text-xs text-muted-foreground mt-1">{d}</span>
                      </button>
                    ))}
                  </div>
                </FormItem>
              )} />
              <div className="md:col-span-2 flex flex-wrap items-center gap-4">
                <button type="submit" disabled={busy} className="h-12 rounded-full bg-foreground text-background px-7 inline-flex items-center gap-2 hover:gap-3 transition-all disabled:opacity-60" data-testid="button-start-hunting">
                  {busy ? "Starting the hunt..." : "Start hunting"} <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
                {startError && <p className="text-sm text-destructive w-full" role="alert" data-testid="text-start-error">{startError}</p>}
                <Link href="/pricing" className="text-sm underline underline-offset-4" data-testid="link-pricing-inline">How pricing works</Link>
              </div>
            </form>
          </Form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 mt-32" aria-labelledby="finds-title">
        <h2 id="finds-title" className="display text-4xl md:text-6xl max-w-3xl">The good deals are rarely titled correctly.</h2>
        <div className="mt-14 grid md:grid-cols-[1.2fr_1fr] gap-6">
          <figure className="rounded-[2rem] overflow-hidden relative min-h-[320px]">
            <img src={asset("images/l-pc.jpg")} alt="A gaming PC listing photo with a graphics card visible" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            <figcaption className="absolute bottom-4 left-4 right-4 rounded-2xl bg-background/90 backdrop-blur p-4 text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium"><Cpu className="h-4 w-4" aria-hidden />Found inside a PC</span>
              <span className="block text-muted-foreground mt-1">"gaming pc i9 13900k 64gb ram MUST GO moving" — the title never mentions the card.</span>
            </figcaption>
          </figure>
          <div className="grid gap-6">
            {[[Camera, "Found by photo", "Seller wrote \"big graphic card\". The cooler and 16-pin connector say otherwise."], [Layers, "Found in a lot", "A ShopGoodwill box of four untested cards, one of them the card you want."]].map(([I, t, d]) => {
              const Icon = I as typeof Camera;
              return (
                <div key={t as string} className="rounded-[2rem] bg-secondary p-7">
                  <Icon className="h-6 w-6" aria-hidden />
                  <h3 className="text-2xl tracking-tight mt-6">{t as string}</h3>
                  <p className="text-muted-foreground mt-2">{d as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 mt-32 grid md:grid-cols-3 items-start gap-10" aria-label="Principles">
        {[[MessageSquareText, "You send every message.", "We draft questions for the seller. You copy them. Nothing goes out on its own."], [Camera, "Proof, not promises.", "A photo challenge asks the seller to put a handwritten code next to the serial sticker."], [ScrollText, "Every step on the record.", "Which model or rule did what, when, and what it cost. You can read the whole hunt back."]].map(([I, t, d], i) => {
          const Icon = I as typeof Camera;
          return (
            <div key={i}>
              <Icon className="h-5 w-5" aria-hidden />
              <h3 className="text-2xl tracking-tight mt-5">{t as string}</h3>
              <p className="text-muted-foreground mt-2 leading-relaxed">{d as string}</p>
            </div>
          );
        })}
      </section>

      <section className="mx-auto max-w-4xl px-5 mt-32 text-center">
        <p className="display text-3xl md:text-5xl">"Ask for the receipt. Check the connector. Meet somewhere with an outlet."</p>
        <p className="text-sm text-muted-foreground mt-6">The advice a friend gives. Built into every listing.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/start" className="h-12 rounded-full bg-foreground text-background px-7 inline-flex items-center" data-testid="link-start-bottom">Start a hunt</Link>
          <Link href="/how-it-works" className="h-12 rounded-full border border-foreground px-7 inline-flex items-center" data-testid="link-how-bottom">How it works</Link>
        </div>
      </section>
      <Footer />
    </div>
  );
}
