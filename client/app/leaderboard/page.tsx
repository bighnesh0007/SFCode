"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flag, Swords, Trophy, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { RankBadge } from "@/components/RankBadge";
import { pointsSummary, usePoints } from "@/components/usePoints";
import { Flair, accentClass, frameClass } from "@/components/Cosmetics";
import { buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { getCountryBoard, getLeaderboard, getRatingBoard, getTeamBoard, type CountryRow, type LeaderboardRow, type LeaderboardWindow, type RatingRow, type ScoredTrack, type TeamRow } from "@/lib/communityApi";
import { countryFlag, countryName, getCountryCodes } from "@/lib/countries";
import { cn } from "@/lib/utils";

type Board = "points" | "rating" | "teams" | "countries";
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
  const [teams, setTeams] = useState<TeamRow[] | null>(null);
  const [countries, setCountries] = useState<CountryRow[] | null>(null);
  const [country, setCountry] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const done =
      <T,>(set: (r: T) => void) =>
      (r: T) => {
        if (!cancelled) {
          set(r);
          setError(null);
        }
      };
    const load =
      board === "points"
        ? getLeaderboard(window, track === "all" ? undefined : track, country || undefined).then(done(setRows))
        : board === "rating"
          ? getRatingBoard().then(done(setRatings))
          : board === "teams"
            ? getTeamBoard().then(done(setTeams))
            : getCountryBoard(window).then(done(setCountries));
    load.catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not load the leaderboard."));
    return () => {
      cancelled = true;
    };
  }, [board, window, track, country]);

  useEffect(() => {
    getCountryCodes()
      .then((c) => setCodes([...c].sort((x, y) => countryName(x).localeCompare(countryName(y)))))
      .catch(() => setCodes([]));
  }, []);

  const data = { points: rows, rating: ratings, teams, countries }[board];
  const loading = data === null;
  const empty = data?.length === 0;
  const DESCRIPTION: Record<Board, string> = {
    points: `Points for each problem solved once, by track and difficulty${points ? ` (${pointsSummary(points)})` : ""}. Ties go to whoever got there first.`,
    rating: "Contest rating: everyone starts at 1500 and moves up or down with each finished contest.",
    teams: "Teams whose owners chose to list them, ranked by the combined all-time points of their top 10 members.",
    countries: "Every learner who set a country on their profile, summed by country.",
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{DESCRIPTION[board]}</p>
        </div>
        <Segmented
          label="Board"
          value={board}
          options={[
            { id: "points", label: "Points" },
            { id: "rating", label: "Contest rating" },
            { id: "teams", label: "Teams" },
            { id: "countries", label: "Countries" },
          ]}
          onChange={(b) => setBoard(b)}
        />
      </div>

      {board === "points" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Segmented label="Time window" value={window} options={WINDOWS} onChange={(w) => { setRows(null); setWindow(w); }} />
          <Segmented label="Track" value={track} options={TRACKS} onChange={(t) => { setRows(null); setTrack(t); }} />
          {codes.length > 0 && (
            <select aria-label="Country" value={country} onChange={(e) => { setRows(null); setCountry(e.target.value); }} className="h-8 rounded-md border bg-background px-2 text-xs">
              <option value="">All countries</option>
              {codes.map((c) => <option key={c} value={c}>{countryName(c)}</option>)}
            </select>
          )}
        </div>
      )}
      {board === "countries" && (
        <div className="mt-4">
          <Segmented label="Time window" value={window} options={WINDOWS} onChange={(w) => { setCountries(null); setWindow(w); }} />
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {empty ? (
        <EmptyBoard board={board} window={window} track={track} country={country} />
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="w-14 py-2.5 pl-4">#</th>
                <th className="py-2.5">{{ points: "Learner", rating: "Learner", teams: "Team", countries: "Country" }[board]}</th>
                <th className="w-24 py-2.5 text-right">{{ points: "Solved", rating: "Contests", teams: "Members", countries: "Learners" }[board]}</th>
                <th className="w-20 py-2.5 pr-4 text-right">{board === "rating" ? "Rating" : "Points"}</th>
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
                  : board === "teams"
                    ? teams?.map((r) => (
                        <tr key={r.slug} className="border-t hover:bg-accent/60">
                          <td className={cn("py-3 pl-4 tabular-nums", r.rank <= 3 ? "font-semibold" : "text-muted-foreground")}>{r.rank}</td>
                          <td className="truncate py-3 font-medium">{r.name}</td>
                          <td className="py-3 text-right tabular-nums">{r.members}</td>
                          <td className="py-3 pr-4 text-right font-medium tabular-nums">{r.score}</td>
                        </tr>
                      ))
                    : board === "countries"
                      ? countries?.map((r) => (
                          <tr key={r.country} className="border-t hover:bg-accent/60">
                            <td className={cn("py-3 pl-4 tabular-nums", r.rank <= 3 ? "font-semibold" : "text-muted-foreground")}>{r.rank}</td>
                            <td className="py-3">
                              <span className="flex min-w-0 items-center gap-2">
                                <span aria-hidden="true">{countryFlag(r.country)}</span>
                                <span className="truncate font-medium">{countryName(r.country)}</span>
                                <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                                  top: <Link href={`/u/${r.top.handle}`} className="hover:text-primary hover:underline">{r.top.displayName}</Link>
                                </span>
                              </span>
                            </td>
                            <td className="py-3 text-right tabular-nums">{r.learners}</td>
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

const EMPTY: Record<Board, { icon: typeof Trophy; tint: string; body: string; href: string; cta: string }> = {
  points: { icon: Trophy, tint: "text-amber-700 dark:text-amber-400", body: "Solve a problem and your name goes here. The top spot is open.", href: "/problems", cta: "Pick a problem" },
  rating: { icon: Swords, tint: "text-sky-700 dark:text-sky-400", body: "Ratings appear after the first contest with at least two entrants finishes.", href: "/contests", cta: "See contests" },
  teams: { icon: Users, tint: "text-violet-700 dark:text-violet-400", body: "A team owner can list their team from the team page.", href: "/teams", cta: "Your teams" },
  countries: { icon: Flag, tint: "text-emerald-700 dark:text-emerald-400", body: "Set your country in the About section of your profile to put it on the board.", href: "/profile", cta: "Edit your profile" },
};

function EmptyBoard({ board, window, track, country }: { board: Board; window: LeaderboardWindow; track: ScoredTrack | "all"; country: string }) {
  const where = [track !== "all" ? TRACKS.find((t) => t.id === track)?.label : null, country ? `in ${countryName(country)}` : null, window === "7d" ? "this week" : window === "30d" ? "in the last 30 days" : null].filter(Boolean).join(" ");
  const e = EMPTY[board];
  const title = { points: `No solves yet${where ? ` ${where}` : ""}.`, rating: "No contest results yet.", teams: "No teams listed yet.", countries: "No countries yet." }[board];
  return (
    <div className="mt-6 flex flex-col items-center rounded-lg border border-dashed px-6 py-14 text-center">
      <e.icon className={cn("h-10 w-10", e.tint)} aria-hidden="true" />
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{e.body}</p>
      <Link href={e.href} className={buttonVariants({ className: "mt-5" })}>
        {e.cta}
      </Link>
    </div>
  );
}
