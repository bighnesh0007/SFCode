"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, CircleDot, Search } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { ApiError } from "@/lib/apiClient";
import { listChallenges, type ChallengeSummary, type DifficultyDef, type Track } from "@/lib/challengesApi";
import { TRACK_INFO, isTrack, trackInfo } from "@/lib/tracks";
import { TONE_TEXT } from "@/lib/verdicts";
import { cn } from "@/lib/utils";
import { DailyCard } from "@/components/DailyCard";

type Status = "all" | "todo" | "attempted" | "solved";
const STATUS_LABEL: Record<Status, string> = { all: "Any status", todo: "Not started", attempted: "Attempted", solved: "Solved" };

/** One page for every problem track: tabs, search and filters over a dense table. */
export function ProblemsHub() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const track: Track = isTrack(params.get("track")) ? (params.get("track") as Track) : "apex";

  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const [data, setData] = useState<{ difficulties: DifficultyDef[]; challenges: ChallengeSummary[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [status, setStatus] = useState<Status>("all");

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    getToken()
      .then((token) => listChallenges(token, track))
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not load problems."));
    return () => {
      cancelled = true;
    };
  }, [isLoaded, getToken, track]);

  const tone = useMemo(() => new Map(data?.difficulties.map((d) => [d.id, d.tone]) ?? []), [data]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.challenges ?? []).filter(
      (c) =>
        (difficulty === "all" || c.difficulty === difficulty) &&
        (status === "all" || (status === "todo" ? c.progress === null : c.progress === status)) &&
        (q === "" || [c.title, c.category, ...c.tags].some((s) => s.toLowerCase().includes(q))),
    );
  }, [data, query, difficulty, status]);

  const solved = data?.challenges.filter((c) => c.progress === "solved").length ?? 0;
  const info = trackInfo(track);

  function selectTrack(next: Track) {
    setData(null);
    router.replace(`${pathname}?track=${next}`, { scroll: false });
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Problems</h1>
          <p className="mt-1 text-sm text-muted-foreground">{info.blurb} Graded by hidden tests in your connected org.</p>
        </div>
        {isSignedIn && data && (
          <p className="text-sm tabular-nums text-muted-foreground">
            <span className="font-medium text-foreground">{solved}</span> / {data.challenges.length} solved
          </p>
        )}
      </div>
      <div className="mt-5">
        <DailyCard compact />
      </div>

      {/* Track tabs */}
      <div role="tablist" aria-label="Problem track" className="mt-6 flex gap-6 border-b">
        {TRACK_INFO.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={t.id === track}
            onClick={() => selectTrack(t.id)}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors",
              t.id === track ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[12rem] flex-1">
          <span className="sr-only">Search problems</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, topic or tag"
            className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </label>
        <select aria-label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="all">Any difficulty</option>
          {data?.difficulties.map((d) => (
            <option key={d.id} value={d.id}>{d.id}</option>
          ))}
        </select>
        {isSignedIn && (
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as Status)} className="h-9 rounded-md border bg-background px-2 text-sm">
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-lg border">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="w-10 py-2.5 pl-4"><span className="sr-only">Status</span></th>
              <th className="py-2.5 pr-3">Title</th>
              <th className="hidden w-40 py-2.5 pr-3 sm:table-cell">Topic</th>
              <th className="w-24 py-2.5 pr-4 text-right">Difficulty</th>
            </tr>
          </thead>
          <tbody>
            {!data && !error
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t">
                    <td colSpan={4} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))
              : rows.map((c, i) => (
                  <tr key={c.slug} className={cn("border-t transition-colors hover:bg-accent/60", i % 2 === 1 && "bg-muted/25")}>
                    <td className="py-3 pl-4">
                      {c.progress === "solved" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" aria-label="Solved" />
                      ) : c.progress === "attempted" ? (
                        <CircleDot className="h-4 w-4 text-amber-500" aria-label="Attempted" />
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">
                      <Link href={`${info.base}/${c.slug}`} title={c.title} className="block truncate font-medium hover:text-primary">
                        {c.title}
                      </Link>
                    </td>
                    <td className="hidden truncate py-3 pr-3 text-muted-foreground sm:table-cell">{c.category}</td>
                    <td className={cn("py-3 pr-4 text-right font-medium", TONE_TEXT[tone.get(c.difficulty) ?? "amber"])}>{c.difficulty}</td>
                  </tr>
                ))}
            {data && rows.length === 0 && (
              <tr className="border-t">
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No problems match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
