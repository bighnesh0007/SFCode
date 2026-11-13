"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listChallenges, type ChallengeSummary } from "@/lib/challengesApi";
import { TRACK_INFO, trackInfo } from "@/lib/tracks";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = { Easy: "bg-emerald-500", Medium: "bg-amber-500", Hard: "bg-rose-500" };

/** Real problem titles drifting by in two rows (Aceternity's infinite moving cards). */
export function ProblemMarquee() {
  const [items, setItems] = useState<ChallengeSummary[]>([]);
  useEffect(() => {
    Promise.all(TRACK_INFO.map((t) => listChallenges(null, t.id).then((r) => r.challenges).catch(() => [])))
      .then((lists) => setItems(lists.flat()))
      .catch(() => {});
  }, []);
  if (items.length < 6) return null;
  const half = Math.ceil(items.length / 2);
  const rows = [items.slice(0, half), items.slice(half)];
  return (
    <div className="relative space-y-3 overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      {rows.map((row, r) => (
        <div key={r} className="flex w-max sfc-marquee gap-3" style={{ ["--sfc-marquee-duration" as string]: `${row.length * 5}s`, animationDirection: r ? "reverse" : "normal" }}>
          {[...row, ...row].map((c, i) => (
            <Link key={`${c.slug}-${i}`} href={`${trackInfo(c.track).base}/${c.slug}`} aria-hidden={i >= row.length} tabIndex={i >= row.length ? -1 : undefined} className="flex shrink-0 items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm transition-colors hover:border-sky-500/50 hover:text-sky-600 dark:hover:text-sky-400">
              <span className={cn("h-2 w-2 rounded-full", DOT[c.difficulty] ?? "bg-muted-foreground")} />
              {c.title}
              <span className="text-xs text-muted-foreground">{trackInfo(c.track).label}</span>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
