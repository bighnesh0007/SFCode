"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthState } from "@/components/auth";
import { CheckCircle2, ChevronLeft, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import { ApiError } from "@/lib/apiClient";
import { getPractice, submitAnswer, type AnswerResult, type PracticeQuestion } from "@/lib/certificationApi";
import { cn } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui/skeleton";

/** `load` overrides where questions come from (spaced review uses it); default is a shuffled set for the exam/section. */
export function PracticeSession({ exam, section, load, title }: { exam: string; section: string | null; load?: () => Promise<PracticeQuestion[]>; title?: string }) {
  const { getToken } = useAuthState();
  const [questions, setQuestions] = useState<PracticeQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (load ? load() : getPractice(exam, section))
      .then((q) => !cancelled && setQuestions(q))
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not load questions."));
    return () => {
      cancelled = true;
    };
    // `load` is stable per page; refetching on each render would reset the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam, section, round]);

  function restart() {
    setQuestions(null);
    setIndex(0);
    setSelected([]);
    setResult(null);
    setScore(0);
    setRound((r) => r + 1);
  }

  if (error)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
        <p className="text-muted-foreground">{error}</p>
        <Link href="/certification" className="text-sm text-primary underline">All exams</Link>
      </div>
    );
  if (!questions)
    return (
      <PageSkeleton blocks={4} className="max-w-3xl" />
    );

  const done = index >= questions.length;
  const q = questions[index];

  async function check() {
    if (!q) return;
    setChecking(true);
    try {
      const r = await submitAnswer(await getToken(), q.id, selected);
      setResult(r);
      if (r.correct) setScore((s) => s + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not check your answer.");
    } finally {
      setChecking(false);
    }
  }

  function toggle(id: string) {
    if (result || !q) return;
    if (q.choose === 1) setSelected([id]);
    else setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function next() {
    setIndex((i) => i + 1);
    setSelected([]);
    setResult(null);
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between text-sm">
        <Link href="/certification" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> All exams
        </Link>
        <h1 className="font-medium">{title ?? "Practice questions"}</h1>
        <span className="tabular-nums text-muted-foreground">
          {done ? `${questions.length}/${questions.length}` : `Question ${index + 1} of ${questions.length}`} · {score} correct
        </span>
      </div>

      {done ? (
        <div className="rounded-xl border p-8 text-center">
          <h2 className="text-2xl font-bold">
            {score}/{questions.length} correct
          </h2>
          <p className="mt-2 text-muted-foreground">
            {load
              ? "Each question comes back later: sooner if you missed it, later each time you get it right."
              : score === questions.length
                ? "A clean sweep."
                : "Review the explanations, then go again — questions are shuffled each round."}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={restart}>
              <RotateCcw className="mr-1 h-4 w-4" /> {load ? "Anything else due?" : "Practice again"}
            </Button>
            <Link href="/certification" className={buttonVariants({ variant: "outline" })}>All exams</Link>
          </div>
        </div>
      ) : q ? (
        <div className="space-y-5">
          <Markdown source={q.prompt} className="markdown text-base" />
          <p className="text-xs text-muted-foreground">
            {q.choose === 1 ? "Choose one." : `Choose ${q.choose}.`}
            {q.community && <span className="ml-2 rounded-full border px-2 py-0.5">Community question</span>}
          </p>
          <div className="space-y-2" role={q.choose === 1 ? "radiogroup" : "group"} aria-label="Answer options">
            {q.options.map((o) => {
              const picked = selected.includes(o.id);
              const isAnswer = result?.answer.includes(o.id) ?? false;
              return (
                <div key={o.id}>
                  <button
                    type="button"
                    role={q.choose === 1 ? "radio" : "checkbox"}
                    aria-checked={picked}
                    disabled={result !== null}
                    onClick={() => toggle(o.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                      !result && (picked ? "border-primary bg-primary/10" : "hover:bg-accent/50"),
                      result && isAnswer && "border-green-500/60 bg-green-500/10",
                      result && picked && !isAnswer && "border-red-500/60 bg-red-500/10",
                    )}
                  >
                    <span className="mt-0.5 font-mono text-xs uppercase text-muted-foreground">{o.id}</span>
                    <Markdown source={o.text} className="markdown flex-1 [&_p]:m-0" />
                    {result && isAnswer && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-700 dark:text-green-400" />}
                    {result && picked && !isAnswer && <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
                  </button>
                </div>
              );
            })}
          </div>

          {result && (
            <div className={cn("rounded-lg border p-4", result.correct ? "border-green-500/40" : "border-red-500/40")}>
              <p className={cn("mb-2 font-semibold", result.correct ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                {result.correct ? "Correct" : "Not quite"}
              </p>
              <Markdown source={result.explanation} className="markdown text-sm" />
            </div>
          )}

          <div className="flex justify-end">
            {result ? (
              <Button onClick={next}>{index + 1 === questions.length ? "See results" : "Next question"}</Button>
            ) : (
              <Button disabled={selected.length !== q.choose || checking} onClick={() => void check()}>
                {checking && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Check answer
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
