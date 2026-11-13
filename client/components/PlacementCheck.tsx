"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { getPlacement, gradePlacement, type Level, type PlacementQuestion, type PlacementResult, type PlacementTrack } from "@/lib/roadmapApi";
import { cn } from "@/lib/utils";

/**
 * Eight quick questions, easiest first, that suggest a starting level. Nothing
 * is saved: the result just pre-selects the level, which the learner can change.
 */
export function PlacementCheck({ track, levelTitle, onDone, onCancel }: { track: PlacementTrack; levelTitle: (l: Level) => string; onDone: (level: Level) => void; onCancel: () => void }) {
  const [questions, setQuestions] = useState<PlacementQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPlacement(track)
      .then((q) => !cancelled && setQuestions(q))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : "Could not load the check."));
    return () => {
      cancelled = true;
    };
  }, [track]);

  async function answer(questionId: string, option: number) {
    if (!questions) return;
    // "I don't know" (-1) leaves the question unanswered, which grades as wrong.
    const next = Object.fromEntries(Object.entries({ ...answers, [questionId]: option }).filter(([, v]) => v >= 0));
    setAnswers(next);
    if (index + 1 < questions.length) {
      setTimeout(() => setIndex((i) => i + 1), 150);
      return;
    }
    setGrading(true);
    try {
      setResult(await gradePlacement(track, next));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not grade the check.");
    } finally {
      setGrading(false);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!questions || grading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />;

  if (result) {
    return (
      <div className="rounded-xl border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {result.correct} of {result.total} right. We suggest starting as:
        </p>
        <p className="mt-2 text-2xl font-semibold">{levelTitle(result.level)}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => onDone(result.level)}>Use this level</Button>
          <Button variant="outline" onClick={onCancel}>
            Choose myself
          </Button>
        </div>
      </div>
    );
  }

  const q = questions[index];
  if (!q) return null;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <button type="button" onClick={index === 0 ? onCancel : () => setIndex((i) => i - 1)} className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {index === 0 ? "Back to levels" : "Previous"}
        </button>
        <span>
          Question {index + 1} of {questions.length} · there&apos;s no penalty for guessing
        </span>
      </div>
      <p className="font-medium">{q.prompt}</p>
      <div className="mt-4 grid gap-2" role="radiogroup" aria-label={q.prompt}>
        {q.options.map((o, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={answers[q.id] === i}
            onClick={() => void answer(q.id, i)}
            className={cn("rounded-lg border px-4 py-3 text-left text-sm transition-colors hover:border-sky-500/60", answers[q.id] === i && "border-sky-500 bg-sky-500/10 font-medium")}
          >
            {o}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => void answer(q.id, -1)} className="mt-3 text-xs text-muted-foreground hover:text-foreground">
        I don&apos;t know
      </button>
    </div>
  );
}
