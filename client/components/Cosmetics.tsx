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
  neon: "sfc-frame-neon",
  galaxy: "sfc-frame-galaxy",
  ember: "sfc-frame-ember",
  holo: "sfc-frame-holo",
  blueflame: "sfc-frame-flame sfc-flame-blue",
  solarflame: "sfc-frame-flame sfc-flame-solar",
  shadowflame: "sfc-frame-flame sfc-flame-shadow",
  lightning: "sfc-frame-lightning",
};
const ACCENTS: Record<string, string> = {
  emerald: "text-emerald-700 dark:text-emerald-400",
  violet: "text-violet-600 dark:text-violet-400",
  glow: "sfc-name-glow",
  shimmer: "sfc-name-shimmer",
  flame: "sfc-name-flame",
  holo: "sfc-name-holo",
};
const BADGES: Record<string, { label: string; className: string }> = {
  trigger: { label: "Trigger Tamer", className: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  soql: { label: "Query Whisperer", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  flow: { label: "Flow Master", className: "bg-teal-500/15 text-teal-700 dark:text-teal-300" },
  champion: { label: "Champion", className: "bg-amber-500/20 text-amber-700 dark:text-amber-300" },
  bulk: { label: "Bulkified", className: "bg-lime-500/15 text-lime-800 dark:text-lime-300" },
  lwc: { label: "LWC Artisan", className: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  async: { label: "Async Ace", className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
  limits: { label: "Limit Survivor", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  legend: { label: "Legend", className: "sfc-badge-legend shadow-sm" },
};
const BANNERS: Record<string, string> = {
  sunset: "sfc-banner-sunset",
  waves: "sfc-banner-waves",
  circuit: "sfc-banner-circuit",
  aurora: "sfc-banner-aurora",
  starfield: "sfc-banner-starfield",
  synthwave: "sfc-banner-synthwave",
  coderain: "sfc-banner-coderain",
};

/** Every style token the client can draw, by slot; a test checks the server catalogue against it. */
export const KNOWN_STYLES: Record<string, string[]> = {
  frame: Object.keys(FRAMES),
  accent: Object.keys(ACCENTS),
  badge: Object.keys(BADGES),
  banner: Object.keys(BANNERS),
};

export type Rarity = "common" | "rare" | "epic" | "legendary";
export const RARITY: Record<Rarity, { label: string; className: string; card: string }> = {
  common: { label: "Common", className: "text-muted-foreground", card: "" },
  rare: { label: "Rare", className: "text-sky-700 dark:text-sky-400", card: "border-sky-500/40" },
  epic: { label: "Epic", className: "text-violet-700 dark:text-violet-400", card: "border-violet-500/50 shadow-[0_0_18px_-6px_rgba(139,92,246,0.55)]" },
  legendary: { label: "Legendary", className: "text-amber-700 dark:text-amber-400", card: "sfc-card-legendary shadow-[0_0_22px_-6px_rgba(245,158,11,0.6)]" },
};

/** A decorative banner (profile header, store preview). Nothing renders for an unknown token. */
export function Banner({ banner, className, children }: { banner?: string; className?: string; children?: React.ReactNode }) {
  const b = banner ? BANNERS[banner] : undefined;
  if (!b) return null;
  return (
    <div aria-hidden={children ? undefined : true} className={cn("sfc-banner", b, className)}>
      {children}
    </div>
  );
}

export const frameClass = (token?: string) => (token ? FRAMES[token] : undefined);
export const accentClass = (token?: string) => (token ? ACCENTS[token] : undefined);

export function Flair({ badge, className }: { badge?: string; className?: string }) {
  const b = badge ? BADGES[badge] : undefined;
  if (!b) return null;
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", b.className, className)}>{b.label}</span>;
}
