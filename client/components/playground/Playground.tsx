"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { SignInButton, useAuthState } from "@/components/auth";
import { AlertTriangle, CheckCircle2, Cloud, History, Loader2, Play, RotateCcw, XCircle } from "lucide-react";
import type { Monaco, OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useOrgConnection } from "@/components/useOrgConnection";
import { useEditorTheme } from "@/components/useEditorTheme";
import { ApiError } from "@/lib/apiClient";
import { executeAnonymous, runSoql, type ApexExecutionResult, type SoqlQueryResult } from "@/lib/salesforceApi";
import { cn } from "@/lib/utils";
import { useIsNarrow } from "@/lib/useIsNarrow";
import { extractLimits, extractUserDebug } from "@/app/playground/apex/debugLog";
import { APEX_SAMPLES, SOQL_SAMPLES } from "@/app/playground/apex/samples";

// Monaco touches `window`; never render it on the server.
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export type Mode = "apex" | "soql";

const DRAFT_KEY: Record<Mode, string> = { apex: "sfcode.apex.draft", soql: "sfcode.soql.draft" };
const HISTORY_KEY: Record<Mode, string> = { apex: "sfcode.apex.history", soql: "sfcode.soql.history" };
const HISTORY_MAX = 10;

interface HistoryEntry {
  code: string;
  at: number;
  ok: boolean;
}

type Result = { mode: "apex"; apex: ApexExecutionResult } | { mode: "soql"; soql: SoqlQueryResult };

type Run =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: Result; ms: number }
  | { kind: "failed"; message: string; code?: string };

type Tab = "output" | "limits" | "log";

function firstSample(mode: Mode): string {
  return (mode === "apex" ? APEX_SAMPLES[0]?.code : SOQL_SAMPLES[0]?.code) ?? "";
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: drafts and history just don't persist */
  }
}

function readDraft(mode: Mode): string {
  // Stored as the raw string, matching drafts saved before this page existed.
  try {
    return localStorage.getItem(DRAFT_KEY[mode]) ?? firstSample(mode);
  } catch {
    return firstSample(mode);
  }
}


