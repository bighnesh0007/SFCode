"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Flame, Snowflake, Swords, Target, Trophy } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { RatingTier } from "@/components/RatingTier";
import { getMyProfile, type ProfileView } from "@/lib/communityApi";
import { listContests, type ContestSummary } from "@/lib/contestApi";
import { getDaily, type DailyView } from "@/lib/dailyApi";
import type { Track } from "@/lib/challengesApi";
import { trackInfo } from "@/lib/tracks";
import { cn } from "@/lib/utils";
import { countdown, pickNext } from "./NextContest";

function Tile({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("group relative flex flex-col overflow-hidden rounded-2xl border bg-card/70 p-5 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-lg hover:shadow-sky-500/5", className)}>
      {children}
    </Link>
  );
}

const Label = ({ icon: Icon, tone, children }: { icon: typeof Flame; tone: string; children: React.ReactNode }) => (
  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Icon className={cn("h-4 w-4", tone)} />{children}</span>
);

/** The track you're furthest into but haven't finished: the natural "keep going". */
function nextTrack(p: ProfileView) {
  const open = p.byTrack.filter((t) => t.solved < t.total);
  return open.sort((a, b) => b.solved / b.total - a.solved / a.total)[0] ?? null;
}

/**
 * Signed in, the home page opens on you: streak, today's challenge, your
 * rank, the next contest and where to pick up. Signed out it renders nothing
 * and the marketing page carries on below.
 */
export function HomeDashboard() {
  const { isSignedIn, getToken } = useAuthState();
  const [me, setMe] = useState<ProfileView | null>(null);
  const [daily, setDaily] = useState<DailyView | null>(null);
  const [contest, setContest] = useState<ContestSummary | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!isSignedIn) return;
    let live = true;
    getToken()
      .then((t) => Promise.all([getMyProfile(t), getDaily(t).catch(() => null), listContests().catch(() => [])]))
      .then(([p, d, c]) => {
        if (!live) return;
        setMe(p);
        setDaily(d);
        setContest(pickNext(c));
      })
      .catch(() => {});
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 30_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [isSignedIn, getToken]);

  if (!isSignedIn || !me) return null;
  const track = nextTrack(me);
  const streak = me.stats.streak;
  const contestLive = contest?.phase === "live";
  return (
    <section className="relative border-b bg-gradient-to-b from-sky-500/[0.06] to-transparent">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back,</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{me.displayName} 👋</h1>
          </div>
          <Link href="/profile" className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-400">Your profile →</Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile href="/profile" className={streak > 0 ? "border-orange-500/30" : undefined}>
            <Label icon={Flame} tone={streak > 0 ? "text-orange-500" : "text-muted-foreground"}>Streak</Label>
            <span className="mt-3 flex items-baseline gap-1.5">
              <span className={cn("text-4xl font-semibold tabular-nums", streak > 0 && "sfc-name-flame")}>{streak}</span>
              <span className="text-sm text-muted-foreground">day{streak === 1 ? "" : "s"}</span>
            </span>
            <span className="mt-auto flex items-center gap-3 pt-3 text-xs text-muted-foreground">
              <span>Best {me.stats.longestStreak}</span>
              {me.stats.freezesLeft > 0 && <span className="inline-flex items-center gap-1"><Snowflake className="h-3 w-3 text-sky-500" />{me.stats.freezesLeft} freeze{me.stats.freezesLeft === 1 ? "" : "s"}</span>}
            </span>
          </Tile>

          <Tile href={daily ? `${trackInfo(daily.problem.track as Track).base}/${daily.problem.slug}` : "/problems"}>
            <Label icon={CalendarCheck} tone="text-sky-600 dark:text-sky-400">Daily challenge</Label>
            {daily ? (
              <>
                <span className="mt-3 line-clamp-2 font-semibold">{daily.problem.title}</span>
                <span className="mt-1 text-xs text-muted-foreground">{daily.problem.difficulty} · {trackInfo(daily.problem.track as Track).label}</span>
                <span className={cn("mt-auto pt-3 text-xs font-medium", daily.solvedToday ? "text-emerald-600 dark:text-emerald-400" : "text-sky-700 dark:text-sky-400")}>
                  {daily.solvedToday ? "✓ Solved today. Nice." : `Solve it for +${daily.bonus} coins →`}
                </span>
              </>
            ) : (
              <span className="mt-3 text-sm text-muted-foreground">Today&apos;s problem is loading…</span>
            )}
          </Tile>

          <Tile href="/leaderboard">
            <Label icon={Trophy} tone="text-amber-500">{me.tier.title}</Label>
            <span className="mt-3 flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold tabular-nums">{me.score}</span>
              <span className="text-sm text-muted-foreground">pts{me.rank ? ` · #${me.rank}` : ""}</span>
            </span>
            <span className="mt-auto pt-3">
              <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500" style={{ width: `${me.tier.progress}%` }} />
              </span>
              <span className="mt-1.5 block text-xs text-muted-foreground">{me.tier.next ? `${me.tier.next.min - me.score} pts to ${me.tier.next.title}` : "Top rank reached 👑"}</span>
            </span>
          </Tile>

          <Tile href={contest ? `/contests/${contest.slug}` : "/contests"} className={contestLive ? "border-rose-500/40" : undefined}>
            <Label icon={Swords} tone={contestLive ? "text-rose-500" : "text-orange-500"}>{contestLive ? "Live now" : "Next contest"}</Label>
            {contest ? (
              <>
                <span className="mt-3 font-semibold">{contest.title}</span>
                <span className="mt-1 font-mono text-sm tabular-nums text-muted-foreground">
                  {contestLive ? "ends in " : "in "}
                  {countdown(Date.parse(contestLive ? contest.endsAt : contest.startsAt) - now)}
                </span>
              </>
            ) : (
              <span className="mt-3 text-sm text-muted-foreground">No contest scheduled.</span>
            )}
            <span className="mt-auto flex items-center gap-2 pt-3 text-xs text-muted-foreground">
              {me.rating ? (
                <>
                  <RatingTier tier={me.rating.tier} /> <span className="tabular-nums">{me.rating.current}</span>
                </>
              ) : (
                "Unrated: your first contest sets it"
              )}
            </span>
          </Tile>
        </div>

        {track && (
          <Link href={`/problems?track=${track.track}`} className="group mt-3 flex items-center gap-4 rounded-2xl border bg-card/70 p-4 transition-colors hover:border-sky-500/40">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10"><Target className="h-5 w-5 text-sky-600 dark:text-sky-400" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Keep going in {trackInfo(track.track).label}</span>
              <span className="mt-1.5 flex items-center gap-3">
                <span className="h-1.5 max-w-xs flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-sky-500" style={{ width: `${Math.round((track.solved / track.total) * 100)}%` }} />
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">{track.solved}/{track.total} solved</span>
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>
    </section>
  );
}
