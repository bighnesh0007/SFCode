"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Celebration } from "@/components/Celebration";
import { usePoints } from "@/components/usePoints";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { SignInButton, useAuthState } from "@/components/auth";
// The namespace handed to onMount; imported for its type only (no bundle cost).
type Monaco = typeof import("monaco-editor");
import { ChevronLeft, Cloud, Info, Loader2, RotateCcw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Markdown } from "@/components/Markdown";
import { useOrgConnection } from "@/components/useOrgConnection";
import { ApiError } from "@/lib/apiClient";
import { getSubmission, listSubmissions, submitSolution, type ChallengeView, type Submission, type SubmissionSummary } from "@/lib/challengesApi";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/verdicts";
import { cn } from "@/lib/utils";
import { Results } from "./Results";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const POLL_MS = 3000;
const draftKey = (slug: string) => `sfcode.challenge.${slug}`;

function starterOf(challenge: ChallengeView): Record<string, string> {
  return Object.fromEntries(challenge.files.map((f) => [f.name, f.starter]));
}

function readDraft(challenge: ChallengeView): Record<string, string> {
  const starter = starterOf(challenge);
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey(challenge.slug)) ?? "null") as Record<string, unknown> | null;
    if (!saved) return starter;
    // Only keep drafts for files this problem still has.
    return Object.fromEntries(Object.entries(starter).map(([name, src]) => [name, typeof saved[name] === "string" ? saved[name] : src]));
  } catch {
    return starter;
  }
}

