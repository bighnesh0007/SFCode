"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { RankBadge } from "@/components/RankBadge";
import { pointsSummary, usePoints } from "@/components/usePoints";
import { Flair, accentClass, frameClass } from "@/components/Cosmetics";
import { ApiError } from "@/lib/apiClient";
import { getLeaderboard, type LeaderboardRow } from "@/lib/communityApi";
import { cn } from "@/lib/utils";

export default function LeaderboardPage() {
  const points = usePoints();
  const [window, setWindow] = useState<"all" | "30d">("all");
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLeaderboard(window)
      .then((r) => {
        if (!cancelled) {
          setRows(r);
          setError(null);
        }
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not load the leaderboard."));
    return () => {
      cancelled = true;
    };
  }, [window]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Points for each problem solved once, by track and difficulty (Easy/Medium/Hard){points ? `: ${pointsSummary(points)}` : ""}. Ties go to whoever got there first.</p>
        </div>
        <div role="tablist" aria-label="Time window" className="flex rounded-md border p-0.5 text-xs">
          {(["all", "30d"] as const).map((w) => (
            <button key={w} role="tab" type="button" aria-selected={window === w} onClick={() => { setRows(null); setWindow(w); }} className={cn("rounded px-3 py-1", window === w ? "bg-accent font-medium" : "text-muted-foreground")}>
              {w === "all" ? "All time" : "Last 30 days"}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-6 overflow-hidden rounded-lg border">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="w-14 py-2.5 pl-4">#</th>
              <th className="py-2.5">Learner</th>
              <th className="w-20 py-2.5 text-right">Solved</th>
              <th className="w-20 py-2.5 pr-4 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && !error
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t">
                    <td colSpan={4} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-muted" /></td>
                  </tr>
                ))
              : rows?.map((r) => (
                  <tr key={r.handle} className="border-t hover:bg-accent/60">
                    <td className={cn("py-3 pl-4 tabular-nums", r.rank <= 3 ? "font-semibold" : "text-muted-foreground")}>{r.rank}</td>
                    <td className="py-3">
                      <Link href={`/u/${r.handle}`} className="flex min-w-0 items-center gap-2.5 hover:text-primary">
                        <Avatar src={r.imageUrl} name={r.displayName} size={24} className={frameClass(r.cosmetics.frame)} />
                        <span className={cn("truncate font-medium", accentClass(r.cosmetics.accent))}>{r.displayName}</span>
                        <Flair badge={r.cosmetics.badge} />
                        <RankBadge id={r.tier.id} title={r.tier.title} size="sm" className="hidden sm:inline-flex" />
                        <span className="truncate text-xs text-muted-foreground">@{r.handle}</span>
                      </Link>
                    </td>
                    <td className="py-3 text-right tabular-nums">{r.solved}</td>
                    <td className="py-3 pr-4 text-right font-medium tabular-nums">{r.score}</td>
                  </tr>
                ))}
            {rows?.length === 0 && (
              <tr className="border-t">
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">No solves yet{window === "30d" ? " in the last 30 days" : ""}. Be the first.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
