"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuthState } from "@/components/auth";
import { CheckCircle2, ChevronLeft, ChevronRight, Flag, Loader2, Timer, XCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import { ApiError } from "@/lib/apiClient";
import { getMock, gradeMock, type MockExam, type MockResult } from "@/lib/certificationApi";
import { cn } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui/skeleton";

type Phase = { kind: "intro" } | { kind: "running"; endsAt: number } | { kind: "grading" } | { kind: "done"; result: MockResult; usedMs: number };

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export function MockExamSession({ exam }: { exam: string }) {
  const { getToken, isSignedIn } = useAuthState();
  const [mock, setMock] = useState<MockExam | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const startedAt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    getMock(exam)
      .then((m) => !cancelled && setMock(m))
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not load the mock exam."));
    return () => {
      cancelled = true;
    };
  }, [exam]);

  const submit = useCallback(async () => {
    if (!mock) return;
    setPhase({ kind: "grading" });
    // Every question is sent, unanswered as [], so the score is out of the whole exam.
    const all = Object.fromEntries(mock.questions.map((q) => [q.id, answers[q.id] ?? []]));
    try {
      const result = await gradeMock(await getToken(), exam, all);
      setPhase({ kind: "done", result, usedMs: Date.now() - startedAt.current });
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not grade the exam.");
    }
  }, [answers, exam, getToken, mock]);

  // The clock: ticks while running, submits on its own at zero.
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);
  useEffect(() => {
    if (phase.kind !== "running") return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= phase.endsAt) void submitRef.current();
    }, 500);
    return () => clearInterval(t);
  }, [phase]);

  // Leaving mid-exam loses the attempt; ask first.
  useEffect(() => {
    if (phase.kind !== "running") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase.kind]);

  if (error)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
        <p className="text-muted-foreground">{error}</p>
        <Link href="/certification" className="text-sm text-primary underline">
          All exams
        </Link>
      </div>
    );
  if (!mock)
    return (
      <PageSkeleton blocks={2} className="max-w-2xl" />
    );

  if (phase.kind === "intro") {
    const smaller = mock.questions.length < mock.realQuestions;
    return (
      <div className="container mx-auto max-w-2xl px-4 py-10">
        <Link href="/certification" className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> All exams
        </Link>
        <div className="rounded-xl border p-6 sm:p-8">
          <div className="flex items-center gap-2 text-primary">
            <Timer className="h-5 w-5" />
            <span className="text-sm font-medium">Timed mock exam</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold">{mock.title}</h1>
          <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              ["Questions", mock.questions.length],
              ["Minutes", mock.minutes],
              ["To pass", `${mock.passPercent}%`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-muted/50 p-3">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="text-xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-6 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Questions are drawn from each exam section in the same proportions as the real exam.</li>
            {smaller && (
              <li>
                The real exam has {mock.realQuestions} questions in {mock.realMinutes} minutes. Our bank is still growing, so this mock uses {mock.questions.length} with the time scaled to match.
              </li>
            )}
            <li>No answers are shown until you submit. Flag questions to come back to them. Unanswered questions count as wrong.</li>
            <li>When the timer reaches zero, the exam is submitted automatically.</li>
            {!isSignedIn && <li>Sign in to have your answers count toward readiness and spaced review.</li>}
          </ul>
          <Button
            className="mt-8 w-full"
            size="lg"
            onClick={() => {
              startedAt.current = Date.now();
              setNow(startedAt.current);
              setPhase({ kind: "running", endsAt: startedAt.current + mock.minutes * 60_000 });
              window.scrollTo({ top: 0 });
            }}
          >
            Start the exam
          </Button>
        </div>
      </div>
    );
  }

  if (phase.kind === "done") return <Results mock={mock} answers={answers} result={phase.result} usedMs={phase.usedMs} />;

  const q = mock.questions[index];
  const remaining = phase.kind === "running" ? phase.endsAt - now : 0;
  const answeredCount = mock.questions.filter((x) => (answers[x.id]?.length ?? 0) > 0).length;
  const selected = q ? (answers[q.id] ?? []) : [];

  function toggle(optionId: string) {
    if (!q || phase.kind !== "running") return;
    setAnswers((a) => {
      const cur = a[q.id] ?? [];
      const next = q.choose === 1 ? [optionId] : cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId];
      return { ...a, [q.id]: next };
    });
  }

  function confirmSubmit() {
    const left = mock ? mock.questions.length - answeredCount : 0;
    if (left > 0 && !window.confirm(`${left} question${left === 1 ? " is" : "s are"} unanswered and will count as wrong. Submit anyway?`)) return;
    void submit();
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <div className="sticky top-12 z-10 -mx-4 mb-6 flex items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <h1 className="truncate text-sm font-medium">{mock.title}</h1>
        <span className="text-xs tabular-nums text-muted-foreground">
          {answeredCount}/{mock.questions.length} answered
        </span>
        <span
          className={cn("ml-auto flex items-center gap-1 rounded-md px-2 py-1 font-mono text-sm tabular-nums", remaining < 5 * 60_000 ? "bg-destructive/10 text-destructive" : "bg-muted")}
          role="timer"
          aria-label="Time remaining"
        >
          <Timer className="h-3.5 w-3.5" /> {formatClock(remaining)}
        </span>
        <Button size="sm" disabled={phase.kind === "grading"} onClick={confirmSubmit}>
          {phase.kind === "grading" && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          Submit
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_15rem]">
        {q && (
          <div className="space-y-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Question {index + 1} of {mock.questions.length}
              </span>
              <button
                type="button"
                aria-pressed={flagged.has(q.id)}
                onClick={() =>
                  setFlagged((f) => {
                    const n = new Set(f);
                    if (n.has(q.id)) n.delete(q.id);
                    else n.add(q.id);
                    return n;
                  })
                }
                className={cn("flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent", flagged.has(q.id) && "text-amber-700 dark:text-amber-400")}
              >
                <Flag className="h-3.5 w-3.5" /> {flagged.has(q.id) ? "Flagged" : "Flag for review"}
              </button>
            </div>
            <Markdown source={q.prompt} className="markdown text-base" />
            <p className="text-xs text-muted-foreground">{q.choose === 1 ? "Choose one." : `Choose ${q.choose}.`}</p>
            <div className="space-y-2" role={q.choose === 1 ? "radiogroup" : "group"} aria-label="Answer options">
              {q.options.map((o) => {
                const picked = selected.includes(o.id);
                return (
                  <div key={o.id}>
                    <button
                      type="button"
                      role={q.choose === 1 ? "radio" : "checkbox"}
                      aria-checked={picked}
                      onClick={() => toggle(o.id)}
                      className={cn("flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors", picked ? "border-primary bg-primary/10" : "hover:bg-accent/50")}
                    >
                      <span className="mt-0.5 font-mono text-xs uppercase text-muted-foreground">{o.id}</span>
                      <Markdown source={o.text} className="markdown flex-1 [&_p]:m-0" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              {index + 1 < mock.questions.length ? (
                <Button variant="outline" onClick={() => setIndex((i) => i + 1)}>
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={confirmSubmit}>Submit exam</Button>
              )}
            </div>
          </div>
        )}

        <nav aria-label="Questions" className="h-fit rounded-xl border p-3 lg:sticky lg:top-28">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Questions</p>
          <ol className="grid grid-cols-8 gap-1.5 lg:grid-cols-5">
            {mock.questions.map((x, i) => {
              const done = (answers[x.id]?.length ?? 0) > 0;
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    aria-label={`Question ${i + 1}${done ? ", answered" : ""}${flagged.has(x.id) ? ", flagged" : ""}`}
                    aria-current={i === index ? "step" : undefined}
                    onClick={() => setIndex(i)}
                    className={cn(
                      "relative h-8 w-full rounded-md border text-xs tabular-nums",
                      done ? "border-primary/40 bg-primary/10" : "hover:bg-accent",
                      i === index && "ring-2 ring-primary",
                    )}
                  >
                    {i + 1}
                    {flagged.has(x.id) && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm border border-primary/40 bg-primary/10" /> answered
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> flagged
            </span>
          </p>
        </nav>
      </div>
    </div>
  );
}

function Results({ mock, answers, result, usedMs }: { mock: MockExam; answers: Record<string, string[]>; result: MockResult; usedMs: number }) {
  const [onlyWrong, setOnlyWrong] = useState(true);
  const byId = useMemo(() => new Map(result.results.map((r) => [r.id, r])), [result]);
  const shown = mock.questions.filter((q) => !onlyWrong || !byId.get(q.id)?.correct);
  return (
    <div className="container mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div className={cn("rounded-xl border p-6 text-center sm:p-8", result.passed ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5")}>
        <h1 className={cn("text-sm font-semibold uppercase tracking-wide", result.passed ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
          {mock.title}: {result.passed ? "Pass" : "Not yet"}
        </h1>
        <p className="mt-1 text-5xl font-bold tabular-nums">{result.score}%</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {result.correct} of {result.total} correct · {result.passPercent}% needed · finished in {formatClock(usedMs)}
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">By section</h2>
        <ul className="space-y-3">
          {result.sections.map((s) => {
            const pct = Math.round((100 * s.correct) / s.total);
            return (
              <li key={s.id}>
                <div className="flex justify-between gap-2 text-sm">
                  <Link href={`/certification/${mock.exam}?section=${s.id}`} className="hover:text-primary hover:underline">
                    {s.title}
                  </Link>
                  <span className="tabular-nums text-muted-foreground">
                    {s.correct}/{s.total} · {pct}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className={cn("h-full rounded-full", pct >= result.passPercent ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Review answers</h2>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} /> Only the ones I missed
          </label>
        </div>
        {shown.length === 0 && <p className="text-sm text-muted-foreground">Nothing missed. Well done.</p>}
        <ol className="space-y-4">
          {shown.map((q) => {
            const r = byId.get(q.id);
            const picked = answers[q.id] ?? [];
            return (
              <li key={q.id} className="rounded-xl border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  {r?.correct ? <CheckCircle2 className="h-4 w-4 text-green-700 dark:text-green-400" /> : <XCircle className="h-4 w-4 text-red-500" />}
                  Question {mock.questions.indexOf(q) + 1}
                  {picked.length === 0 && <span className="text-xs font-normal text-muted-foreground">(unanswered)</span>}
                </div>
                <Markdown source={q.prompt} className="markdown text-sm" />
                <ul className="mt-3 space-y-1.5">
                  {q.options.map((o) => {
                    const isAnswer = r?.answer.includes(o.id) ?? false;
                    const was = picked.includes(o.id);
                    return (
                      <li
                        key={o.id}
                        className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-sm", isAnswer && "border-green-500/60 bg-green-500/10", was && !isAnswer && "border-red-500/60 bg-red-500/10")}
                      >
                        <span className="font-mono text-xs uppercase text-muted-foreground">{o.id}</span>
                        <Markdown source={o.text} className="markdown flex-1 [&_p]:m-0" />
                        {was && <span className="text-[11px] text-muted-foreground">your answer</span>}
                      </li>
                    );
                  })}
                </ul>
                {r && <Markdown source={r.explanation} className="markdown mt-3 text-sm text-muted-foreground" />}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex justify-center gap-2">
        <Button onClick={() => window.location.reload()}>Take another mock</Button>
        <Link href="/certification" className={buttonVariants({ variant: "outline" })}>
          All exams
        </Link>
      </div>
    </div>
  );
}
