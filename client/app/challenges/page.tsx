"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/apiClient";
import { listChallenges, type ChallengeSummary, type DifficultyDef } from "@/lib/challengesApi";
import { TONE_ACCENT, TONE_TEXT } from "@/lib/verdicts";
import { cn } from "@/lib/utils";

const ALL = "All";

export default function ChallengesPage() {
  const { isLoaded, getToken } = useAuth();
  const [data, setData] = useState<{ difficulties: DifficultyDef[]; challenges: ChallengeSummary[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(ALL);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    getToken()
      .then((token) => listChallenges(token))
      .then((d) => !cancelled && setData(d))
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not load challenges."));
    return () => {
      cancelled = true;
    };
  }, [isLoaded, getToken]);

  const tone = useMemo(() => new Map(data?.difficulties.map((d) => [d.id, d.tone]) ?? []), [data]);
  const categories = useMemo(() => [ALL, ...new Set(data?.challenges.map((c) => c.category) ?? [])], [data]);
  const rows = data?.challenges.filter((c) => category === ALL || c.category === category) ?? [];
  const solved = data?.challenges.filter((c) => c.progress === "solved").length ?? 0;

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Apex Challenge Arena</h1>
        <p className="mt-1 text-muted-foreground">
          Triggers, classes, Batch and async Apex — graded by hidden Apex tests in your connected org. Grading is a
          check-only deploy, so nothing is left behind in the org.
        </p>
      </div>

      {data && data.challenges.length > 0 && (
        <div className="rounded-lg border p-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Progress</span>
            <span className="tabular-nums text-muted-foreground">
              {solved}/{data.challenges.length} solved
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={solved} aria-valuemin={0} aria-valuemax={data.challenges.length} aria-label={`${solved} of ${data.challenges.length} challenges solved`}>
            <div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(solved / data.challenges.length) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Badge key={c} variant={category === c ? "default" : "secondary"} className="cursor-pointer select-none" onClick={() => setCategory(c)}>
            {c}
          </Badge>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-lg border">
        {/* Fixed layout: Title takes whatever the fixed-width columns leave. */}
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-10 text-center">✓</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="hidden w-32 md:table-cell">Category</TableHead>
              <TableHead className="hidden w-64 md:table-cell">Tags</TableHead>
              <TableHead className="w-24 text-right">Difficulty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data && !error
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <div className="h-5 w-full animate-pulse rounded bg-muted/50" />
                    </TableCell>
                  </TableRow>
                ))
              : rows.map((c) => {
                  const t = tone.get(c.difficulty) ?? "amber";
                  return (
                    <TableRow key={c.slug} className="group h-14">
                      {/* The difficulty accent hangs off the first CELL: a ::before on the <tr>
                          is laid out as an extra table cell and shifts every column right. */}
                      <TableCell
                        className={cn(
                          "relative text-center before:absolute before:left-0 before:top-0 before:h-full before:w-[3px]",
                          c.progress === "solved" ? "before:opacity-0" : `${TONE_ACCENT[t]} before:opacity-60 group-hover:before:opacity-100`,
                        )}
                      >
                        {c.progress === "solved" ? (
                          <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" aria-label="Solved" />
                        ) : c.progress === "attempted" ? (
                          <CircleDot className="mx-auto h-4 w-4 text-amber-500" aria-label="Attempted" />
                        ) : (
                          <Circle className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="Not started" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/challenges/${c.slug}`} title={c.title} className={cn("block truncate underline-offset-2 hover:text-primary group-hover:underline", c.progress === "solved" && "text-muted-foreground")}>
                          {c.title}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{c.category}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-nowrap gap-1 overflow-hidden">
                          {c.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="outline" className="shrink-0 whitespace-nowrap py-0 text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className={cn("text-right text-sm font-medium", TONE_TEXT[t])}>{c.difficulty}</TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
