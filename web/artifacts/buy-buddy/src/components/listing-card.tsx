import { Link } from "wouter";
import { motion } from "framer-motion";
import type { Listing } from "@/lib/types";
import { asset, usd } from "@/lib/pricing";
import { DiscoveryBadge, MatchBadge, RiskBadge } from "./badges";

export function ListingCard({ l, finalist, index }: { l: Listing; finalist: boolean; index: number }) {
  const diff = l.price - l.goingPrice;
  return (
    <motion.article layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4, delay: Math.min(index, 10) * 0.035 }}
      className={`group rounded-3xl bg-card border overflow-hidden flex flex-col hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_hsl(196_50%_30%/0.35)] transition-[transform,box-shadow] duration-300 ${finalist ? "ring-2 ring-foreground" : ""}`}
      data-testid={`card-listing-${l.id}`}>
      <Link href={`/listing/${l.id}`} className="flex flex-col flex-1" data-testid={`link-listing-${l.id}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img src={asset(l.photos[0])} alt={`Seller photo for ${l.originalTitle}`} loading="lazy"
            className="h-full w-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">{l.tags.map((t) => <DiscoveryBadge key={t} tag={t} />)}</div>
          {finalist && <span className="absolute top-3 right-3 rounded-full bg-foreground text-background text-xs px-2.5 py-1">Finalist</span>}
        </div>
        <div className="p-5 flex flex-col gap-3 flex-1">
          <p className="text-xs text-muted-foreground">{l.source} · {l.location}</p>
          <h3 className="text-[15px] leading-snug">"{l.originalTitle}"</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl tracking-tight" data-testid={`text-price-${l.id}`}>{usd(l.price)}</span>
            <span className={`text-xs ${diff < 0 ? "text-[hsl(150_50%_30%)]" : "text-muted-foreground"}`}>
              {diff < 0 ? `${usd(-diff)} under` : diff > 0 ? `${usd(diff)} over` : "at"} going {usd(l.goingPrice)}
            </span>
          </div>
          {l.hiddenValue && (
            <p className="text-xs rounded-xl bg-secondary px-3 py-2" data-testid={`text-hidden-value-${l.id}`}>
              <strong className="font-medium">Hidden value:</strong> {l.hiddenValue.note} <span className="text-muted-foreground">(estimate)</span>
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1"><MatchBadge value={l.matchConfidence} /><RiskBadge risk={l.risk} /></div>
        </div>
      </Link>
    </motion.article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="rounded-3xl border bg-card overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-muted" />
      <div className="p-5 space-y-3"><div className="h-3 w-1/3 bg-muted rounded" /><div className="h-4 w-4/5 bg-muted rounded" /><div className="h-6 w-1/3 bg-muted rounded" /></div>
    </div>
  );
}
