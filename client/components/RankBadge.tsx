import { Crown, Flame, Mountain, Sprout, Trees } from "lucide-react";
import type { TierId } from "@/lib/communityApi";
import { cn } from "@/lib/utils";

export const TIER_STYLE: Record<TierId, { icon: typeof Crown; className: string }> = {
  novice: { icon: Sprout, className: "border-slate-400/40 bg-slate-500/10 text-slate-600 dark:text-slate-300" },
  trailblazer: { icon: Trees, className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  ranger: { icon: Mountain, className: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  expert: { icon: Flame, className: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  legend: { icon: Crown, className: "border-amber-400/60 bg-gradient-to-r from-amber-400/20 to-orange-500/20 text-amber-700 shadow-[0_0_12px_rgba(251,191,36,0.35)] dark:text-amber-300" },
};

export function RankBadge({ id, title, size = "md", className }: { id: TierId; title: string; size?: "sm" | "md"; className?: string }) {
  const s = TIER_STYLE[id];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border font-semibold", size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2.5 py-0.5 text-xs", s.className, className)} title={`Rank: ${title}`}>
      <s.icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {title}
    </span>
  );
}
