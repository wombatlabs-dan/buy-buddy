import { Camera, Cpu, Layers, ShieldCheck, ShieldAlert, Wrench } from "lucide-react";
import type { DiscoveryTag, RiskAssessment } from "@/lib/types";

const tone = {
  low: "bg-[hsl(150_45%_92%)] text-[hsl(150_50%_24%)]",
  medium: "bg-[hsl(42_95%_90%)] text-[hsl(32_70%_28%)]",
  high: "bg-[hsl(4_80%_93%)] text-[hsl(4_60%_36%)]",
};

export function RiskBadge({ risk }: { risk: RiskAssessment }) {
  const Icon = risk.kind === "condition" ? Wrench : risk.level === "low" ? ShieldCheck : ShieldAlert;
  const label = `${risk.kind === "condition" ? "Condition" : "Scam"} risk: ${risk.level}`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tone[risk.level]}`} data-testid="badge-risk">
      <Icon className="h-3.5 w-3.5" aria-hidden />{label}
    </span>
  );
}

export function MatchBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium" data-testid="badge-match">
      <span className="relative h-1.5 w-8 rounded-full bg-background overflow-hidden" aria-hidden>
        <span className="absolute inset-y-0 left-0 bg-[hsl(var(--ring))]" style={{ width: `${value}%` }} />
      </span>
      {value}% match
    </span>
  );
}

const tagMeta: Record<DiscoveryTag, { label: string; Icon: typeof Camera }> = {
  photo: { label: "Found by photo", Icon: Camera },
  pc: { label: "Found inside a PC", Icon: Cpu },
  lot: { label: "Found in a lot", Icon: Layers },
};
export const tagLabel = (t: DiscoveryTag) => tagMeta[t].label;

export function DiscoveryBadge({ tag }: { tag: DiscoveryTag }) {
  const { label, Icon } = tagMeta[tag];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent text-accent-foreground px-2.5 py-1 text-xs font-medium" data-testid={`tag-${tag}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />{label}
    </span>
  );
}
