import type { ContestPhase } from "@/lib/contestApi";
import { cn } from "@/lib/utils";

const PHASE_STYLE: Record<ContestPhase, string> = {
  live: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  upcoming: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  ended: "bg-muted text-muted-foreground",
};

export function PhasePill({ phase }: { phase: ContestPhase }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", PHASE_STYLE[phase])}>{phase}</span>;
}

