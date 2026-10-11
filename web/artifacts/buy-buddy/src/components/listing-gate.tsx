import type { ReactNode } from "react";
import { Link } from "wouter";
import { RotateCcw } from "lucide-react";
import { Page } from "./shell";
import { useListing } from "@/hooks/use-hunt-data";
import { useHunt, type HuntState } from "@/lib/store";
import type { Listing } from "@/lib/types";
import { NoHunt } from "@/pages/haystack";
import { isLive } from "@/lib/api";
import { useLiveHunt, type LiveHunt } from "@/lib/live";

type Render = (l: Listing, h: HuntState, live?: LiveHunt) => ReactNode;

const Loading = () => <Page><div className="mx-auto max-w-6xl px-5 py-12 grid md:grid-cols-2 gap-8 animate-pulse"><div className="aspect-[4/3] rounded-3xl bg-muted" /><div className="space-y-4"><div className="h-10 bg-muted rounded-xl w-3/4" /><div className="h-5 bg-muted rounded w-1/2" /><div className="h-32 bg-muted rounded-2xl" /></div></div></Page>;
const Failed = ({ retry }: { retry: () => void }) => <Page><div className="py-24 text-center"><p>We couldn't load this listing.</p><button onClick={retry} className="mt-4 h-10 rounded-full bg-foreground text-background px-5 inline-flex items-center gap-2" data-testid="button-retry-listing"><RotateCcw className="h-4 w-4" />Try again</button></div></Page>;
const Missing = () => <Page><div className="py-24 text-center px-5"><h1 className="display text-4xl">Listing not found.</h1><p className="text-muted-foreground mt-3">It isn't part of your current hunt.</p><Link href="/hunt" className="mt-6 inline-flex h-11 items-center rounded-full bg-foreground text-background px-6">Back to the haystack</Link></div></Page>;

function LiveGate({ id, h, children }: { id: string; h: HuntState; children: Render }) {
  const { data, isLoading, isError, refetch } = useLiveHunt(h.huntId);
  if (isLoading) return <Loading />;
  if (isError || !data) return <Failed retry={() => refetch()} />;
  const l = data.candidates.find((c) => c.id === id);
  if (!l) return <Missing />;
  return <Page>{children(l, h, data)}</Page>;
}

function SampleGate({ id, h, children }: { id: string; h: HuntState; children: Render }) {
  const { data, isLoading, isError, refetch } = useListing(h.query, id);
  if (isLoading) return <Loading />;
  if (isError) return <Failed retry={() => refetch()} />;
  if (!data) return <Missing />;
  return <Page>{children(data, h)}</Page>;
}

export function ListingGate({ id, children }: { id: string; children: Render }) {
  const h = useHunt();
  if (!h || (isLive && !h.huntId)) return <Page><NoHunt /></Page>;
  return isLive ? <LiveGate id={id} h={h}>{children}</LiveGate> : <SampleGate id={id} h={h}>{children}</SampleGate>;
}
