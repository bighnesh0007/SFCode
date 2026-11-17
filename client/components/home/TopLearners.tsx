"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { getLeaderboard, type LeaderboardRow } from "@/lib/communityApi";

const MEDAL = ["🥇", "🥈", "🥉"];

/** The week's top five by points. Hidden until there's someone to show. */
export function TopLearners() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  useEffect(() => {
    getLeaderboard("7d").then((r) => setRows(r.filter((x) => x.score > 0).slice(0, 5))).catch(() => {});
  }, []);
  if (rows.length === 0) return null;
  return (
    <div className="rounded-2xl border bg-card/60 p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Flame className="h-4 w-4 text-orange-500" /> Top learners this week</h3>
        <Link href="/leaderboard" className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-400">Full board</Link>
      </div>
      <ol className="mt-4 space-y-2">
        {rows.map((r, i) => (
          <li key={r.handle}>
            <Link href={`/u/${r.handle}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60">
              <span className="w-6 text-center text-sm tabular-nums text-muted-foreground">{MEDAL[i] ?? i + 1}</span>
              <Avatar src={r.imageUrl} name={r.displayName} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.displayName}</span>
                <span className="block text-xs text-muted-foreground">{r.tier.title} · {r.solved} solved</span>
              </span>
              <span className="text-sm font-semibold tabular-nums">{r.score}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
