import Link from "next/link";
import { ArrowRight, Swords, TrendingUp } from "lucide-react";
import { serverApi } from "@/lib/serverApi";
import { cn } from "@/lib/utils";

type Step = { id: string; title: string; min: number };

const RANK_TONE = ["from-slate-400 to-slate-500", "from-emerald-400 to-emerald-600", "from-sky-400 to-sky-600", "from-indigo-400 to-violet-600", "from-amber-300 to-orange-500"];
const TIER_TONE = ["bg-slate-500/70", "bg-emerald-500/80", "bg-sky-500/80", "bg-amber-500/90"];

/** Both progression ladders, from the server (thresholds live only there). Renders nothing if the API is unreachable. */
export async function RankLadder() {
  const data = await serverApi<{ ranks: Step[]; ratingTiers: Step[] }>("/api/v1/ranks", 3600);
  if (!data) return null;
  const { ranks, ratingTiers } = data;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl border bg-card/60 p-6">
        <div className="flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Rank: earned by solving</div>
        <p className="mt-1 text-sm text-muted-foreground">Every first solve adds points. Points move you up the ladder, for good.</p>
        <ol className="mt-6 flex items-end gap-2 sm:gap-3" aria-label="Ranks">
          {ranks.map((r, i) => (
            <li key={r.id} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] tabular-nums text-muted-foreground">{r.min}+ pts</span>
              <span
                className={cn("sfc-ladder-step w-full rounded-t-lg bg-gradient-to-t shadow-sm", RANK_TONE[i] ?? RANK_TONE[0])}
                style={{ height: `${36 + i * 26}px`, animationDelay: `${i * 90}ms` }}
              />
              <span className={cn("text-xs font-semibold sm:text-sm", i === ranks.length - 1 && "text-amber-600 dark:text-amber-400")}>{r.title}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col rounded-2xl border bg-card/60 p-6">
        <div className="flex items-center gap-2 text-sm font-semibold"><Swords className="h-4 w-4 text-orange-500" /> Rating: won in contests</div>
        <p className="mt-1 text-sm text-muted-foreground">Everyone starts at 1500. Beat people above you in Weekly and Biweekly contests to climb.</p>
        <div className="mt-6 flex h-3 overflow-hidden rounded-full" aria-hidden>
          {ratingTiers.map((t, i) => (
            <span key={t.id} className={cn("flex-1 border-r-2 border-background last:border-r-0", TIER_TONE[i] ?? TIER_TONE[0])} />
          ))}
        </div>
        <ul className="mt-2 grid text-xs" style={{ gridTemplateColumns: `repeat(${ratingTiers.length}, minmax(0, 1fr))` }}>
          {ratingTiers.map((t) => (
            <li key={t.id}>
              <span className="block font-semibold">{t.title}</span>
              <span className="tabular-nums text-muted-foreground">{t.min === 0 ? "start" : `${t.min}+`}</span>
            </li>
          ))}
        </ul>
        <Link href="/leaderboard" className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-medium text-sky-700 hover:underline dark:text-sky-400">
          See the leaderboards <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
