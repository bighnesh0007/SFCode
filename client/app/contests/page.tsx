"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Swords, Trophy } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { getStanding } from "@/lib/adminApi";
import { ApiError } from "@/lib/apiClient";
import { listContests, type ContestPhase, type ContestSummary } from "@/lib/contestApi";
import { ContestForm } from "@/components/admin/ContestForm";
import { PhasePill } from "@/components/PhasePill";
import { EmptyState } from "@/components/EmptyState";

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function ContestsPage() {
  const { isSignedIn, getToken } = useAuthState();
  const [contests, setContests] = useState<ContestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listContests()
      .then((c) => !cancelled && setContests(c))
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not load contests."));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  // Convenience only: the server re-checks admin standing on create.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    getToken()
      .then((t) => getStanding(t))
      .then((s) => !cancelled && setIsAdmin(s === "owner" || s === "admin"))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  const order: ContestPhase[] = ["live", "upcoming", "ended"];
  const sorted = [...(contests ?? [])].sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase) || (a.phase === "ended" ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Contests</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Timed rounds graded in your own org. Join, solve as many as you can before the clock runs out. Ties break on penalty: minutes to each solve plus 5 per wrong attempt. The top three win 100 / 50 / 25 coins for the <Link href="/store" className="underline underline-offset-2">store</Link>.
      </p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {isAdmin && isSignedIn && <ContestForm onSaved={() => setReload((n) => n + 1)} />}
      <ul className="mt-6 divide-y overflow-hidden rounded-lg border">
        {contests === null && !error && Array.from({ length: 3 }).map((_, i) => <li key={i} className="p-4"><div className="h-5 animate-pulse rounded bg-muted" /></li>)}
        {sorted.map((c) => (
          <li key={c.slug}>
            <Link href={`/contests/${c.slug}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-accent/60">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
              <PhasePill phase={c.phase} />
              <span className="w-full text-xs text-muted-foreground sm:w-auto">{fmt(c.startsAt)} · {c.problemCount} problems · {c.entrants} joined</span>
            </Link>
          </li>
        ))}
        {contests?.length === 0 && (
          <li>
            <EmptyState icon={Swords} title="No contests scheduled yet" action={{ href: "/problems", label: "Practise in the meantime" }}>
              Contests are timed sets of problems with a live leaderboard. The next one will be announced here.
            </EmptyState>
          </li>
        )}
      </ul>
    </div>
  );
}

/** Local datetime-local value, an hour from now on the hour. */
