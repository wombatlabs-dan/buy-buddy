import { type ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { FlaskConical } from "lucide-react";

export function useMeta(title: string, description: string) {
  useEffect(() => {
    document.title = `${title} | Buy Buddy`;
    const set = (sel: string, attr: string, val: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(sel);
      if (!el) {
        el = document.createElement("meta");
        const [k, v] = sel.replace(/[[\]"]/g, "").split("=");
        el.setAttribute(k.replace("meta", ""), v);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, val);
    };
    set('meta[name="description"]', "content", description);
    set('meta[property="og:title"]', "content", `${title} | Buy Buddy`);
    set('meta[property="og:description"]', "content", description);
  }, [title, description]);
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-medium tracking-tight" data-testid="link-home">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <circle cx="9" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="15" cy="12" r="7" fill="hsl(var(--accent))" opacity=".9" />
      </svg>
      Buy Buddy
    </Link>
  );
}

export function SampleBanner() {
  return (
    <div className="bg-foreground text-background text-[13px] py-2 px-4 text-center flex items-center justify-center gap-2" role="note" data-testid="banner-sample">
      <FlaskConical className="h-3.5 w-3.5" aria-hidden />
      <span><strong className="font-medium">Sample data</strong> — listings, verdicts and model costs are illustrative. Nothing is charged or sent.</span>
    </div>
  );
}

const nav = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/record", label: "Trust record" },
];

export function Header({ transparent = false }: { transparent?: boolean }) {
  const [loc] = useLocation();
  return (
    <header className={`${transparent ? "absolute inset-x-0 top-[36px] z-30" : "relative border-b bg-background/80 backdrop-blur"}`}>
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between gap-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-7 text-sm" aria-label="Main">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} data-testid={`link-nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
              className={`transition-opacity hover:opacity-60 ${loc === n.href ? "underline underline-offset-4" : ""}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/pricing" className="md:hidden text-sm px-3 py-1.5" data-testid="link-nav-pricing-mobile">Pricing</Link>
          <Link href="/hunt" className="rounded-full border border-foreground px-4 py-1.5 text-sm hidden sm:inline-flex hover:bg-foreground hover:text-background transition-colors" data-testid="link-haystack">Your hunt</Link>
          <Link href="/#start" className="rounded-full bg-foreground text-background px-4 py-1.5 text-sm hover:opacity-85 transition-opacity" data-testid="link-start">Start hunting</Link>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t mt-24">
      <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col md:flex-row gap-6 justify-between text-sm text-muted-foreground">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-sm">A friend who knows used electronics. Shows its work, never sends anything for you.</p>
        </div>
        <div className="flex gap-6">
          <Link href="/how-it-works" className="hover:text-foreground">How it works</Link>
          <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link href="/record" className="hover:text-foreground">Trust record</Link>
        </div>
      </div>
    </footer>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col grain">
      <SampleBanner />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

const stages = ["Start", "Haystack", "Listing", "Photo challenge", "Decision", "Trust record"];
export function Stepper({ current, skipped }: { current: number; skipped?: number }) {
  return (
    <ol className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-label="Hunt progress">
      {stages.map((s, i) => (
        <li key={s} className={`flex items-center gap-1.5 ${i === current ? "text-foreground" : ""} ${i === skipped ? "line-through opacity-60" : ""}`}
          aria-current={i === current ? "step" : undefined}>
          <span className={`mono h-5 w-5 rounded-full grid place-items-center text-[10px] ${i < current ? "bg-foreground text-background" : i === current ? "bg-accent text-accent-foreground" : "border"}`}>{i + 1}</span>
          {s}{i === skipped && <span className="sr-only"> (skipped)</span>}
        </li>
      ))}
    </ol>
  );
}
