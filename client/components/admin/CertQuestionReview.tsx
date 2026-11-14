"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { certReviewQueue, decideCertQuestion, type CertQuestionView } from "@/lib/certQuestionsApi";

/** Reviewers check Buddy-written certification questions. Approved ones join practice (never mocks). */
export function CertQuestionReview() {
  const { getToken } = useAuthState();
  const [rows, setRows] = useState<CertQuestionView[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getToken()
      .then((t) => certReviewQueue(t))
      .then(setRows)
      .catch(() => setRows([]));
  }, [getToken]);
  useEffect(load, [load]);

  async function decide(id: string, action: "approve" | "changes" | "reject") {
    setBusy(id);
    setError(null);
    try {
      await decideCertQuestion(await getToken(), id, action, notes[id] ?? "");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-5 space-y-4">
      <p className="text-xs text-muted-foreground">
        Check each question is original, correct for the current exam, has one defensible answer, and explains why the wrong options are wrong. You can&apos;t review
        your own questions.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {rows === null && <div className="h-20 animate-pulse rounded-lg bg-muted/50" />}
      {rows?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No questions waiting for review.</p>}
      {rows?.map((q) => (
        <article key={q.id} className="space-y-3 rounded-lg border p-4 text-sm">
          <p className="text-xs text-muted-foreground">
            {q.examTitle} · {q.sectionTitle} · @{q.author ?? "?"} · {new Date(q.updatedAt).toLocaleDateString()}
          </p>
          <p className="whitespace-pre-line font-medium">{q.content.prompt}</p>
          <ul className="space-y-1">
            {q.content.options.map((o) => (
              <li key={o.id} className="flex gap-2">
                <span className="w-4 font-mono text-xs uppercase text-muted-foreground">{o.id}</span>
                <span className={q.content.answer.includes(o.id) ? "font-medium text-emerald-700 dark:text-emerald-400" : ""}>{o.text}</span>
                {q.content.answer.includes(o.id) && <Check className="h-4 w-4 text-emerald-600" aria-label="Correct" />}
              </li>
            ))}
          </ul>
          <p className="rounded-md bg-muted/40 p-2 text-xs">{q.content.explanation}</p>
          <textarea aria-label="Note to the author" placeholder="Note to the author (required when asking for changes)" value={notes[q.id] ?? ""} onChange={(e) => setNotes({ ...notes, [q.id]: e.target.value })} className="min-h-16 w-full rounded-md border bg-background p-2 text-sm" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy === q.id} onClick={() => void decide(q.id, "approve")}>
              {busy === q.id && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Approve
            </Button>
            <Button size="sm" variant="outline" disabled={busy === q.id} onClick={() => void decide(q.id, "changes")}>Ask for changes</Button>
            <Button size="sm" variant="ghost" disabled={busy === q.id} onClick={() => void decide(q.id, "reject")}>Reject</Button>
          </div>
        </article>
      ))}
    </section>
  );
}
