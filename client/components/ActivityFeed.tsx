"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Newspaper, PenLine, Sparkles } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuthState } from "@/components/auth";
import type { Track } from "@/lib/challengesApi";
import { ago, getFeed, type FeedItem } from "@/lib/socialApi";
import { trackInfo } from "@/lib/tracks";
import { cn } from "@/lib/utils";

const ICON = { solve: CheckCircle2, rank: Sparkles, problem: PenLine, post: Newspaper } as const;
const TONE = { solve: "text-emerald-500", rank: "text-amber-500", problem: "text-sky-500", post: "text-violet-500" } as const;

function Line({ item }: { item: FeedItem }) {
  const who = <Link href={`/u/${item.actor.handle}`} className="font-medium hover:underline">{item.actor.displayName}</Link>;
  switch (item.kind) {
    case "solve":
      return <>{who} solved <Link href={`${trackInfo(item.problem.track as Track).base}/${item.problem.slug}`} className="font-medium text-sky-600 hover:underline dark:text-sky-400">{item.problem.title}</Link> <span className="text-muted-foreground">· {trackInfo(item.problem.track as Track).label} {item.problem.difficulty}</span></>;
    case "rank":
      return <>{who} reached <b>{item.rank.title}</b> 🎉</>;
    case "problem":
      return <>{who} published a community problem: <Link href={`${trackInfo(item.problem.track as Track).base}/${item.problem.slug}`} className="font-medium text-sky-600 hover:underline dark:text-sky-400">{item.problem.title}</Link></>;
    case "post":
      return <>{who} wrote <Link href={`/blog/${item.post.slug}`} className="font-medium text-sky-600 hover:underline dark:text-sky-400">{item.post.title}</Link></>;
  }
}

/** What the community (or the people you follow) did in the last two weeks. */
export function ActivityFeed() {
  const { isSignedIn, getToken } = useAuthState();
  const [scope, setScope] = useState<"following" | "everyone">("everyone");
  const [items, setItems] = useState<FeedItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getToken()
      .then((t) => getFeed(t, scope))
      .then((f) => !cancelled && setItems(f))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [getToken, scope, isSignedIn]);

  return (
    <section className="rounded-xl border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Community activity</h2>
        {isSignedIn && (
          <div role="tablist" className="flex rounded-md border p-0.5 text-xs">
            {(["everyone", "following"] as const).map((s) => (
              <button key={s} role="tab" type="button" aria-selected={scope === s} onClick={() => { setItems(null); setScope(s); }} className={cn("rounded px-2.5 py-1 capitalize", scope === s ? "bg-accent font-medium" : "text-muted-foreground")}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <ul className="mt-4 space-y-3">
        {items === null && Array.from({ length: 4 }).map((_, i) => <li key={i} className="h-8 animate-pulse rounded bg-muted/50" />)}
        {items?.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">
            {scope === "following" ? "Nothing yet from people you follow. Follow learners from the leaderboard." : "Quiet so far. Solve something and be first!"}
          </li>
        )}
        {items?.map((it, i) => {
          const Icon = ICON[it.kind];
          return (
            <li key={`${it.kind}-${it.at}-${i}`} className="flex items-start gap-3 text-sm animate-in fade-in slide-in-from-bottom-1" style={{ animationDelay: `${Math.min(i, 10) * 40}ms`, animationFillMode: "both" }}>
              <Avatar src={it.actor.imageUrl} name={it.actor.displayName} size={28} />
              <div className="min-w-0 flex-1 leading-snug">
                <Line item={it} />
              </div>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><Icon className={cn("h-3.5 w-3.5", TONE[it.kind])} />{ago(it.at)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
