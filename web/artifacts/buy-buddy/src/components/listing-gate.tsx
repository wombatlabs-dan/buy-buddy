import type { ReactNode } from "react";
import { Link } from "wouter";
import { RotateCcw } from "lucide-react";
import { Page } from "./shell";
import { useListing } from "@/hooks/use-hunt-data";
import { useHunt, type HuntState } from "@/lib/store";
import type { Listing } from "@/lib/types";
import { NoHunt } from "@/pages/haystack";

export function ListingGate({ id, children }: { id: string; children: (l: Listing, h: HuntState) => ReactNode }) {
  const h = useHunt();
  const { data, isLoading, isError, refetch } = useListing(h?.query, id);
  if (!h) return <Page><NoHunt /></Page>;
  if (isLoading)
    return <Page><div className="mx-auto max-w-6xl px-5 py-12 grid md:grid-cols-2 gap-8 animate-pulse"><div className="aspect-[4/3] rounded-3xl bg-muted" /><div className="space-y-4"><div className="h-10 bg-muted rounded-xl w-3/4" /><div className="h-5 bg-muted rounded w-1/2" /><div className="h-32 bg-muted rounded-2xl" /></div></div></Page>;
  if (isError)
    return <Page><div className="py-24 text-center"><p>We couldn't load this listing.</p><button onClick={() => refetch()} className="mt-4 h-10 rounded-full bg-foreground text-background px-5 inline-flex items-center gap-2" data-testid="button-retry-listing"><RotateCcw className="h-4 w-4" />Try again</button></div></Page>;
  if (!data)
    return <Page><div className="py-24 text-center px-5"><h1 className="display text-4xl">Listing not found.</h1><p className="text-muted-foreground mt-3">It isn't part of your current hunt.</p><Link href="/hunt" className="mt-6 inline-flex h-11 items-center rounded-full bg-foreground text-background px-6">Back to the haystack</Link></div></Page>;
  return <Page>{children(data, h)}</Page>;
}
