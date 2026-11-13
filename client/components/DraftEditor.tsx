"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Eye, Loader2, Plus, Send, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { CodeField } from "@/components/CodeField";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { checkDraft, getDraft, reviewDraft, saveDraft, STATUS_TEXT, submitDraft, type DraftView, type ProblemContent } from "@/lib/draftsApi";
import { trackInfo } from "@/lib/tracks";
import { cn } from "@/lib/utils";

const input = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const code = "min-h-40 w-full rounded-md border bg-muted/30 p-2 font-mono text-xs leading-relaxed";

/** Write (author) or review (reviewer) one community problem. The server enforces every rule; the UI just guides. */
export function DraftEditor({ id }: { id: string }) {
  const { isSignedIn, getToken } = useAuthState();
  const [draft, setDraft] = useState<DraftView | null>(null);
  const [content, setContent] = useState<ProblemContent | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(false);
  const [learnerView, setLearnerView] = useState(false);

  const load = useCallback(() => {
    getToken()
      .then((t) => getDraft(t, id))
      .then((d) => {
        setDraft(d);
        setContent(d.content);
        setDirty(false);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Could not load the draft."));
  }, [getToken, id]);
  useEffect(load, [load, isSignedIn]);

  // Don't lose work: warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // While a check runs in the background, poll for its result.
  const running = draft?.check?.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [running, load]);

  if (error && !draft) return <p className="py-16 text-center text-sm text-destructive">{error}</p>;
  if (!draft || !content) return <div className="flex justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const editable = draft.canEdit;
  const reviewing = draft.canReview;
  const lang = content.track === "soql" ? ("sql" as const) : ("apex" as const);

  const set = (patch: Partial<ProblemContent>) => {
    setContent({ ...content, ...patch });
    setDirty(true);
  };
  const renameFile = (i: number, name: string) => {
    const old = content.files[i]?.name ?? "";
    const move = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k === old ? name : k, v]));
    set({ files: content.files.map((f, j) => (j === i ? { ...f, name } : f)), starter: move(content.starter), reference: move(content.reference) });
  };

  async function act(label: string, fn: (t: string | null) => Promise<DraftView>) {
    setBusy(label);
    setError(null);
    try {
      const d = await fn(await getToken());
      setDraft(d);
      setContent(d.content);
      setDirty(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }
  const save = () => act("save", (t) => saveDraft(t, id, content));
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && editable) {
      e.preventDefault();
      if (dirty && busy === null) void save();
    }
  };

  const check = draft.check;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8" onKeyDown={onKeyDown}>
      <Link href={reviewing ? "/admin" : "/contribute"} className="text-sm text-muted-foreground hover:text-foreground">← {reviewing ? "Review queue" : "My problems"}</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{content.title || "Untitled problem"}</h1>
        <span className="rounded-full border px-2 py-0.5 text-xs">{STATUS_TEXT[draft.status]}</span>
        {draft.author && <span className="text-xs text-muted-foreground">by @{draft.author}</span>}
        {draft.publishedSlug && <Link href={`${trackInfo(content.track).base}/${draft.publishedSlug}`} className="text-sm text-sky-700 hover:underline dark:text-sky-400">View live →</Link>}
      </div>
      {draft.reviewNote && (
        <p className={cn("mt-3 rounded-lg border p-3 text-sm", draft.status === "rejected" ? "border-destructive/40 bg-destructive/10" : "border-amber-500/40 bg-amber-500/10")}>
          <b>Reviewer:</b> {draft.reviewNote}
        </p>
      )}

      {/* Readiness: what the server says is blocking, and the last org check. */}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-3 text-sm">
          <p className="font-medium">Ready to go live?</p>
          {draft.problems.length === 0 ? (
            <p className="mt-1 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Structure looks good.</p>
          ) : (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-700 dark:text-amber-300">{draft.problems.map((p) => <li key={p}>{p}</li>)}</ul>
          )}
          {dirty && <p className="mt-1 text-xs text-muted-foreground">Unsaved changes: save to re-check.</p>}
        </div>
        <div className="rounded-lg border p-3 text-sm">
          <p className="font-medium">Test in my org</p>
          {!check ? (
            <p className="mt-1 text-muted-foreground">Not run yet. Your solution must pass the hidden tests and the starter must fail.</p>
          ) : check.status === "running" ? (
            <p className="mt-1 flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Running in your org… (usually under a minute)</p>
          ) : (
            <div className="mt-1">
              <p className={cn("flex items-center gap-1.5", check.status === "passed" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
                {check.status === "passed" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {check.status === "passed" ? "Passed" : check.status === "failed" ? "Failed" : "Couldn't run"}
                {check.reference && ` · solution ${check.reference.verdict} (${check.reference.passed}/${check.reference.run})`}
                {check.starter && ` · starter ${check.starter.verdict}`}
              </p>
              {check.message && <p className="mt-1 text-xs">{check.message}</p>}
              {check.reference?.message && check.status !== "passed" && <p className="mt-1 font-mono text-xs text-muted-foreground">{check.reference.message}</p>}
              {!check.current && <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3" /> For an older version: run it again.</p>}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setLearnerView((v) => !v)}>
          <Eye className="mr-1 h-4 w-4" /> {learnerView ? "Back to editing" : "Preview as learner"}
        </Button>
      </div>
      {learnerView ? (
        <div className="mt-2 grid gap-4 rounded-xl border p-4 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold">{content.title}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full border px-2 py-0.5">{content.difficulty}</span>
              <span className="rounded-full bg-muted px-2 py-0.5">{content.category}</span>
              {content.tags.map((t) => <span key={t} className="rounded-full border px-2 py-0.5">{t}</span>)}
            </div>
            <Markdown source={content.statement || "_No statement yet._"} className="markdown mt-4" />
          </div>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">What the learner starts with. Hidden tests and your solution stay hidden.</p>
            {content.files.map((f) => (
              <div key={f.name}>
                <p className="mb-1 font-mono text-xs">{f.type === "soql" ? "query.soql" : `${f.name}.${f.type === "trigger" ? "trigger" : "cls"}`}</p>
                <CodeField label={`Learner view ${f.name}`} language={lang} readOnly value={content.starter[f.name] ?? ""} onChange={() => undefined} />
              </div>
            ))}
          </div>
        </div>
      ) : (
      <fieldset disabled={!editable} className="mt-6 space-y-4 disabled:opacity-90">
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-xs sm:col-span-2">Title<input className={input} value={content.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} /></label>
          <label className="text-xs">Difficulty
            <select className={input} value={content.difficulty} onChange={(e) => set({ difficulty: e.target.value as ProblemContent["difficulty"] })}>
              {["Easy", "Medium", "Hard"].map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label className="text-xs">Category<input className={input} value={content.category} maxLength={40} onChange={(e) => set({ category: e.target.value })} /></label>
        </div>
        <label className="block text-xs">Tags (comma-separated)<input className={input} value={content.tags.join(", ")} onChange={(e) => set({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6) })} /></label>

        <div>
          <div className="flex items-center justify-between text-xs">
            <span>Statement (Markdown): name every class, method and field the tests use</span>
            <button type="button" className="text-sky-700 dark:text-sky-400" onClick={() => setPreview((p) => !p)}>{preview ? "Edit" : "Preview"}</button>
          </div>
          {preview ? <div className="mt-1 rounded-md border p-3"><Markdown source={content.statement || "_Nothing yet._"} /></div> : <textarea className={cn(code, "min-h-32 font-sans text-sm")} value={content.statement} onChange={(e) => set({ statement: e.target.value })} />}
        </div>

        {content.files.map((f, i) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              {content.track === "soql" ? (
                <span className="font-mono text-sm">query.soql</span>
              ) : (
                <>
                  <input aria-label="File name" className="h-8 w-56 rounded-md border bg-background px-2 font-mono text-sm" value={f.name} onChange={(e) => renameFile(i, e.target.value)} />
                  <select aria-label="File type" className="h-8 rounded-md border bg-background px-2 text-sm" value={f.type} onChange={(e) => set({ files: content.files.map((x, j) => (j === i ? { ...x, type: e.target.value as "class" | "trigger" } : x)) })}>
                    <option value="class">class</option>
                    <option value="trigger">trigger</option>
                  </select>
                  {content.files.length > 1 && <button type="button" aria-label="Remove file" onClick={() => set({ files: content.files.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                </>
              )}
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div className="text-xs">
                <p className="mb-1">{content.track === "debug" ? "Starter (with the bug)" : "Starter (what learners begin with)"}</p>
                <CodeField label={`Starter ${f.name}`} language={lang} readOnly={!editable} value={content.starter[f.name] ?? ""} onChange={(v) => set({ starter: { ...content.starter, [f.name]: v } })} />
              </div>
              <div className="text-xs">
                <p className="mb-1">Solution (hidden)</p>
                <CodeField label={`Solution ${f.name}`} language={lang} readOnly={!editable} value={content.reference[f.name] ?? ""} onChange={(v) => set({ reference: { ...content.reference, [f.name]: v } })} />
              </div>
            </div>
          </div>
        ))}
        {content.track !== "soql" && content.files.length < 4 && (
          <button type="button" className="inline-flex items-center gap-1 text-sm text-sky-700 dark:text-sky-400" onClick={() => set({ files: [...content.files, { name: `SfcFile${content.files.length + 1}`, type: "class" }] })}>
            <Plus className="h-4 w-4" /> Add a file
          </button>
        )}

        <div className="rounded-lg border p-3">
          <label className="text-xs">Hidden test class name<input className="h-8 w-64 rounded-md border bg-background px-2 font-mono text-sm" value={content.testClass} onChange={(e) => set({ testClass: e.target.value })} /></label>
          <div className="mt-2 text-xs">
            <p className="mb-1">Hidden tests (Apex). Create your own data, no SeeAllData. {content.track === "soql" && "Keep {{REFERENCE_QUERY}} and {{SOQL_COMPARE}}."}</p>
            <CodeField label="Hidden tests" height={320} readOnly={!editable} value={content.testSource} onChange={(v) => set({ testSource: v })} />
          </div>
        </div>
      </fieldset>
      )}

      {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}

      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-2 border-t bg-background/95 py-3 backdrop-blur">
        {editable && (
          <>
            <Button variant="outline" disabled={!dirty || busy !== null} onClick={() => void save()}>{busy === "save" ? "Saving…" : "Save"}</Button>
            <Button variant="outline" disabled={dirty || running || busy !== null || draft.problems.length > 0} onClick={() => void act("check", (t) => checkDraft(t, id))}>
              <ShieldCheck className="mr-1 h-4 w-4" /> Test in my org
            </Button>
            <Button disabled={dirty || busy !== null || check?.status !== "passed" || !check.current} onClick={() => void act("submit", (t) => submitDraft(t, id))}>
              <Send className="mr-1 h-4 w-4" /> Submit for review
            </Button>
            <span className="text-xs text-muted-foreground">Needs a connected org (Settings → Salesforce org).</span>
          </>
        )}
        {reviewing && (
          <>
            <Button variant="outline" disabled={running || busy !== null} onClick={() => void act("check", (t) => checkDraft(t, id))}><ShieldCheck className="mr-1 h-4 w-4" /> Run in my org</Button>
            <input aria-label="Review note" placeholder="Note to the author (required for changes)" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} className="h-9 min-w-[16rem] flex-1 rounded-md border bg-background px-2 text-sm" />
            <Button disabled={busy !== null} onClick={() => void act("approve", (t) => reviewDraft(t, id, "approve", note))}>Approve &amp; publish</Button>
            <Button variant="outline" disabled={busy !== null} onClick={() => void act("changes", (t) => reviewDraft(t, id, "changes", note))}>Request changes</Button>
            <Button variant="outline" disabled={busy !== null} onClick={() => void act("reject", (t) => reviewDraft(t, id, "reject", note))}>Reject</Button>
          </>
        )}
        {!editable && !reviewing && <span className="text-sm text-muted-foreground">{draft.status === "submitted" ? "Waiting for a reviewer." : "Read-only."}</span>}
      </div>
    </div>
  );
}
