"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/apiClient";

interface SiteStats {
  problems: number;
  communityProblems: number;
  learners: number;
  solvesThisWeek: number;
}

/** Counts up from 0 once visible (instantly under reduced motion). */
function Ticker({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setShown(value), 0);
      return () => clearTimeout(t);
    }
    let raf = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / 1200);
        setShown(Math.round(value * (1 - (1 - p) ** 3)));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    // Animation frames pause in background tabs; never leave a half-counted number.
    const settle = setTimeout(() => setShown(value), 1600);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(settle);
    };
  }, [value]);
  return <span ref={ref} className="tabular-nums">{shown.toLocaleString()}</span>;
}

export function LiveStats() {
  const [stats, setStats] = useState<SiteStats | null>(null);
  useEffect(() => {
    apiRequest<SiteStats>("/api/v1/stats").then(setStats).catch(() => {});
  }, []);
  const items: [string, number | undefined][] = [
    ["problems", stats?.problems],
    ["learners", stats?.learners],
    ["solves this week", stats?.solvesThisWeek],
  ];
  return (
    <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
      {items.map(([label, n]) => (
        <div key={label}>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-3xl font-semibold">{n === undefined ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-muted align-middle" /> : <Ticker value={n} />}</dd>
        </div>
      ))}
    </dl>
  );
}
