"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { CheckCircle2, ChevronLeft, Eye, FlaskConical, Info, Loader2, RotateCcw, Send, XCircle } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { Celebration } from "@/components/Celebration";
import { SOLVED_EVENT } from "@/lib/communityApi";
import { Results } from "./Results";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup, useSavedLayout } from "@/components/ui/resizable";
import { useSubmitShortcut } from "@/components/challenge/useSubmitShortcut";
import { useIsNarrow } from "@/lib/useIsNarrow";
import { Markdown } from "@/components/Markdown";
import { LearningPanel } from "@/components/challenge/LearningPanel";
import { ApiError } from "@/lib/apiClient";
import { submitLwc, type ChallengeView, type Submission } from "@/lib/challengesApi";
import { compileLwcComponent } from "@/lib/lwcApi";
import { cn } from "@/lib/utils";
import { sandboxDocument, type SandboxMessage } from "./lwcSandbox";
import { useEditorTheme } from "@/components/useEditorTheme";
import { defineSfcThemes } from "@/lib/editorThemes";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
const LANGUAGE: Record<string, string> = { html: "html", js: "javascript", css: "css" };
const RUN_TIMEOUT_MS = 10_000;

type Run =
  | { kind: "idle" }
  | { kind: "compiling" }
  | { kind: "running"; mode: "preview" | "tests" }
  | { kind: "preview" }
  | { kind: "results"; tests: { name: string; passed: boolean; message: string | null }[] }
  | { kind: "failed"; message: string };

const draftKey = (slug: string) => `sfcode.lwc.${slug}`;

function readDraft(challenge: ChallengeView): Record<string, string> {
  const starter = Object.fromEntries(challenge.files.map((f) => [f.name, f.starter]));
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey(challenge.slug)) ?? "null") as Record<string, unknown> | null;
    return Object.fromEntries(Object.entries(starter).map(([k, v]) => [k, typeof saved?.[k] === "string" ? saved[k] : v]));
  } catch {
    return starter;
  }
}

