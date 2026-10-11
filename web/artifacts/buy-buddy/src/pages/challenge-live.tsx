import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, CircleHelp, Copy, ImageUp, Loader2, X } from "lucide-react";
import { Stepper } from "@/components/shell";
import { liveApi, useExpect, type LiveHunt } from "@/lib/live";
import type { Listing } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const MAX = 15 * 1024 * 1024;

/** Live photo challenge: the code comes from the backend; the verdict is the backend's real checks. */
export function LiveChallenge({ l, live }: { l: Listing; live: LiveHunt }) {
  const { toast } = useToast();
  const expect = useExpect();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [sent, setSent] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const asked = useRef(false);

  const mine = live.targetListingId === l.id;
  const challenge = mine && live.challenge?.listingId === l.id ? live.challenge : null;
  const verdict = live.verdict?.listingId === l.id ? live.verdict : null;
  const checking = sent !== null && (!verdict || verdict.photoVersion < sent);

  // Arrived here without picking the listing (e.g. a direct link): pick it now.
  useEffect(() => {
    if (mine || asked.current) return;
    asked.current = true;
    liveApi.select(live.id, l.id)
      .then(() => expect(live.id, (x) => x.challenge?.listingId === l.id))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't open the challenge."));
  }, [mine, live.id, l.id, expect]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("That isn't an image. Use a JPG or PNG photo.");
    if (f.size > MAX) return setError("That photo is over 15 MB. Try a smaller one.");
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const copy = async () => {
    if (!challenge) return;
    try { await navigator.clipboard.writeText(`Could you write "${challenge.code}" on a piece of paper and send me a photo of ${challenge.shot.replace("this code", "it")}? Thanks!`); toast({ title: "Challenge text copied", description: "Send it to the seller yourself. Buy Buddy sends nothing." }); }
    catch { toast({ title: "Couldn't copy", description: "Clipboard is blocked. Copy the code by hand.", variant: "destructive" }); }
  };
  const submit = async () => {
    if (!file) return setError("Add the seller's photo first.");
    setUploading(true);
    setError(null);
    try {
      const { version } = await liveApi.uploadPhoto(live.id, file);
      setSent(version);
      expect(live.id, (x) => !!x.verdict && x.verdict.listingId === l.id && x.verdict.photoVersion >= version);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally { setUploading(false); }
  };

  const vt = verdict?.scenario === "verified" ? "Verified" : verdict?.scenario === "unverified" ? "Unverified" : "Failed verification";

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Stepper current={3} />
      <p className="text-sm text-muted-foreground mt-8">Photo challenge for "{l.originalTitle}"</p>
      <div className="mt-6 rounded-[2rem] p-8 md:p-14 text-center bg-secondary">
        <p className="text-2xl md:text-3xl font-medium tracking-tight">Ask the seller to write this on paper</p>
        <p className="display text-5xl md:text-8xl mt-4 mono tracking-tight" data-testid="text-challenge-code">{challenge?.code ?? <Loader2 className="h-10 w-10 animate-spin mx-auto" aria-label="Issuing a code" />}</p>
        <p className="mt-5 text-xl md:text-2xl">Then photograph the card's serial sticker next to the note.</p>
        <button onClick={copy} disabled={!challenge} className="mt-6 h-11 rounded-full border border-foreground px-5 inline-flex items-center gap-2 hover:bg-foreground hover:text-background transition-colors disabled:opacity-50" data-testid="button-copy-challenge"><Copy className="h-4 w-4" />Copy challenge text</button>
        <p className="text-sm text-muted-foreground mt-3">You send it. Buy Buddy never contacts the seller.</p>
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
                <p className="mt-3">Drop the photo the seller sent you</p>
                <button onClick={() => inputRef.current?.click()} className="mt-3 h-10 rounded-full bg-foreground text-background px-5" data-testid="button-choose-photo">Choose a file</button>
                <p className="text-xs text-muted-foreground mt-3">JPG or PNG. Stored with this hunt for verification only.</p>
              </div>
            )}
            <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-photo" aria-label="Seller photo" />
          </div>
          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
          <button onClick={submit} disabled={uploading || checking || !challenge} className="mt-6 h-12 rounded-full bg-foreground text-background px-7 inline-flex items-center gap-2 disabled:opacity-60" data-testid="button-check-photo">
            {(uploading || checking) && <Loader2 className="h-4 w-4 animate-spin" />}{uploading ? "Uploading..." : checking ? "Checking the photo..." : "Check this photo"}
          </button>
        </div>

        <div aria-live="polite">
          {checking ? (
            <div className="rounded-[2rem] border p-7" data-testid="status-checking">
              <p className="font-medium">Checking the photo</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Reading the handwritten code</li><li>Comparing the card with the listing photos</li>
                <li>Looking for a screen, glare or a reused listing image</li><li>Jev combines the checks into one verdict</li>
              </ul>
            </div>
          ) : verdict ? (
            <div className="rounded-[2rem] border bg-card p-7 rise" data-testid="card-verdict">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Verdict · photo {verdict.photoVersion}</p>
              <div className="flex items-baseline justify-between mt-3 gap-4">
                <h2 className={`display text-4xl ${verdict.scenario === "failed" ? "text-destructive" : ""}`} data-testid="text-verdict">{vt}</h2>
                <span className="text-sm whitespace-nowrap"><span className="text-2xl tracking-tight" data-testid="text-confidence">{verdict.confidence}%</span> confidence</span>
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
              <p className="mt-5 text-xs text-muted-foreground">Verdict by {verdict.model}. {verdict.scenario === "failed" && "Failed verification means this photo didn't prove the seller has the card. It is not a judgment about the person."}</p>
            </div>
          ) : (
            <div className="rounded-[2rem] bg-muted min-h-[280px] grid place-items-center p-8 text-center text-muted-foreground">
              <p>The verdict appears here: each check, its result in plain words, and a confidence number.</p>
            </div>
          )}
        </div>
      </div>
      <div className="mt-12 flex justify-between gap-3 flex-wrap">
        <Link href={`/listing/${l.id}`} className="h-12 rounded-full border border-foreground px-6 inline-flex items-center">Back to listing</Link>
        <Link href={`/listing/${l.id}/decision`} className={`h-12 rounded-full bg-foreground text-background px-7 inline-flex items-center gap-2 ${verdict ? "" : "pointer-events-none opacity-40"}`} aria-disabled={!verdict} data-testid="link-to-decision">Make your decision<ArrowRight className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}