export function Playground({ mode }: { mode: Mode }) {
  const editorTheme = useEditorTheme();
  const { getToken } = useAuthState();
  const { state: org } = useOrgConnection();
  const narrow = useIsNarrow();
  // Lazy init: the editor is client-only (ssr: false), so a server/client
  // difference in this value never reaches hydrated markup.
  const [code, setCode] = useState<string>(() => readDraft(mode));
  const [history, setHistory] = useState<HistoryEntry[]>(() => readStored(HISTORY_KEY[mode], []));
  const [run, setRun] = useState<Run>({ kind: "idle" });
  const [tab, setTab] = useState<Tab>("output");
  const runRef = useRef<() => void>(() => {});
  const abortRef = useRef<AbortController | null>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco>(null);

  useEffect(() => {
    try {
      if (code) localStorage.setItem(DRAFT_KEY[mode], code);
    } catch {
      /* storage unavailable */
    }
  }, [code, mode]);

  const connected = org.kind === "connected";
  const canRun = connected && run.kind !== "running" && code.trim().length > 0;

  // Compile errors get a squiggle on the line, not just a message in the side pane.
  const markError = useCallback((line: number | null, column: number | null, message: string | null) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;
    if (line === null || !message) {
      monaco.editor.setModelMarkers(model, "sfcode", []);
      return;
    }
    const col = column ?? 1;
    monaco.editor.setModelMarkers(model, "sfcode", [
      { severity: monaco.MarkerSeverity.Error, message, startLineNumber: line, startColumn: col, endLineNumber: line, endColumn: model.getLineMaxColumn(line) },
    ]);
  }, []);

  const jumpTo = useCallback((line: number, column = 1) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column });
    editor.focus();
  }, []);

  const remember = useCallback(
    (ok: boolean) => {
      setHistory((h) => {
        const next = [{ code, at: Date.now(), ok }, ...h.filter((e) => e.code !== code)].slice(0, HISTORY_MAX);
        writeStored(HISTORY_KEY[mode], next);
        return next;
      });
    },
    [code, mode],
  );

  const execute = useCallback(async () => {
    if (!canRun) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRun({ kind: "running" });
    markError(null, null, null);
    const started = performance.now();
    try {
      const token = await getToken();
      const result: Result =
        mode === "apex" ? { mode, apex: await executeAnonymous(token, code, ctrl.signal) } : { mode, soql: await runSoql(token, code, ctrl.signal) };
      setRun({ kind: "done", result, ms: Math.round(performance.now() - started) });
      if (result.mode === "apex") {
        const r = result.apex;
        if (!r.compiled) markError(r.line, r.column, r.compileProblem);
        remember(r.compiled && r.success);
      } else {
        remember(true);
      }
      setTab("output");
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setRun(err instanceof ApiError ? { kind: "failed", message: err.message, code: err.code } : { kind: "failed", message: "Could not reach the SFCode server." });
      remember(false);
    }
  }, [canRun, code, getToken, markError, mode, remember]);

  useEffect(() => {
    runRef.current = () => void execute();
  }, [execute]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Through a ref so the binding always calls the latest `execute`.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
  };

  const load = (next: string) => {
    setCode(next);
    markError(null, null, null);
  };

  const editor = (
    <Editor
      loading={<div aria-hidden="true" className="h-full w-full animate-pulse bg-muted/40" />}
      language={mode === "apex" ? "apex" : "sql"}
      theme={editorTheme}
      value={code}
      onChange={(v) => setCode(v ?? "")}
      onMount={onMount}
      options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, wordWrap: "on", padding: { top: 8 } }}
    />
  );

  const output = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b px-2 py-1.5" role="tablist" aria-label="Output">
        {(mode === "apex" ? (["output", "limits", "log"] as const) : (["output"] as const)).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("rounded-md px-2.5 py-1 text-xs font-medium", tab === t ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {t === "output" ? (mode === "apex" ? "Output" : "Results") : t === "limits" ? "Limits" : "Debug log"}
          </button>
        ))}
        {run.kind === "done" && <span className="ml-auto text-xs tabular-nums text-muted-foreground">{run.ms} ms</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs">
        <Output run={run} tab={mode === "soql" ? "output" : tab} onJump={jumpTo} />
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col">
      <h1 className="sr-only">{mode === "apex" ? "Apex Playground" : "SOQL Playground"}</h1>
      <div className="flex min-h-11 flex-wrap items-center gap-2 border-b px-3 py-1.5">
        <nav aria-label="Playground" className="flex rounded-md border p-0.5 text-xs font-medium">
          {(["apex", "soql"] as const).map((m) => (
            <Link
              key={m}
              href={`/playground/${m}`}
              aria-current={m === mode ? "page" : undefined}
              className={cn("rounded px-2.5 py-1", m === mode ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {m === "apex" ? "Apex" : "SOQL"}
            </Link>
          ))}
        </nav>
        <SampleMenu mode={mode} onPick={load} />
        <HistoryMenu history={history} onPick={load} />
        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-muted-foreground" title="Reset to the first sample" onClick={() => load(firstSample(mode))}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {connected ? (
            <>
              <span className="hidden max-w-48 items-center gap-1 truncate text-xs text-muted-foreground md:flex" title={org.connection.orgId}>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" aria-hidden="true" /> {org.connection.username}
              </span>
              <Button size="sm" disabled={!canRun} onClick={() => void execute()} title="Run (Ctrl/Cmd+Enter)">
                {run.kind === "running" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
                Run
                <kbd className="ml-2 hidden rounded bg-primary-foreground/15 px-1 font-mono text-[10px] sm:inline">⌘↵</kbd>
              </Button>
            </>
          ) : (
            <OrgAction org={org} mode={mode} />
          )}
        </div>
      </div>

      {narrow ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="h-[55%] min-h-0 border-b">{editor}</div>
          <div className="min-h-0 flex-1">{output}</div>
        </div>
      ) : (
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel defaultSize="58%" minSize="25%">
            {editor}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="42%" minSize="20%">
            {output}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}

function SampleMenu({ mode, onPick }: { mode: Mode; onPick: (code: string) => void }) {
  const groups = mode === "apex" ? [...new Set(APEX_SAMPLES.map((s) => s.group))] : [];
  return (
    <select
      aria-label="Load a sample"
      className="h-8 max-w-40 rounded-md border bg-background px-2 text-xs"
      value=""
      onChange={(e) => {
        const all = mode === "apex" ? APEX_SAMPLES : SOQL_SAMPLES;
        const s = all.find((x) => x.id === e.target.value);
        if (s) onPick(s.code);
      }}
    >
      <option value="" disabled>
        Samples…
      </option>
      {mode === "apex"
        ? groups.map((g) => (
            <optgroup key={g} label={g}>
              {APEX_SAMPLES.filter((s) => s.group === g).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </optgroup>
          ))
        : SOQL_SAMPLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
    </select>
  );
}

function HistoryMenu({ history, onPick }: { history: HistoryEntry[]; onPick: (code: string) => void }) {
  if (history.length === 0) return null;
  return (
    <label className="relative flex items-center">
      <History className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <select
        aria-label="Re-open a recent run"
        className="h-8 max-w-44 rounded-md border bg-background pl-7 pr-2 text-xs"
        value=""
        onChange={(e) => {
          const entry = history[Number(e.target.value)];
          if (entry) onPick(entry.code);
        }}
      >
        <option value="" disabled>
          Recent ({history.length})
        </option>
        {history.map((h, i) => (
          <option key={h.at} value={i}>
            {h.ok ? "✓" : "✗"} {new Date(h.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {firstLine(h.code)}
          </option>
        ))}
      </select>
    </label>
  );
}

function firstLine(code: string): string {
  const line = code.split("\n").find((l) => l.trim() && !l.trim().startsWith("//")) ?? "";
  return line.trim().slice(0, 40);
}

function OrgAction({ org, mode }: { org: ReturnType<typeof useOrgConnection>["state"]; mode: Mode }) {
  switch (org.kind) {
    case "loading":
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Checking your org" />;
    case "signed-out":
      return (
        <SignInButton>
          <Button size="sm">
            <Play className="mr-1 h-3.5 w-3.5" /> Sign in to run
          </Button>
        </SignInButton>
      );
    case "unavailable":
      return <span className="text-xs text-muted-foreground">{org.message}</span>;
    case "disconnected":
      return (
        <Link href={`/settings/org?returnTo=/playground/${mode}`} className={buttonVariants({ size: "sm" })}>
          <Cloud className="mr-1 h-3.5 w-3.5" /> Connect org to run
        </Link>
      );
    case "connected":
      return null;
  }
}

function Output({ run, tab, onJump }: { run: Run; tab: Tab; onJump: (line: number, column?: number) => void }) {
  if (run.kind === "idle") return <p className="text-muted-foreground">Press Run (Ctrl/⌘ + Enter) to see output here.</p>;
  if (run.kind === "running") return <p className="text-muted-foreground">Running in your org…</p>;
  if (run.kind === "failed")
    return (
      <div className="flex gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <div>
          <p className="whitespace-pre-wrap">{run.message}</p>
          {run.code === "ORG_NOT_CONNECTED" && (
            <Link href="/settings/org" className="mt-2 inline-block underline">
              Connect an org
            </Link>
          )}
        </div>
      </div>
    );

  if (run.result.mode === "soql") return <SoqlTable result={run.result.soql} />;
  const r = run.result.apex;
  if (tab === "log") return <LogView log={r.debugLog} />;
  if (tab === "limits") return <LimitsView log={r.debugLog} />;

  if (!r.compiled)
    return (
      <Status icon={<XCircle className="h-4 w-4" />} tone="text-destructive" title="Compile error">
        {r.compileProblem}
        {r.line !== null && (
          <button type="button" className="mt-2 block underline" onClick={() => onJump(r.line ?? 1, r.column ?? 1)}>
            Go to line {r.line}, column {r.column ?? "?"}
          </button>
        )}
      </Status>
    );

  const debugs = extractUserDebug(r.debugLog);
  return (
    <div className="space-y-3">
      {r.success ? (
        <Status icon={<CheckCircle2 className="h-4 w-4" />} tone="text-green-700 dark:text-green-400" title="Executed successfully" />
      ) : (
        <Status icon={<XCircle className="h-4 w-4" />} tone="text-destructive" title="Uncaught exception">
          {r.exceptionMessage}
          {r.exceptionStackTrace && <StackTrace trace={r.exceptionStackTrace} onJump={onJump} />}
        </Status>
      )}
      {debugs.length === 0 ? (
        <p className="text-muted-foreground">No System.debug output.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {debugs.map((d, i) => (
            <li key={i} className="flex gap-2 px-2 py-1.5">
              {d.line !== null ? (
                <button type="button" title={`Go to line ${d.line}`} className="w-8 shrink-0 text-right text-muted-foreground hover:text-foreground hover:underline" onClick={() => onJump(d.line ?? 1)}>
                  {d.line}
                </button>
              ) : (
                <span className="w-8 shrink-0" />
              )}
              {d.level !== "DEBUG" && <span className="shrink-0 rounded bg-amber-500/15 px-1 text-[10px] text-amber-700 dark:text-amber-300">{d.level}</span>}
              <pre className="min-w-0 whitespace-pre-wrap break-words">{d.message}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** `AnonymousBlock: line 3, column 1` lines become links to that position. */
function StackTrace({ trace, onJump }: { trace: string; onJump: (line: number, column?: number) => void }) {
  return (
    <div className="mt-1 space-y-0.5 text-muted-foreground">
      {trace.split("\n").map((l, i) => {
        const m = /^AnonymousBlock: line (\d+), column (\d+)/.exec(l);
        return m ? (
          <button key={i} type="button" className="block text-left underline hover:text-foreground" onClick={() => onJump(Number(m[1]), Number(m[2]))}>
            {l}
          </button>
        ) : (
          <p key={i}>{l}</p>
        );
      })}
    </div>
  );
}

function LimitsView({ log }: { log: string }) {
  const limits = extractLimits(log).filter((l) => l.used > 0 || /SOQL queries|DML statements|CPU time|heap/i.test(l.name));
  if (limits.length === 0) return <p className="text-muted-foreground">This run&apos;s debug log has no limit summary.</p>;
  return (
    <ul className="space-y-2 font-sans">
      {limits.map((l) => {
        const pct = l.max > 0 ? Math.min(100, (l.used / l.max) * 100) : 0;
        return (
          <li key={l.name}>
            <div className="flex justify-between gap-2">
              <span>{l.name.replace(/^(Number of|Maximum) /, "")}</span>
              <span className="tabular-nums text-muted-foreground">
                {l.used.toLocaleString()} / {l.max.toLocaleString()}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className={cn("h-full rounded-full", pct > 80 ? "bg-destructive" : pct > 50 ? "bg-amber-500" : "bg-primary")} style={{ width: `${Math.max(pct, l.used > 0 ? 2 : 0)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function LogView({ log }: { log: string }) {
  const [filter, setFilter] = useState("");
  if (!log) return <p className="text-muted-foreground">(no debug log returned)</p>;
  const needle = filter.trim().toLowerCase();
  const lines = needle ? log.split("\n").filter((l) => l.toLowerCase().includes(needle)) : log.split("\n");
  return (
    <div className="space-y-2">
      <input
        type="search"
        aria-label="Filter the debug log"
        placeholder="Filter lines (e.g. USER_DEBUG, SOQL_EXECUTE)"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="sticky top-0 h-8 w-full rounded-md border bg-background px-2 font-sans text-xs"
      />
      {needle && <p className="text-muted-foreground">{lines.length} matching lines</p>}
      <pre className="whitespace-pre-wrap break-words">{lines.join("\n")}</pre>
    </div>
  );
}

function SoqlTable({ result }: { result: SoqlQueryResult }) {
  if (result.rows.length === 0) return <p className="text-muted-foreground">{result.totalSize > 0 ? `COUNT() = ${result.totalSize}` : "No rows."}</p>;
  return (
    <div className="space-y-2">
      <p className="font-sans text-muted-foreground">
        {result.rows.length.toLocaleString()} {result.rows.length === 1 ? "row" : "rows"}
        {result.truncated && ` shown of ${result.totalSize.toLocaleString()} (add a LIMIT to narrow it)`}
      </p>
      <div className="overflow-auto rounded-md border">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {result.columns.map((c) => (
                <th key={c} scope="col" className="whitespace-nowrap border-b px-2 py-1.5 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i} className="odd:bg-muted/30">
                {result.columns.map((c) => (
                  <td key={c} className="max-w-72 truncate border-b px-2 py-1" title={cell(row[c])}>
                    {row[c] === null || row[c] === undefined ? <span className="text-muted-foreground">null</span> : cell(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function Status({ icon, tone, title, children }: { icon: React.ReactNode; tone: string; title: string; children?: React.ReactNode }) {
  return (
    <div className={cn("flex gap-2", tone)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-1 whitespace-pre-wrap">{children}</div>}
      </div>
    </div>
  );
}
