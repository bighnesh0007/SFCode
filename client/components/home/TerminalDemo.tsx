"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** What a submission looks like, typed out (Aceternity's terminal). Illustrative output; starts when scrolled into view. */
const LINES: { text: string; tone?: "dim" | "ok" | "accent" }[] = [
  { text: "$ submit protect-closed-won", tone: "accent" },
  { text: "→ check-only deploy to your org (nothing is saved)", tone: "dim" },
  { text: "✓ compiled SfcProtectClosedWon.trigger", tone: "ok" },
  { text: "✓ blocksEditsToClosedWonDeals        38 ms", tone: "ok" },
  { text: "✓ allowsEditsToOpenDeals             21 ms", tone: "ok" },
  { text: "✓ handles200RecordsInOneTransaction  64 ms", tone: "ok" },
  { text: "✓ coverage 100%  ·  rolled back", tone: "ok" },
  { text: "Accepted · 3/3 hidden tests · +3 points", tone: "accent" },
];

export function TerminalDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setShown(LINES.length), 0);
      return () => clearTimeout(t);
    }
    let timer: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      timer = setInterval(() => setShown((n) => (n >= LINES.length ? n : n + 1)), 420);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
  }, []);

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border bg-zinc-950 text-zinc-100 shadow-2xl">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        <span className="ml-2 text-xs text-zinc-400">your-dev-org · check-only deploy</span>
      </div>
      <pre className="min-h-[15rem] p-4 font-mono text-[12.5px] leading-6">
        {LINES.slice(0, shown).map((l) => (
          <div key={l.text} className={cn("animate-in fade-in slide-in-from-left-1 duration-300", l.tone === "dim" && "text-zinc-400", l.tone === "ok" && "text-emerald-400", l.tone === "accent" && "font-semibold text-sky-300")}>
            {l.text}
          </div>
        ))}
        {shown < LINES.length && <span className="inline-block h-4 w-2 animate-pulse bg-zinc-300 align-middle" />}
      </pre>
    </div>
  );
}
