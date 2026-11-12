"use client";

import { useEffect, useRef } from "react";
import { PartyPopper } from "lucide-react";

/**
 * Confetti plus a toast when a solution is accepted. Pure canvas, no
 * dependency. Respects prefers-reduced-motion (toast only, no confetti).
 */
export function Celebration({ title, detail, onDone }: { title: string; detail: string; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const done = setTimeout(onDone, 4200);
    const el = canvas.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || reduce) return () => clearTimeout(done);

    const dpr = window.devicePixelRatio || 1;
    el.width = innerWidth * dpr;
    el.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ["#38bdf8", "#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#facc15"];
    const parts = Array.from({ length: 160 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      return {
        x: fromLeft ? 0 : innerWidth,
        y: innerHeight * 0.7,
        vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 9),
        vy: -(9 + Math.random() * 10),
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        w: 6 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        c: colors[i % colors.length] ?? "#38bdf8",
      };
    });
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.32;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - frame / 200);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (frame < 200) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <>
      <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />
      <div role="status" className="fixed left-1/2 top-16 z-[61] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-emerald-500/40 bg-background/95 px-5 py-3 shadow-2xl backdrop-blur animate-in fade-in zoom-in-90 slide-in-from-top-4 duration-300">
        <PartyPopper className="h-6 w-6 text-emerald-500" />
        <div>
          <div className="font-semibold text-emerald-600 dark:text-emerald-400">{title}</div>
          <div className="text-xs text-muted-foreground">{detail}</div>
        </div>
      </div>
    </>
  );
}
