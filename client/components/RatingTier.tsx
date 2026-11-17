import { cn } from "@/lib/utils";

/** The server decides the tier (thresholds live in server/src/domain/rating.ts); this only colours it. */
export type RatingTierInfo = { id: "trailblazer" | "ranger" | "architect" | "cta"; title: string };

const TIER_CLASS: Record<RatingTierInfo["id"], string> = {
  trailblazer: "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  ranger: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  architect: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  cta: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

export function RatingTier({ tier, className }: { tier: RatingTierInfo; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", TIER_CLASS[tier.id] ?? TIER_CLASS.ranger, className)}>{tier.title}</span>;
}

/** "+18" in green, "−12" in red, "±0" muted. */
export function RatingDelta({ delta, className }: { delta: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", delta > 0 ? "text-emerald-700 dark:text-emerald-400" : delta < 0 ? "text-rose-700 dark:text-rose-400" : "text-muted-foreground", className)}>
      {delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : "±0"}
    </span>
  );
}
