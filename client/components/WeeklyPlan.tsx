"use client";

import Link from "next/link";
import { BookOpen, CalendarDays, CircleHelp, Code2 } from "lucide-react";
import type { Track } from "@/lib/challengesApi";
import type { Hours, RoadmapNode, RoadmapView } from "@/lib/roadmapApi";
import { trackInfo } from "@/lib/tracks";

/** Rough items per week for the time a learner said they have (a problem or quiz ≈ 30-45 min). */
const PER_WEEK: Record<Hours, number> = { "1-2": 2, "3-5": 5, "5+": 8 };

interface Item {
  key: string;
  label: string;
  detail: string;
  node: RoadmapNode;
  href?: string;
  icon: typeof Code2;
}

/** The next things to do on the path, in roadmap order: unsolved problems, quizzes, then reading. */
export function planItems(view: RoadmapView, count: number): Item[] {
  const open = [...view.nodes].filter((n) => n.state === "in_progress" || n.state === "available").sort((a, b) => a.depth - b.depth || a.col - b.col);
  const items: Item[] = [];
  for (const n of open) {
    for (const p of n.problems.filter((p) => p.status !== "solved")) {
      items.push({ key: p.slug, label: p.title, detail: `${n.title} · ${trackInfo(p.track as Track).label} · ${p.difficulty}`, node: n, href: `${trackInfo(p.track as Track).base}/${p.slug}`, icon: Code2 });
    }
    if (n.completeByQuiz) items.push({ key: `${n.id}:quiz`, label: `Pass the "${n.title}" quiz`, detail: `${n.quiz?.length ?? 0} questions`, node: n, icon: CircleHelp });
    else if (n.completeByReading && !n.read) items.push({ key: `${n.id}:read`, label: n.problems.length ? `Finish ${n.title}` : `Read: ${n.title}`, detail: n.summary, node: n, icon: BookOpen });
    if (items.length >= count) break;
  }
  return items.slice(0, count);
}

export function WeeklyPlan({ view, hours, onOpen }: { view: RoadmapView; hours: Hours; onOpen: (nodeId: string) => void }) {
  const items = planItems(view, PER_WEEK[hours]);
  if (items.length === 0) return null;
  return (
    <section className="mt-6 rounded-xl border bg-gradient-to-br from-sky-500/5 to-transparent p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-sky-700 dark:text-sky-400" /> Your plan this week</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {items.length} item{items.length === 1 ? "" : "s"} for {hours} hours a week. It updates as you go: finished items drop off and the next ones move up.
      </p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((it, i) => {
          const body = (
            <>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-700 dark:text-sky-300">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-sm font-medium"><it.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{it.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{it.detail}</span>
              </span>
            </>
          );
          const cls = "flex w-full items-center gap-3 rounded-lg border bg-background p-2.5 text-left transition-colors hover:border-sky-500/60";
          return (
            <li key={it.key}>
              {it.href ? <Link href={it.href} className={cls}>{body}</Link> : <button type="button" onClick={() => onOpen(it.node.id)} className={cls}>{body}</button>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
