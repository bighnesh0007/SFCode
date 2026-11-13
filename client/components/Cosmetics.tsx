/**
 * Store cosmetics. The server sends style TOKENS ("gold", "soql"); only this
 * fixed map turns them into classes, so nothing user-controlled reaches CSS.
 */
import { cn } from "@/lib/utils";

const FRAMES: Record<string, string> = {
  sky: "ring-2 ring-sky-500 ring-offset-2 ring-offset-background",
  gold: "ring-2 ring-amber-400 ring-offset-2 ring-offset-background",
  aurora: "ring-2 ring-fuchsia-500 ring-offset-2 ring-offset-background shadow-[0_0_12px_rgba(168,85,247,0.6)]",
  pulse: "sfc-frame-pulse",
  prism: "sfc-frame-prism",
};
const ACCENTS: Record<string, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  violet: "text-violet-600 dark:text-violet-400",
};
const BADGES: Record<string, { label: string; className: string }> = {
  trigger: { label: "Trigger Tamer", className: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  soql: { label: "Query Whisperer", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  flow: { label: "Flow Master", className: "bg-teal-500/15 text-teal-700 dark:text-teal-300" },
  champion: { label: "Champion", className: "bg-amber-500/20 text-amber-700 dark:text-amber-300" },
};

export const frameClass = (token?: string) => (token ? FRAMES[token] : undefined);
export const accentClass = (token?: string) => (token ? ACCENTS[token] : undefined);

export function Flair({ badge, className }: { badge?: string; className?: string }) {
  const b = badge ? BADGES[badge] : undefined;
  if (!b) return null;
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", b.className, className)}>{b.label}</span>;
}
