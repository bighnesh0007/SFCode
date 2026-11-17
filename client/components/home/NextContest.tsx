"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Swords } from "lucide-react";
import { listContests, type ContestSummary } from "@/lib/contestApi";
import { cn } from "@/lib/utils";

/** "4d 03:12:09", or "03:12:09" under a day. */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86_400);
  const hms = [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, "0")).join(":");
  return d > 0 ? `${d}d ${hms}` : hms;
}

/** The live contest, else the soonest upcoming one. */
export function pickNext(contests: ContestSummary[]): ContestSummary | null {
  const live = contests.find((c) => c.phase === "live");
  if (live) return live;
  return contests.filter((c) => c.phase === "upcoming").sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;
}

/** A ticking strip for the next Weekly / Biweekly contest. Renders nothing if none is scheduled. */
export function NextContest({ className }: { className?: string }) {
  const [next, setNext] = useState<ContestSummary | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    listContests().then((list) => setNext(pickNext(list))).catch(() => {});
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  if (!next || now === null) return null;
  const live = next.phase === "live" && Date.parse(next.endsAt) > now;
  const target = live ? Date.parse(next.endsAt) : Date.parse(next.startsAt);
  return (
    <Link
      href={`/contests/${next.slug}`}
      className={cn(
        "group flex w-full items-center gap-3 rounded-full sm:inline-flex sm:w-auto sm:max-w-full border bg-background/70 py-1.5 pl-1.5 pr-4 text-sm backdrop-blur transition-colors hover:border-orange-500/50",
        className,
      )}
    >
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", live ? "bg-rose-500 text-white" : "bg-orange-500/15 text-orange-600 dark:text-orange-400")}>
        <Swords className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 truncate">
        {live && <span className="mr-1.5 inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />LIVE</span>}
        <span className="font-medium">{next.title}</span>
        <span className="text-muted-foreground"> · {live ? "ends in" : "starts in"} </span>
        <span className="font-mono tabular-nums">{countdown(target - now)}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
