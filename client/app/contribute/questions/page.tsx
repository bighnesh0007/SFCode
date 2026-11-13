"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { SignInButton, useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { listExams, type ExamSummary } from "@/lib/certificationApi";
import { editCertQuestion, myCertQuestions, STATUS_TEXT, submitCertQuestion, type CertQuestionContent, type CertQuestionView } from "@/lib/certQuestionsApi";
import { cn } from "@/lib/utils";

const LETTERS = "abcdef";
const blank = (): CertQuestionContent => ({
  exam: "",
  section: "",
  prompt: "",
  options: [0, 1, 2, 3].map((i) => ({ id: LETTERS[i] ?? "a", text: "" })),
  answer: [],
  explanation: "",
});

/** Buddies write certification practice questions; reviewers approve them into the practice pool. */
export default function CertQuestionsPage() {
  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [mine, setMine] = useState<CertQuestionView[] | null>(null);
  const [form, setForm] = useState<CertQuestionContent>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(() => {
    getToken()
      .then((t) => myCertQuestions(t))
      .then(setMine)
      .catch((e: unknown) => {
        setMine([]);
        setError(e instanceof ApiError ? e.message : "Could not load your questions.");
      });
  }, [getToken]);

  useEffect(() => {
    listExams(null).then(setExams).catch(() => {});
  }, []);
  useEffect(() => {
    if (isSignedIn) load();
  }, [isSignedIn, load]);

  const sections = useMemo(() => exams.find((e) => e.exam === form.exam)?.sections ?? [], [exams, form.exam]);
  const filled = form.options.filter((o) => o.text.trim());
  const ready = form.exam && form.section && form.prompt.trim().length >= 10 && filled.length >= 3 && form.answer.length > 0 && form.explanation.trim().length >= 20;

  function setOption(i: number, text: string) {
    setForm({ ...form, options: form.options.map((o, j) => (j === i ? { ...o, text } : o)) });
  }
  function toggleAnswer(id: string) {
    setForm({ ...form, answer: form.answer.includes(id) ? form.answer.filter((a) => a !== id) : [...form.answer, id].sort() });
  }
  function removeOption(i: number) {
    // Re-letter after removing so ids stay a, b, c… in order.
    const kept = form.options.filter((_, j) => j !== i);
    const relettered = kept.map((o, j) => ({ id: LETTERS[j] ?? "a", text: o.text }));
    const map = new Map(kept.map((o, j) => [o.id, LETTERS[j] ?? "a"]));
    setForm({ ...form, options: relettered, answer: form.answer.filter((a) => map.has(a)).map((a) => map.get(a) ?? a) });
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const content = { ...form, options: form.options.filter((o) => o.text.trim()) };
      if (editing) await editCertQuestion(await getToken(), editing, content);
      else await submitCertQuestion(await getToken(), content);
      setSaved(editing ? "Updated and sent back for review." : "Sent for review. A reviewer will approve it or ask for changes.");
      setForm(blank());
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the question.");
    } finally {
      setBusy(false);
    }
  }

  if (isLoaded && !isSignedIn)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Write certification questions</h1>
        <SignInButton>
          <Button className="mt-4">Sign in</Button>
        </SignInButton>
      </div>
    );

  const input = "w-full rounded-md border bg-background px-3 py-2 text-sm";
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10">
      <div>
        <Link href="/contribute" className="text-sm text-muted-foreground hover:text-foreground">← Contribute</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Write certification questions</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Write an original question for one exam section. Never copy from exam dumps or other question banks. A reviewer checks it before it joins practice; it
          won&apos;t appear in mock exams, which use only the reviewed bank.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border p-5">
        <h2 className="font-semibold">{editing ? "Edit question" : "New question"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <select aria-label="Exam" value={form.exam} onChange={(e) => setForm({ ...form, exam: e.target.value, section: "" })} className={input}>
            <option value="">Choose an exam</option>
            {exams.map((e) => (
              <option key={e.exam} value={e.exam}>{e.title}</option>
            ))}
          </select>
          <select aria-label="Section" value={form.section} disabled={!form.exam} onChange={(e) => setForm({ ...form, section: e.target.value })} className={input}>
            <option value="">Choose a section</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
        <textarea aria-label="Question" placeholder="The question. For more than one answer, end with 'Choose 2.'" value={form.prompt} maxLength={2000} onChange={(e) => setForm({ ...form, prompt: e.target.value })} className={cn(input, "min-h-24")} />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Options: tick the correct one(s)</legend>
          {form.options.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2">
              <input type="checkbox" aria-label={`Option ${o.id.toUpperCase()} is correct`} checked={form.answer.includes(o.id)} onChange={() => toggleAnswer(o.id)} />
              <span className="w-4 font-mono text-xs uppercase text-muted-foreground">{o.id}</span>
              <input aria-label={`Option ${o.id.toUpperCase()}`} value={o.text} maxLength={500} onChange={(e) => setOption(i, e.target.value)} className={input} />
              {form.options.length > 3 && (
                <button type="button" aria-label={`Remove option ${o.id.toUpperCase()}`} onClick={() => removeOption(i)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {form.options.length < 6 && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setForm({ ...form, options: [...form.options, { id: LETTERS[form.options.length] ?? "f", text: "" }] })}>
              <Plus className="mr-1 h-4 w-4" /> Add an option
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Make wrong options as specific as the right one, so length doesn&apos;t give the answer away.</p>
        </fieldset>
        <textarea aria-label="Explanation" placeholder="Why the answer is right, and why the tempting wrong options are wrong." value={form.explanation} maxLength={2000} onChange={(e) => setForm({ ...form, explanation: e.target.value })} className={cn(input, "min-h-24")} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && <p className="text-sm text-emerald-700 dark:text-emerald-400">{saved}</p>}
        <div className="flex gap-2">
          <Button disabled={busy || !ready} onClick={() => void save()}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} {editing ? "Resubmit" : "Submit for review"}
          </Button>
          {editing && (
            <Button variant="ghost" onClick={() => { setEditing(null); setForm(blank()); }}>
              Cancel
            </Button>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-semibold">Your questions</h2>
        {mine === null ? (
          <div className="mt-3 h-16 animate-pulse rounded-lg bg-muted/50" />
        ) : mine.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border text-sm">
            {mine.map((q) => (
              <li key={q.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{q.content.prompt}</span>
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs", q.status === "approved" && "border-emerald-500/50 text-emerald-700 dark:text-emerald-400", q.status === "changes_requested" && "border-amber-500/50 text-amber-700 dark:text-amber-400")}>{STATUS_TEXT[q.status]}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{q.examTitle} · {q.sectionTitle}</p>
                {q.reviewNote && <p className="mt-1 text-xs">Reviewer: {q.reviewNote}</p>}
                {(q.status === "changes_requested" || q.status === "submitted") && (
                  <button type="button" className="mt-1 text-xs text-sky-700 hover:underline dark:text-sky-400" onClick={() => { setEditing(q.id); setForm(q.content); window.scrollTo({ top: 0 }); }}>
                    Edit
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
