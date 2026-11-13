"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, X } from "lucide-react";
import { listContests, type ContestSummary } from "@/lib/contestApi";

const DISMISS = "sfc.contestBanner.dismissed";
const fmt = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
};

/** A site-wide strip while a contest is live (or starts within the hour). Dismissible per contest for the session. */
export function ContestBanner() {
  const pathname = usePathname();
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : sessionStorage.getItem(DISMISS);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const load = () => {
      listContests().then(setContests).catch(() => {});
    };
    load();
    const poll = setInterval(load, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  const live = contests.find((c) => Date.parse(c.startsAt) <= now && now < Date.parse(c.endsAt));
  const soon = contests.find((c) => Date.parse(c.startsAt) > now && Date.parse(c.startsAt) - now <= 60 * 60_000);
  const c = live ?? soon;
  if (!c || c.slug === dismissed || pathname.startsWith(`/contests/${c.slug}`)) return null;

  return (
    <div className="relative border-b bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/15">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-2 text-sm">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
        </span>
        <Trophy className="h-4 w-4 text-amber-700 dark:text-amber-400" />
        <span className="min-w-0 flex-1 truncate">
          <b>{c.title}</b> {live ? `is live · ${fmt(Date.parse(c.endsAt) - now)} left` : `starts in ${fmt(Date.parse(c.startsAt) - now)}`} · {c.entrants} joined
        </span>
        <Link href={`/contests/${c.slug}`} className="shrink-0 rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:opacity-90">{live ? "Join now" : "View"}</Link>
        <button
          type="button"
          aria-label="Dismiss"
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent"
          onClick={() => {
            setDismissed(c.slug);
            try {
              sessionStorage.setItem(DISMISS, c.slug);
            } catch {
              /* fine */
            }
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