export function LwcWorkspace({ challenge, backHref }: { challenge: ChallengeView; backHref: string }) {
  const editorTheme = useEditorTheme();
  const lwc = challenge.lwc;
  const [sources, setSources] = useState<Record<string, string>>(() => readDraft(challenge));
  const [active, setActive] = useState("html");
  const [run, setRun] = useState<Run>({ kind: "idle" });
  const [doc, setDoc] = useState<string | null>(null);
  const { isSignedIn, getToken } = useAuthState();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const endCelebration = useCallback(() => setCelebrate(false), []);

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    setSubmission(null);
    setDoc(null);
    setRun({ kind: "idle" });
    try {
      const s = await submitLwc(await getToken(), challenge.slug, sources);
      setSubmission(s);
      if (s.status === "accepted") {
        setCelebrate(true);
        window.dispatchEvent(new Event(SOLVED_EVENT));
      }
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }
  const frame = useRef<HTMLIFrameElement>(null);
  const nonce = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(challenge.slug), JSON.stringify(sources));
    } catch {
      /* drafts just don't persist */
    }
  }, [challenge.slug, sources]);

  // Accept messages only from our iframe, carrying this run's nonce.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as ({ sfcLwc?: string } & Partial<SandboxMessage>) | null;
      if (data?.sfcLwc !== nonce.current) return;
      clearTimeout(timer.current);
      if (data.type === "rendered") setRun({ kind: "preview" });
      else if (data.type === "results" && data.tests) setRun({ kind: "results", tests: data.tests });
      else if (data.type === "error") setRun({ kind: "failed", message: data.message ?? "The component threw an error." });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Hooks before the early return below.
  const narrow = useIsNarrow();
  // Stacked on phones; its sizes are saved separately from the desktop split.
  const hLayout = useSavedLayout(narrow ? "lwc-stack" : "lwc-h");
  const vLayout = useSavedLayout("lwc-v");
  const shortcut = useSubmitShortcut(() => void submit(), isSignedIn && !submitting && run.kind !== "compiling" && run.kind !== "running");

  if (!lwc) return null;

  async function start(mode: "preview" | "tests") {
    if (!lwc) return;
    setRun({ kind: "compiling" });
    try {
      const code = await compileLwcComponent(lwc.component, { html: sources.html ?? "", js: sources.js ?? "", css: sources.css ?? "" });
      nonce.current = crypto.randomUUID();
      setRun({ kind: "running", mode });
      setDoc(sandboxDocument(code, nonce.current, mode === "tests" ? lwc.tests : null));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setRun({ kind: "failed", message: "No response from the component within 10 seconds. Is there an infinite loop?" }), RUN_TIMEOUT_MS);
    } catch (err) {
      setRun({ kind: "failed", message: err instanceof ApiError ? err.message : "Could not compile the component." });
    }
  }

  function reset() {
    if (!window.confirm("Replace your code in every file with the starter code?")) return;
    setSources(Object.fromEntries(challenge.files.map((f) => [f.name, f.starter])));
  }

  const busy = run.kind === "compiling" || run.kind === "running";
  const activeFile = challenge.files.find((f) => f.name === active) ?? challenge.files[0];
  const showFrame = run.kind === "preview" || (run.kind === "running" && run.mode === "preview");

  return (
    <>
    {celebrate && <Celebration title="Accepted!" detail="Every hidden test passed. Nice work." onDone={endCelebration} />}
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <ResizablePanelGroup key={narrow ? "stack" : "split"} orientation={narrow ? "vertical" : "horizontal"} className="flex-1" {...hLayout}>
        <ResizablePanel id="statement" defaultSize="38%" minSize="25%">
          <div className="flex h-full flex-col">
            <div className="flex h-10 items-center gap-1 border-b px-2">
              <Link href={backHref} className="mr-1 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Back to the list">
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <span className="text-xs font-medium">Description</span>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <h1 className="text-xl font-semibold">{challenge.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{challenge.difficulty}</Badge>
                <Badge variant="secondary">{challenge.category}</Badge>
                {challenge.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                ))}
              </div>
              <Markdown source={challenge.statement} className="markdown mt-5" />
              <LearningPanel slug={challenge.slug} hintCount={challenge.hintCount ?? 0} hasEditorial={challenge.hasEditorial ?? false} />
              <div className="mt-6 flex gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  Your component is compiled by SFCode and runs in a sandboxed frame in your browser, with no org needed.
                  Salesforce&apos;s built-in <code>lightning-*</code> components aren&apos;t available here; use plain HTML.
                </p>
              </div>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel id="work" defaultSize="62%" minSize="30%">
          <ResizablePanelGroup orientation="vertical" {...vLayout}>
            <ResizablePanel id="code" defaultSize="58%" minSize="20%">
              <div className="flex h-full flex-col">
                <div className="flex h-10 items-center gap-2 border-b px-2">
                  <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
                    {challenge.files.map((f) => (
                      <button key={f.name} type="button" onClick={() => setActive(f.name)} className={cn("shrink-0 rounded-md px-2.5 py-1 font-mono text-xs", active === f.name ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>
                        {f.fileName}
                      </button>
                    ))}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={reset} title="Reset to starter code">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void start("preview")}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy || submitting} onClick={() => { setSubmission(null); void start("tests"); }}>
                      {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="mr-1 h-3.5 w-3.5" />}
                      Run tests
                    </Button>
                    <Button size="sm" disabled={busy || submitting || !isSignedIn} title={isSignedIn ? "Graded on the server with hidden tests (Ctrl/⌘ + Enter)" : "Sign in to submit"} onClick={() => void submit()}>
                      {submitting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                      Submit
                    </Button>
                  </div>
                </div>
                {activeFile && (
                  <Editor
                    path={`lwc/${challenge.slug}/${activeFile.fileName}`}
                    language={LANGUAGE[activeFile.name] ?? "plaintext"}
                    theme={editorTheme}
                    beforeMount={defineSfcThemes}
                    value={sources[activeFile.name] ?? ""}
                    onChange={(v) => setSources((s) => ({ ...s, [activeFile.name]: v ?? "" }))}
                    onMount={(editor, monaco) => shortcut.bindEditor(editor, monaco)}
                    options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4 }}
                  />
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel id="results" defaultSize="42%" minSize="15%">
              <div className="relative h-full">
                {/* Kept mounted while tests run so they execute; shown only for Preview. */}
                {doc !== null && (
                  <iframe
                    ref={frame}
                    title="Component sandbox"
                    sandbox="allow-scripts"
                    srcDoc={doc}
                    className={cn("h-full w-full border-0 bg-white", !showFrame && "pointer-events-none absolute inset-0 opacity-0")}
                  />
                )}
                {!showFrame && (
                  <div className="absolute inset-0 overflow-auto p-3 text-sm">
                    {submitError && <p className="mb-2 text-destructive">{submitError}</p>}
                    {submitting ? (
                      <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Grading with hidden tests…</p>
                    ) : submission ? (
                      <Results submission={submission} onOpenFile={() => undefined} />
                    ) : (
                      <LwcOutput run={run} />
                    )}
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
    </>
  );
}

function LwcOutput({ run }: { run: Run }) {
  if (run.kind === "idle") return <p className="text-muted-foreground">Preview your component, or run the tests.</p>;
  if (run.kind === "compiling" || run.kind === "running")
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {run.kind === "compiling" ? "Compiling…" : "Running tests…"}
      </p>
    );
  if (run.kind === "failed") return <pre className="whitespace-pre-wrap font-mono text-xs text-red-600 dark:text-red-400">{run.message}</pre>;
  if (run.kind !== "results") return null;
  const passed = run.tests.filter((t) => t.passed).length;
  const all = passed === run.tests.length;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className={cn("text-lg font-semibold", all ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>{all ? "All tests passed" : "Tests failed"}</h2>
        <span className="tabular-nums text-muted-foreground">{passed}/{run.tests.length} passed</span>
      </div>
      <ul className="space-y-1.5">
        {run.tests.map((t) => (
          <li key={t.name} className="rounded-md border px-3 py-2">
            <div className="flex items-center gap-2">
              {t.passed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
              <span className="text-xs">{t.name}</span>
            </div>
            {!t.passed && t.message && <pre className="mt-1.5 whitespace-pre-wrap font-mono text-xs text-red-600 dark:text-red-400">{t.message}</pre>}
          </li>
        ))}
      </ul>
    </div>
  );
}
