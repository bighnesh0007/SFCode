"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuthState } from "@/components/auth";
import { PhasePill } from "@/components/PhasePill";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import type { Track } from "@/lib/challengesApi";
import { getContest, joinContest, type ContestView } from "@/lib/contestApi";
import { trackInfo } from "@/lib/tracks";
import { cn } from "@/lib/utils";

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hms = [Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
  return d > 0 ? `${d}d ${hms}` : hms;
}

export default function ContestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { isSignedIn, getToken } = useAuthState();
  const [contest, setContest] = useState<ContestView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();

  // Resolves asynchronously, so effects can call it without a synchronous setState.
  const load = useCallback(() => {
    getToken()
      .then((t) => getContest(t, slug))
      .then(setContest)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Could not load the contest."));
  }, [getToken, slug]);

  useEffect(load, [load, isSignedIn]);

  // Refresh standings while live, and once the phase flips.
  const phaseEdge = contest ? (contest.phase === "upcoming" ? Date.parse(contest.startsAt) : contest.phase === "live" ? Date.parse(contest.endsAt) : null) : null;
  const crossed = phaseEdge !== null && now >= phaseEdge;
  useEffect(() => {
    if (crossed) load();
  }, [crossed, load]);
  useEffect(() => {
    if (contest?.phase !== "live") return;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [contest?.phase, load]);

  async function join() {
    try {
      setContest(await joinContest(await getToken(), slug));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not join.");
    }
  }

  if (error && !contest) return <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-destructive">{error}</div>;
  if (!contest) return <div className="mx-auto max-w-3xl px-4 py-8"><div className="h-8 w-64 animate-pulse rounded bg-muted" /></div>;

  const clock = contest.phase === "upcoming" ? `Starts in ${countdown(Date.parse(contest.startsAt) - now)}` : contest.phase === "live" ? `${countdown(Date.parse(contest.endsAt) - now)} left` : "Final standings";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link href="/contests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Contests</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{contest.title}</h1>
        <PhasePill phase={contest.phase} />
        <span className="ml-auto font-mono text-sm tabular-nums">{clock}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {new Date(contest.startsAt).toLocaleString()} → {new Date(contest.endsAt).toLocaleString()} · {contest.entrants} joined
      </p>

      {contest.phase !== "ended" && (
        <div className="mt-4 rounded-lg border p-4 text-sm">
          {!isSignedIn ? (
            <span className="text-muted-foreground">Sign in to join.</span>
          ) : contest.joined ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400"><Check className="h-4 w-4" /> You&apos;re in. Submissions to these problems during the contest count automatically.</span>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={() => void join()}>Join contest</Button>
              <span className="text-muted-foreground">Only submissions made after joining, while the contest is live, count.</span>
            </div>
          )}
          {error && <p className="mt-2 text-destructive">{error}</p>}
        </div>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Problems</h2>
      {contest.problems.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Revealed when the contest starts.</p>
      ) : (
        <ul className="mt-2 divide-y overflow-hidden rounded-lg border text-sm">
          {contest.problems.map((p, i) => (
            <li key={p.slug} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-5 font-mono text-muted-foreground">{String.fromCharCode(65 + i)}</span>
              <Link href={`${trackInfo(p.track as Track).base}/${p.slug}`} className="min-w-0 flex-1 truncate font-medium hover:text-primary">{p.title}</Link>
              <span className="text-xs text-muted-foreground">{trackInfo(p.track as Track).label} · {p.difficulty}</span>
              <span className="w-16 text-right font-medium tabular-nums">{p.points} pts</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Standings</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="w-12 py-2 pl-4">#</th>
              <th className="py-2">Learner</th>
              <th className="w-16 py-2 text-right">Score</th>
              <th className="w-20 py-2 text-right">Penalty</th>
              {contest.problems.map((p, i) => <th key={p.slug} className="w-14 py-2 text-center" title={p.title}>{String.fromCharCode(65 + i)}</th>)}
            </tr>
          </thead>
          <tbody>
            {contest.standings.map((r) => (
              <tr key={r.handle} className="border-t">
                <td className={cn("py-2.5 pl-4 tabular-nums", r.rank <= 3 && r.score > 0 ? "font-semibold" : "text-muted-foreground")}>{r.rank}</td>
                <td className="py-2.5">
                  <Link href={`/u/${r.handle}`} className="flex items-center gap-2 hover:text-primary">
                    <Avatar src={r.imageUrl} name={r.displayName} size={22} />
                    <span className="truncate">{r.displayName}</span>
                  </Link>
                </td>
                <td className="py-2.5 text-right font-medium tabular-nums">{r.score}</td>
                <td className="py-2.5 text-right tabular-nums text-muted-foreground">{r.penalty}</td>
                {contest.problems.map((p) => {
                  const cell = r.problems.find((x) => x.slug === p.slug);
                  return (
                    <td key={p.slug} className="py-2.5 text-center text-xs tabular-nums">
                      {cell?.solved ? (
                        <span className="text-emerald-700 dark:text-emerald-400">+{cell.wrong || ""}<br />{cell.minutes}m</span>
                      ) : cell && cell.wrong > 0 ? (
                        <span className="text-destructive">−{cell.wrong}</span>
                      ) : (
                        <span className="text-muted-foreground">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {contest.standings.length === 0 && (
              <tr className="border-t"><td colSpan={4 + contest.problems.length} className="px-4 py-8 text-center text-muted-foreground">No one has joined yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
