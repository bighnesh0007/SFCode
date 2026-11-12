"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { GraduationCap, Play } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/apiClient";
import { listExams, type ExamSummary } from "@/lib/certificationApi";

export default function CertificationPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Certification Prep</h1>
        <p className="mt-1 text-muted-foreground">
          Original practice questions for the Salesforce Platform Developer exams, organised by the official exam
          sections. Every answer comes with an explanation.{!isSignedIn && " Sign in to save your progress."}
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {exams === null && !error
          ? [0, 1].map((i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-muted/50" />)
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
                  <Link href={`/certification/${e.exam}`} className={buttonVariants({ className: "w-full" })}>
                    <Play className="mr-1 h-4 w-4" /> Practice 10 mixed questions
                  </Link>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}
