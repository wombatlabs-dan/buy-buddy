import { useEffect, useRef, useState } from "react";
import { Link, Redirect, useParams } from "wouter";
import { ArrowRight, Check, CircleHelp, Copy, ImageUp, Loader2, X } from "lucide-react";
import { Stepper, useMeta } from "@/components/shell";
import { ListingGate } from "@/components/listing-gate";
import { api } from "@/lib/api";
import { hunt, type HuntState } from "@/lib/store";
import type { ChallengeScenario, Listing } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const MAX = 10 * 1024 * 1024;
const scenarios: { v: ChallengeScenario; label: string }[] = [
  { v: "verified", label: "Verified" }, { v: "unverified", label: "Unverified" }, { v: "failed", label: "Failed" },
];

function Challenge({ l, h }: { l: Listing; h: HuntState }) {
  const { toast } = useToast();
  const existing = h.challenges[l.id];
  const [code, setCode] = useState(existing?.code ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [scenario, setScenario] = useState<ChallengeScenario>("verified");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const verdict = existing?.verdict;

  useEffect(() => {
    if (code) return;
    let live = true;
    api.createChallengeCode(l.id).then((c) => {
      if (!live) return;
      setCode(c);
      hunt.setChallenge(l.id, { code: c });
      hunt.log({ actor: "Code", actorKind: "code", action: "Issued photo challenge", decision: `Challenge code ${c}`, modelCost: 0 });
    });
    return () => { live = false; };
  }, [code, l.id]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const instruction = `${code} — photograph the serial sticker next to this note`;
  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("That isn't an image. Use a JPG, PNG, WEBP or HEIC photo.");
    if (f.size > MAX) return setError("That photo is over 10 MB. Try a smaller one.");
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Could you write "${code}" on a piece of paper and send a photo of it next to the card's serial sticker? Thanks!`); toast({ title: "Challenge text copied", description: "Send it to the seller yourself." }); }
    catch { toast({ title: "Couldn't copy", description: "Clipboard is blocked. Copy the code by hand.", variant: "destructive" }); }
  };
  const submit = async () => {
    if (!file) return setError("Add the seller's photo first.");
    setBusy(true);
    try {
      const v = await api.submitChallenge({ listingId: l.id, code, file, scenario });
      hunt.setChallenge(l.id, { code, verdict: v });
      hunt.log({ actor: "You", actorKind: "you", action: "Uploaded seller photo", decision: `Chose simulated "${scenario}" scenario`, modelCost: 0 });
      hunt.log({ actor: v.model, actorKind: "model", action: "Photo challenge verdict (simulated)", decision: `${v.scenario === "failed" ? "Failed verification" : v.scenario === "verified" ? "Verified" : "Unverified"} at ${v.confidence}% (sample verdict, no real checks run)`, modelCost: 0.06 });
    } catch {
      setError("Something went wrong producing the sample verdict. Try again.");
    } finally { setBusy(false); }
  };

  const vt = verdict?.scenario === "verified" ? "Verified" : verdict?.scenario === "unverified" ? "Unverified" : "Failed verification";

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Stepper current={3} />
      <p className="text-sm text-muted-foreground mt-8">Photo challenge for "{l.originalTitle}"</p>
      <div className="mt-6 rounded-[2rem] p-8 md:p-14 text-center bg-secondary">
        <p className="text-sm">Ask the seller to write this on paper</p>
        <p className="display text-5xl md:text-8xl mt-4 mono tracking-tight" data-testid="text-challenge-code">{code || "..."}</p>
        <p className="mt-5 text-lg">Photograph the serial sticker next to this handwritten note.</p>
        <button onClick={copy} disabled={!code} className="mt-6 h-11 rounded-full border border-foreground px-5 inline-flex items-center gap-2 hover:bg-foreground hover:text-background transition-colors" data-testid="button-copy-challenge"><Copy className="h-4 w-4" />Copy challenge text</button>
        <p className="sr-only">{instruction}</p>
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-6">
        <div>
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            className={`rounded-[2rem] border-2 border-dashed min-h-[280px] grid place-items-center p-6 text-center transition-colors ${drag ? "border-foreground bg-secondary" : "border-input"}`}>
            {preview ? (
              <div className="w-full">
                <img src={preview} alt="Seller photo preview" className="max-h-64 mx-auto rounded-2xl object-contain" data-testid="img-upload-preview" />
                <p className="text-xs text-muted-foreground mt-3">{file?.name}</p>
                <button onClick={() => { setFile(null); setPreview(null); }} className="mt-2 text-sm underline" data-testid="button-remove-photo">Remove</button>
              </div>
            ) : (
              <div>
                <ImageUp className="h-8 w-8 mx-auto" aria-hidden />
                <p className="mt-3">Drop the seller's photo here</p>
                <button onClick={() => inputRef.current?.click()} className="mt-3 h-10 rounded-full bg-foreground text-background px-5" data-testid="button-choose-photo">Choose a file</button>
                <p className="text-xs text-muted-foreground mt-3">Images up to 10 MB. Not saved after you leave.</p>
              </div>
            )}
            <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} data-testid="input-photo" aria-label="Seller photo" />
          </div>
          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
          <fieldset className="mt-6">
            <legend className="text-sm">Sample scenario <span className="text-muted-foreground">(simulated, choose the outcome to preview)</span></legend>
            <div className="mt-2 inline-flex rounded-full bg-muted p-1">
              {scenarios.map((s) => (
                <button key={s.v} type="button" onClick={() => setScenario(s.v)} aria-pressed={scenario === s.v} data-testid={`button-scenario-${s.v}`}
                  className={`rounded-full px-4 py-1.5 text-sm ${scenario === s.v ? "bg-foreground text-background" : ""}`}>{s.label}</button>
              ))}
            </div>
          </fieldset>
          <button onClick={submit} disabled={busy} className="mt-6 h-12 rounded-full bg-foreground text-background px-7 inline-flex items-center gap-2 disabled:opacity-60" data-testid="button-check-photo">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Preparing sample verdict" : "Get sample verdict"}
          </button>
        </div>

        <div aria-live="polite">
          {busy ? (
            <div className="rounded-[2rem] border p-7 space-y-4 animate-pulse"><div className="h-8 bg-muted rounded w-1/2" />{[0, 1, 2].map((i) => <div key={i} className="h-12 bg-muted rounded-xl" />)}</div>
          ) : verdict ? (
            <div className="rounded-[2rem] border bg-card p-7 rise" data-testid="card-verdict">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Sample verdict · simulated</p>
              <div className="flex items-baseline justify-between mt-3">
                <h2 className={`display text-4xl ${verdict.scenario === "failed" ? "text-destructive" : ""}`} data-testid="text-verdict">{vt}</h2>
                <span className="text-sm"><span className="text-2xl tracking-tight" data-testid="text-confidence">{verdict.confidence}%</span> confidence</span>
              </div>
              <ul className="mt-6 space-y-3">
                {verdict.checks.map((c) => (
                  <li key={c.id} className="flex gap-3 rounded-2xl bg-muted p-3">
                    <span className={`h-6 w-6 rounded-full grid place-items-center shrink-0 ${c.status === "pass" ? "bg-[hsl(150_45%_88%)]" : c.status === "fail" ? "bg-[hsl(4_80%_92%)]" : "bg-background"}`}>
                      {c.status === "pass" ? <Check className="h-3.5 w-3.5" /> : c.status === "fail" ? <X className="h-3.5 w-3.5" /> : <CircleHelp className="h-3.5 w-3.5" />}
                    </span>
                    <span><span className="block text-sm font-medium">{c.label}</span><span className="block text-xs text-muted-foreground">{c.detail}</span></span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-muted-foreground">This is a sample verdict. No real checks have run on your photo. {verdict.scenario === "failed" && "A failed verification means the photo didn't prove the claim, not that the seller is dishonest."}</p>
            </div>
          ) : (
            <div className="rounded-[2rem] bg-muted min-h-[280px] grid place-items-center p-8 text-center text-muted-foreground">
              <p>The verdict appears here: each check, its result, and a confidence number.</p>
            </div>
          )}
        </div>
      </div>
      <div className="mt-12 flex justify-between gap-3 flex-wrap">
        <Link href={`/listing/${l.id}`} className="h-12 rounded-full border border-foreground px-6 inline-flex items-center">Back to listing</Link>
        <Link href={`/listing/${l.id}/decision`} className="h-12 rounded-full bg-foreground text-background px-7 inline-flex items-center gap-2" data-testid="link-to-decision">Make your decision<ArrowRight className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  useMeta("Photo challenge", "Ask the seller for a photo of the serial sticker next to a unique handwritten code. Sample verdicts only.");
  return <ListingGate id={id}>{(l, h) => l.sellerKind === "shopgoodwill" ? <Redirect to={`/listing/${l.id}/decision`} replace /> : <Challenge l={l} h={h} />}</ListingGate>;
}
