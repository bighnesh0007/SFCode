"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Fades and lifts its children in the first time they scroll into view.
 * Content is visible until hydration (no blank page without JS), and under
 * reduced motion the CSS skips the movement.
 */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"ssr" | "hidden" | "shown">("ssr");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Already on screen at load: never hide it.
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    const hide = setTimeout(() => setState("hidden"), 0);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        setState("shown");
        io.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => {
      clearTimeout(hide);
      io.disconnect();
    };
  }, []);
  return (
    <div ref={ref} className={cn(state !== "ssr" && "sfc-reveal", state === "shown" && "is-in", className)} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
