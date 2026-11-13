"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthState } from "@/components/auth";
import { TIER_STYLE } from "@/components/RankBadge";
import { getMyTier, SOLVED_EVENT, type Tier } from "@/lib/communityApi";
import { cn } from "@/lib/utils";

const KEY = "sfc.tier.level";

/**
 * Shows a level-up toast when the signed-in learner reaches a new rank.
 * Checks on sign-in and after each accepted submission; the last rank seen
 * is remembered per browser, so the first visit never "levels up".
 */
export function RankWatcher() {
  const { isSignedIn, getToken } = useAuthState();
  const [up, setUp] = useState<Tier | null>(null);

  const check = useCallback(() => {
    getToken()
      .then((t) => getMyTier(t))
      .then((tier) => {
        let seen: number | null = null;
        try {
          const raw = localStorage.getItem(KEY);
          seen = raw === null ? null : Number(raw);
          localStorage.setItem(KEY, String(tier.level));
        } catch {
          return;
        }
        if (seen !== null && tier.level > seen) setUp(tier);
      })
      .catch(() => {});
  }, [getToken]);

  useEffect(() => {
    if (!isSignedIn) return;
    // A moment after sign-in, then whenever a submission is accepted (grading may lag a little).
    const first = setTimeout(check, 1500);
    const onSolved = () => setTimeout(check, 1500);
    window.addEventListener(SOLVED_EVENT, onSolved);
    return () => {
      clearTimeout(first);
      window.removeEventListener(SOLVED_EVENT, onSolved);
    };
  }, [isSignedIn, check]);

  useEffect(() => {
    if (!up) return;
    const t = setTimeout(() => setUp(null), 6000);
    return () => clearTimeout(t);
  }, [up]);

  if (!up) return null;
  const s = TIER_STYLE[up.id];
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-6 zoom-in-95 duration-500">
      <button type="button" onClick={() => setUp(null)} className="flex items-center gap-4 rounded-2xl border bg-background/95 px-5 py-4 text-left shadow-2xl backdrop-blur">
        <span className={cn("grid h-12 w-12 place-items-center rounded-xl border", s.className)}>
          <s.icon className="h-6 w-6 motion-safe:animate-bounce" />
        </span>
        <span>
          <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Rank up!</span>
          <span className="block text-lg font-semibold">You&apos;re now a {up.title}</span>
          <span className="block text-xs text-muted-foreground">{up.next ? `${up.next.min - up.points} more points to ${up.next.title}` : "The top rank. Legendary."}</span>
        </span>
      </button>
    </div>
  );
}
