"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Check, Flame } from "lucide-react";
import { useAuthState } from "@/components/auth";
import type { Track } from "@/lib/challengesApi";
import { getDaily, type DailyView } from "@/lib/dailyApi";
import { trackInfo } from "@/lib/tracks";
import { cn } from "@/lib/utils";

function hms(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Today's problem, the bonus, the learner's daily streak and a countdown to the next one. */
export function DailyCard({ compact = false }: { compact?: boolean }) {
  const { isSignedIn, getToken } = useAuthState();
  const [daily, setDaily] = useState<DailyView | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getToken()
      .then((t) => getDaily(t))
      .then((d) => {
        if (cancelled) return;
        setDaily(d);
        setLoadedAt(Date.now());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!daily) return compact ? null : <div className="h-28 animate-pulse rounded-xl border bg-muted/40" />;
  const left = Math.max(0, daily.resetsIn - Math.floor(((now || loadedAt) - loadedAt) / 1000));
  const info = trackInfo(daily.problem.track as Track);
  const done = daily.solvedToday === true;

  return (
    <Link
      href={`${info.base}/${daily.problem.slug}`}
      className={cn(
        "group relative flex flex-wrap items-center gap-4 overflow-hidden rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg",
        done ? "border-emerald-500/50 bg-emerald-500/5" : "border-sky-500/40 bg-gradient-to-r from-sky-500/10 via-indigo-500/5 to-transparent",
      )}
    >
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-lg text-white", done ? "bg-emerald-500" : "bg-gradient-to-br from-sky-400 to-indigo-500")}>
        {done ? <Check className="h-6 w-6" /> : <CalendarCheck className="h-6 w-6" />}
      </span>
      <div className="min-w-[12rem] flex-1">
        <div className="text-xs font-medium uppercase tracking-wide text-sky-700 dark:text-sky-400">Daily Challenge · {daily.day}</div>
        <div className="truncate font-semibold">{daily.problem.title}</div>
        <div className="text-xs text-muted-foreground">
          {info.label} · {daily.problem.difficulty} · {done ? "Solved today. Come back tomorrow!" : `+${daily.bonus} bonus coins if you solve it today`}
        </div>
      </div>
      <div className="flex w-full items-center justify-end gap-4 text-sm sm:w-auto">
        {daily.streak !== null && daily.streak > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-orange-500" title="Days in a row you've solved the Daily Challenge">
            <Flame className="h-4 w-4" /> {daily.streak}
          </span>
        )}
        <span className="tabular-nums text-xs text-muted-foreground" title="Until the next Daily Challenge (UTC midnight)">New in {hms(left)}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