export function Workspace({ challenge, backHref }: { challenge: ChallengeView; backHref: string }) {
  const { resolvedTheme } = useTheme();
  const { isSignedIn, getToken } = useAuthState();
  const { state: org } = useOrgConnection();
  // Lazy init: the editor is client-only, so this never reaches server-rendered markup.
  const [sources, setSources] = useState<Record<string, string>>(() => readDraft(challenge));
  const [active, setActive] = useState(challenge.files[0]?.name ?? "");
  const [leftTab, setLeftTab] = useState<"description" | "submissions">("description");
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [history, setHistory] = useState<SubmissionSummary[]>([]);
  const [celebrate, setCelebrate] = useState<{ first: boolean } | null>(null);
  const points = usePoints();
  const worth = points?.matrix[challenge.track]?.[challenge.difficulty as "Easy" | "Medium" | "Hard"] ?? null;
  const endCelebration = useCallback(() => setCelebrate(null), []);
  // Read inside the poller without restarting it: was this already solved before this submission?
  const solvedBefore = useRef(false);
  useEffect(() => {
    if (submission?.status !== "running") solvedBefore.current = history.some((h) => h.status === "accepted" && h.id !== submission?.id);
  }, [history, submission]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const monacoRef = useRef<Monaco | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(challenge.slug), JSON.stringify(sources));
    } catch {
      /* storage unavailable: drafts just don't persist */
    }
  }, [challenge.slug, sources]);

  const refreshHistory = useCallback(async () => {
    if (!isSignedIn) return;
    setHistory(await listSubmissions(await getToken(), challenge.slug));
  }, [isSignedIn, getToken, challenge.slug]);

  const openSubmission = useCallback(
    async (id: string) => {
      setSubmission(await getSubmission(await getToken(), id));
    },
    [getToken],
  );

  // On load, resume a submission that was still grading when the page was left.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const rows = await listSubmissions(token, challenge.slug);
        if (cancelled) return;
        setHistory(rows);
        const runningRow = rows.find((r) => r.status === "running");
        if (runningRow) {
          const sub = await getSubmission(token, runningRow.id);
          if (!cancelled) setSubmission(sub);
        }
      } catch {
        /* history is a convenience; the page works without it */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken, challenge.slug]);

  // Poll while grading. The server asks Salesforce at most once per 2s anyway.
  const running = submission?.status === "running" ? submission.id : null;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const next = await getSubmission(await getToken(), running);
          setSubmission(next);
          if (next.status === "accepted") setCelebrate({ first: !solvedBefore.current });
          if (next.status !== "running") void refreshHistory();
        } catch {
          /* transient; keep polling */
        }
      })();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, getToken, refreshHistory]);

  // Compile errors as editor squiggles, per file model.
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    for (const f of challenge.files) {
      const model = monaco.editor.getModel(monaco.Uri.parse(`file:///${f.fileName}`));
      if (!model) continue;
      const problems = submission?.result?.compileErrors.filter((e) => e.file === f.fileName && e.line !== null) ?? [];
      monaco.editor.setModelMarkers(
        model,
        "sfcode",
        problems.map((p) => ({
          severity: monaco.MarkerSeverity.Error,
          message: p.message,
          startLineNumber: p.line ?? 1,
          startColumn: p.column ?? 1,
          endLineNumber: p.line ?? 1,
          endColumn: (p.column ?? 1) + 1,
        })),
      );
    }
  }, [submission, challenge.files, active]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const sub = await submitSolution(await getToken(), challenge.slug, sources);
      setSubmission(sub);
      void refreshHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    if (!window.confirm("Replace your code in every file with the starter code?")) return;
    setSources(starterOf(challenge));
  }

  const activeFile = challenge.files.find((f) => f.name === active) ?? challenge.files[0];
  const canSubmit = org.kind === "connected" && !submitting && submission?.status !== "running";

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      {celebrate && (
        <Celebration
          title="Accepted!"
          detail={celebrate.first ? `${worth !== null ? `+${worth} points. ` : ""}Nice work.` : "Solved again. Your best stands."}
          onDone={endCelebration}
        />
      )}
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* ── statement / submissions ─────────────────────────────────── */}
        <ResizablePanel defaultSize="40%" minSize="25%">
          <div className="flex h-full flex-col">
            <div className="flex h-10 items-center gap-1 border-b px-2">
              <Link href={backHref} className="mr-1 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Back to the list">
                <ChevronLeft className="h-4 w-4" />
              </Link>
              {(["description", "submissions"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setLeftTab(t)} className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize", leftTab === t ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto p-5">
              {leftTab === "description" ? (
                <>
                  <h1 className="text-xl font-semibold">{challenge.title}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{challenge.difficulty}</Badge>
                    <Badge variant="secondary">{challenge.category}</Badge>
                    {challenge.tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                  <Markdown source={challenge.statement} className="markdown mt-5" />
                  <div className="mt-6 flex gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {challenge.flow ? (
                      <p>
                        Checking runs hidden Apex tests in your connected org that create and update records, so your active
                        flow fires, and then verify the results. It&apos;s a check-only deploy: test records are rolled back, and
                        your flow is left as it is.
                      </p>
                    ) : challenge.track === "soql" ? (
                      <p>
                        Grading runs your query inside a hidden Apex test in your connected org, against records the test
                        creates itself, and compares the rows with the expected answer. Nothing is left behind in the org,
                        and your org&apos;s existing records don&apos;t affect the result.
                      </p>
                    ) : (
                      <p>
                        Grading runs a check-only deploy of your files and hidden tests in your connected org, then rolls
                        back. Your org&apos;s own triggers, flows and validation rules run too, so a fresh Developer Edition
                        org gives the cleanest results. Each file also needs 75% test coverage, as in any Salesforce deploy.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <SubmissionList history={history} signedIn={isSignedIn} onOpen={(id) => void openSubmission(id)} selected={submission?.id ?? null} />
              )}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* ── editor + results ─────────────────────────────────────────── */}
        <ResizablePanel defaultSize="60%" minSize="30%">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize="62%" minSize="20%">
              <div className="flex h-full flex-col">
                {/* One row: file tabs scroll sideways rather than wrapping the toolbar. */}
                <div className="flex h-10 items-center gap-2 border-b px-2">
                  <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
                    {challenge.files.map((f) => (
                      <button key={f.name} type="button" onClick={() => setActive(f.name)} className={cn("shrink-0 rounded-md px-2.5 py-1 font-mono text-xs", active === f.name ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>
                        {f.fileName}
                      </button>
                    ))}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <OrgGate org={org} />
                    {!challenge.flow && (
                      <Button size="sm" variant="ghost" onClick={reset} title="Reset to starter code">
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="sm" disabled={!canSubmit} onClick={() => void submit()}>
                      {submitting || submission?.status === "running" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                      {challenge.flow ? "Check my flow" : "Submit"}
                    </Button>
                  </div>
                </div>
                {challenge.flow && <FlowBrief slug={challenge.slug} flow={challenge.flow} instanceUrl={org.kind === "connected" ? org.connection.instanceUrl : null} />}
                {activeFile && (
                  <Editor
                    path={activeFile.fileName}
                    // Monaco has no SOQL mode; SQL highlighting is close enough.
                    language={activeFile.type === "soql" ? "sql" : "apex"}
                    theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
                    value={sources[activeFile.name] ?? ""}
                    onChange={(v) => setSources((s) => ({ ...s, [activeFile.name]: v ?? "" }))}
                    onMount={(_editor, monaco) => {
                      monacoRef.current = monaco;
                    }}
                    options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4 }}
                  />
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="38%" minSize="15%">
              <div className="h-full overflow-auto p-3">
                {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
                <Results submission={submission} isFlow={Boolean(challenge.flow)} onOpenFile={(fileName) => {
                  const f = challenge.files.find((x) => x.fileName === fileName);
                  if (f) setActive(f.name);
                }} />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

/** Flow problems have no editor: the learner builds the flow in Salesforce. */
function FlowBrief({ slug, flow, instanceUrl }: { slug: string; flow: NonNullable<ChallengeView["flow"]>; instanceUrl: string | null }) {
  const key = `sfcode.flow-steps.${slug}`;
  const [done, setDone] = useState<boolean[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
      return Array.isArray(saved) ? saved.map(Boolean) : [];
    } catch {
      return [];
    }
  });
  const toggle = (i: number) =>
    setDone((d) => {
      const next = [...d];
      next[i] = !next[i];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* checklist just doesn't persist */
      }
      return next;
    });

  const steps = [
    <>Open Flow Builder and create {flow.kind === "record-triggered" ? "a Record-Triggered" : "an Autolaunched (No Trigger)"} Flow.</>,
    <>Build it as the statement describes.</>,
    <>Save it with the API name <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{flow.apiName}</code>. The name must match exactly.</>,
    <><span className="font-medium text-foreground">Activate</span> it. Hidden tests only see active flows.</>,
    <>Click <span className="font-medium text-foreground">Check my flow</span>. A check-only deploy runs the hidden tests, then rolls back.</>,
  ];
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Build this flow in Salesforce</h2>
        {instanceUrl && (
          <div className="flex gap-3 text-xs">
            {/* Opens the learner's own connected org; rel=noopener because it's another site. */}
            <a href={`${instanceUrl}/builder_platform_interaction/flowBuilder.app`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              New flow in Flow Builder ↗
            </a>
            <a href={`${instanceUrl}/lightning/setup/Flows/home`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Your flows ↗
            </a>
          </div>
        )}
      </div>
      <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
        {steps.map((step, i) => (
          <li key={i}>
            <label className="flex cursor-pointer gap-3 rounded-md p-1.5 hover:bg-accent/50">
              <input type="checkbox" checked={done[i] ?? false} onChange={() => toggle(i)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]" />
              <span className={cn(done[i] && "line-through opacity-60")}>{step}</span>
            </label>
          </li>
        ))}
      </ol>
      {!instanceUrl && <p className="mt-4 text-xs text-muted-foreground">Connect your org to get direct links into its Flow Builder.</p>}
    </div>
  );
}

function OrgGate({ org }: { org: ReturnType<typeof useOrgConnection>["state"] }) {
  switch (org.kind) {
    case "loading":
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    case "signed-out":
      return (
        <SignInButton>
          <Button size="sm" variant="outline">Sign in to submit</Button>
        </SignInButton>
      );
    case "unavailable":
      return <span className="text-xs text-muted-foreground">{org.message}</span>;
    case "disconnected":
      return (
        <Link href={`/settings/org?returnTo=${encodeURIComponent(window.location.pathname)}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
          <Cloud className="mr-1 h-3.5 w-3.5" /> Connect org
        </Link>
      );
    case "connected":
      return (
        <span className="hidden items-center gap-1 text-xs text-muted-foreground lg:flex" title={org.connection.orgId}>
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" /> {org.connection.username}
        </span>
      );
  }
}

function SubmissionList({ history, signedIn, onOpen, selected }: { history: SubmissionSummary[]; signedIn: boolean; onOpen: (id: string) => void; selected: string | null }) {
  if (!signedIn) return <p className="text-sm text-muted-foreground">Sign in to see your submissions.</p>;
  if (history.length === 0) return <p className="text-sm text-muted-foreground">No submissions yet.</p>;
  return (
    <ul className="divide-y rounded-lg border text-sm">
      {history.map((h) => (
        <li key={h.id}>
          <button type="button" onClick={() => onOpen(h.id)} className={cn("flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent/50", selected === h.id && "bg-accent/60")}>
            <span className={cn("font-medium", STATUS_CLASS[h.status])}>{STATUS_LABEL[h.status]}</span>
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              {h.testsRun !== null && <span className="tabular-nums">{h.testsPassed}/{h.testsRun} tests</span>}
              <time dateTime={h.createdAt}>{new Date(h.createdAt).toLocaleString()}</time>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
