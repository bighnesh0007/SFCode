"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useAuthState } from "@/components/auth";
import { GraduationCap, Play, Timer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/apiClient";
import { getReview, listExams, type ExamSummary, type ReviewQueue } from "@/lib/certificationApi";
import { cn } from "@/lib/utils";
import { BrainCircuit } from "lucide-react";

/** `initial` is the anonymous exam list rendered on the server; signed-in readiness is fetched on top. */
export function CertificationHub({ initial }: { initial?: ExamSummary[] }) {
  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const [exams, setExams] = useState<ExamSummary[] | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    getToken()
      .then((token) => listExams(token))
      .then((e) => !cancelled && setExams(e))
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not load exams."));
    return () => {
      cancelled = true;
    };
  }, [isLoaded, getToken]);

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-10">
      <PageHeader
        title="Certification Prep"
        description={
          <>
            Original practice questions for Salesforce certifications, organised by the official exam sections. Every answer comes with an
            explanation, and each exam has a timed mock weighted like the real one.{!isSignedIn && " Sign in to save your progress."}
          </>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ReviewCard />
      <div className="grid gap-4 md:grid-cols-2">
        {exams === null && !error
          ? [0, 1, 2].map((i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-muted/50" />)
          : exams?.map((e) => (
              <Card key={e.exam}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <CardTitle>{e.title}</CardTitle>
                  </div>
                  <CardDescription>
                    {e.description} · {e.questionCount} questions
                  </CardDescription>
                  {e.readiness !== null && (
                    <div className="mt-3 rounded-lg border p-3">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium">Exam readiness</span>
                        <span className={cn("text-lg font-semibold tabular-nums", e.readiness >= 70 ? "text-emerald-700 dark:text-emerald-400" : e.readiness >= 40 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>{e.readiness}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full transition-all duration-700", e.readiness >= 70 ? "bg-emerald-500" : e.readiness >= 40 ? "bg-amber-500" : "bg-sky-500")} style={{ width: `${e.readiness}%` }} />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Questions you&apos;ve got right, averaged across sections.
                        {e.weakest && (
                          <>
                            {" "}Weakest:{" "}
                            <Link href={`/certification/${e.exam}?section=${e.weakest}`} className="font-medium text-sky-700 hover:underline dark:text-sky-400">
                              {e.sections.find((s) => s.id === e.weakest)?.title ?? e.weakest} →
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2.5">
                    {e.sections.map((s) => {
                      const pct = s.answered === null ? null : Math.round(((s.correct ?? 0) / s.total) * 100);
                      return (
                        <li key={s.id} className="text-sm">
                          <div className="flex items-baseline justify-between gap-2">
                            <Link href={`/certification/${e.exam}?section=${s.id}`} className="hover:text-primary hover:underline">
                              {s.title}
                            </Link>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {s.answered === null ? `${s.total} question${s.total === 1 ? "" : "s"}` : `${s.correct}/${s.total} correct`}
                            </span>
                          </div>
                          {pct !== null && (
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.title}: ${pct}% correct`}>
                              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Link href={`/certification/${e.exam}`} className={buttonVariants({ className: "flex-1" })}>
                      <Play className="mr-1 h-4 w-4" /> Practice 10 questions
                    </Link>
                    {e.mock && (
                      <Link href={`/certification/${e.exam}/mock`} className={buttonVariants({ variant: "outline", className: "flex-1" })}>
                        <Timer className="mr-1 h-4 w-4" /> Timed mock exam
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}

/** Missed questions due for spaced review (signed-in only). */
function ReviewCard() {
  const { isSignedIn, getToken } = useAuthState();
  const [q, setQ] = useState<ReviewQueue | null>(null);
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    getToken()
      .then((t) => getReview(t))
      .then((r) => !cancelled && setQ(r))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);
  if (!q || (q.due.length === 0 && q.upcoming === 0)) return null;
  return (
    <Link href="/certification/review" className="mb-6 flex items-center gap-4 rounded-xl border border-sky-500/40 bg-sky-500/5 p-4 transition-colors hover:bg-sky-500/10">
      <BrainCircuit className="h-8 w-8 shrink-0 text-sky-700 dark:text-sky-400" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{q.due.length > 0 ? `${q.due.length} question${q.due.length === 1 ? "" : "s"} to review` : "All caught up"}</p>
        <p className="text-xs text-muted-foreground">Questions you missed come back on a schedule until they stick. {q.upcoming} waiting · {q.mastered} mastered</p>
      </div>
      {q.due.length > 0 && <span className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-medium text-white">Review</span>}
    </Link>
  );
}
