"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** A card with a soft glow that follows the cursor (Aceternity's card spotlight), as a link. */
export function SpotlightCard({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <Link
      ref={ref}
      href={href}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r || !ref.current) return;
        ref.current.style.setProperty("--x", `${e.clientX - r.left}px`);
        ref.current.style.setProperty("--y", `${e.clientY - r.top}px`);
      }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-xl",
        "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100",
        "before:[background:radial-gradient(420px_circle_at_var(--x,50%)_var(--y,50%),rgba(56,189,248,0.14),transparent_45%)]",
        className,
      )}
    >
      {children}
    </Link>
  );
}
