"use client";

import { useEffect, useState } from "react";
import { Ruler } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { getSolutionSize, type SizeStats } from "@/lib/challengesApi";
import { SOLVED_EVENT } from "@/lib/communityApi";

/**
 * After a solve: your solution's size next to everyone else's. Size is the
 * fair comparison here; run time depends on each learner's own org.
 */
export function SolutionSize({ slug }: { slug: string }) {
  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const [stats, setStats] = useState<SizeStats | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onSolved = () => setTick((t) => t + 1);
    window.addEventListener(SOLVED_EVENT, onSolved);
    return () => window.removeEventListener(SOLVED_EVENT, onSolved);
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    getToken()
      .then((t) => getSolutionSize(t, slug))
      .then((s) => !cancelled && setStats(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, slug, tick]);

  if (!stats) return null;
  const others = stats.solvers - 1;
  // The bar runs from the smallest solution (left) to twice the median, capped.
  const span = Math.max(stats.median * 2 - stats.smallest, 1);
  const at = (n: number) => `${Math.min(100, Math.max(0, ((n - stats.smallest) / span) * 100))}%`;
  return (
    <section className="mt-6 rounded-lg border px-3 py-3 text-sm">
      <header className="flex items-center gap-2 font-medium">
        <Ruler className="h-4 w-4 text-sky-700 dark:text-sky-400" aria-hidden="true" />
        Solution size
        <span className="ml-auto font-mono text-xs font-normal tabular-nums text-muted-foreground">{stats.mine} chars</span>
      </header>
      {others === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">You&apos;re the first to solve this. Others will be compared with you.</p>
      ) : (
        <>
          <p className="mt-2">
            Smaller than <span className="font-semibold tabular-nums">{stats.smallerThan}%</span> of the {others} other {others === 1 ? "solver" : "solvers"}.
          </p>
          <div className="relative mt-3 h-2 rounded-full bg-muted" aria-hidden="true">
            <span className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-muted-foreground/60" style={{ left: at(stats.median) }} />
            <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-600 ring-2 ring-background" style={{ left: at(stats.mine) }} />
          </div>
          <p className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>smallest {stats.smallest}</span>
            <span>median {stats.median}</span>
          </p>
        </>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Characters of code, not counting comments or whitespace. Shorter isn&apos;t always better: readable and bulk-safe beats clever.</p>
    </section>
  );
}
