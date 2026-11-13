"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Swords, Trophy } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { RankBadge } from "@/components/RankBadge";
import { pointsSummary, usePoints } from "@/components/usePoints";
import { Flair, accentClass, frameClass } from "@/components/Cosmetics";
import { buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { getLeaderboard, getRatingBoard, type LeaderboardRow, type LeaderboardWindow, type RatingRow, type ScoredTrack } from "@/lib/communityApi";
import { cn } from "@/lib/utils";

type Board = "points" | "rating";
const WINDOWS: { id: LeaderboardWindow; label: string }[] = [
  { id: "7d", label: "This week" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All time" },
];
const TRACKS: { id: ScoredTrack | "all"; label: string }[] = [
  { id: "all", label: "All tracks" },
  { id: "apex", label: "Apex" },
  { id: "soql", label: "SOQL" },
  { id: "debug", label: "Debugging" },
  { id: "flow", label: "Flow" },
  { id: "lwc", label: "LWC" },
];

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap rounded-md border p-0.5 text-xs">
      {options.map((o) => (
        <button key={o.id} role="tab" type="button" aria-selected={value === o.id} onClick={() => onChange(o.id)} className={cn("rounded px-3 py-1", value === o.id ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function LeaderboardPage() {
  const points = usePoints();
  const [board, setBoard] = useState<Board>("points");
  const [window, setWindow] = useState<LeaderboardWindow>("all");
  const [track, setTrack] = useState<ScoredTrack | "all">("all");
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [ratings, setRatings] = useState<RatingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load =
      board === "points"
        ? getLeaderboard(window, track === "all" ? undefined : track).then((r) => {
            if (!cancelled) {
              setRows(r);
              setError(null);
            }
          })
        : getRatingBoard().then((r) => {
            if (!cancelled) {
              setRatings(r);
              setError(null);
            }
          });
    load.catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not load the leaderboard."));
    return () => {
      cancelled = true;
    };
  }, [board, window, track]);

  const loading = board === "points" ? rows === null : ratings === null;
  const empty = board === "points" ? rows?.length === 0 : ratings?.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {board === "points"
              ? `Points for each problem solved once, by track and difficulty${points ? ` (${pointsSummary(points)})` : ""}. Ties go to whoever got there first.`
              : "Contest rating: everyone starts at 1500 and moves up or down with each finished contest."}
          </p>
        </div>
        <Segmented
          label="Board"
          value={board}
          options={[
            { id: "points", label: "Points" },
            { id: "rating", label: "Contest rating" },
          ]}
          onChange={(b) => setBoard(b)}
        />
      </div>

      {board === "points" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Segmented label="Time window" value={window} options={WINDOWS} onChange={(w) => { setRows(null); setWindow(w); }} />
          <Segmented label="Track" value={track} options={TRACKS} onChange={(t) => { setRows(null); setTrack(t); }} />
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {empty ? (
        <EmptyBoard board={board} window={window} track={track} />
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="w-14 py-2.5 pl-4">#</th>
                <th className="py-2.5">Learner</th>
                <th className="w-24 py-2.5 text-right">{board === "points" ? "Solved" : "Contests"}</th>
                <th className="w-20 py-2.5 pr-4 text-right">{board === "points" ? "Points" : "Rating"}</th>
              </tr>
            </thead>
            <tbody>
              {loading && !error
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-t">
                      <td colSpan={4} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    </tr>
                  ))
                : board === "points"
                  ? rows?.map((r) => (
                      <tr key={r.handle} className="border-t hover:bg-accent/60">
                        <td className={cn("py-3 pl-4 tabular-nums", r.rank <= 3 ? "font-semibold" : "text-muted-foreground")}>{r.rank}</td>
                        <td className="py-3">
                          <Link href={`/u/${r.handle}`} className="flex min-w-0 items-center gap-2.5 hover:text-primary">
                            <Avatar src={r.imageUrl} name={r.displayName} size={24} className={frameClass(r.cosmetics.frame)} />
                            <span className={cn("truncate font-medium", accentClass(r.cosmetics.accent))}>{r.displayName}</span>
                            <Flair badge={r.cosmetics.badge} />
                            <RankBadge id={r.tier.id} title={r.tier.title} size="sm" className="hidden sm:inline-flex" />
                            <span className="hidden truncate text-xs text-muted-foreground sm:inline">@{r.handle}</span>
                          </Link>
                        </td>
                        <td className="py-3 text-right tabular-nums">{r.solved}</td>
                        <td className="py-3 pr-4 text-right font-medium tabular-nums">{r.score}</td>
                      </tr>
                    ))
                  : ratings?.map((r) => (
                      <tr key={r.handle} className="border-t hover:bg-accent/60">
                        <td className={cn("py-3 pl-4 tabular-nums", r.rank <= 3 ? "font-semibold" : "text-muted-foreground")}>{r.rank}</td>
                        <td className="py-3">
                          <Link href={`/u/${r.handle}`} className="flex min-w-0 items-center gap-2.5 hover:text-primary">
                            <Avatar src={r.imageUrl} name={r.displayName} size={24} />
                            <span className="truncate font-medium">{r.displayName}</span>
                            <span className="hidden truncate text-xs text-muted-foreground sm:inline">@{r.handle}</span>
                          </Link>
                        </td>
                        <td className="py-3 text-right tabular-nums">{r.contests}</td>
                        <td className="py-3 pr-4 text-right font-medium tabular-nums">{r.rating}</td>
                      </tr>
                    ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyBoard({ board, window, track }: { board: Board; window: LeaderboardWindow; track: ScoredTrack | "all" }) {
  const where = [track !== "all" ? TRACKS.find((t) => t.id === track)?.label : null, window === "7d" ? "this week" : window === "30d" ? "in the last 30 days" : null].filter(Boolean).join(" ");
  return (
    <div className="mt-6 flex flex-col items-center rounded-lg border border-dashed px-6 py-14 text-center">
      {board === "points" ? <Trophy className="h-10 w-10 text-amber-700 dark:text-amber-400" aria-hidden="true" /> : <Swords className="h-10 w-10 text-sky-700 dark:text-sky-400" aria-hidden="true" />}
      <p className="mt-4 font-semibold">{board === "points" ? `No solves yet${where ? ` ${where}` : ""}.` : "No contest results yet."}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {board === "points" ? "Solve a problem and your name goes here. The top spot is open." : "Ratings appear after the first contest with at least two entrants finishes."}
      </p>
      <Link href={board === "points" ? "/problems" : "/contests"} className={buttonVariants({ className: "mt-5" })}>
        {board === "points" ? "Pick a problem" : "See contests"}
      </Link>
    </div>
  );
}
