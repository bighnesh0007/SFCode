"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { AlertTriangle, CheckCircle2, Cloud, Loader2, Play, XCircle } from "lucide-react";
import type { OnMount } from "@monaco-editor/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useOrgConnection } from "@/components/useOrgConnection";
import { ApiError } from "@/lib/apiClient";
import { executeAnonymous, type ApexExecutionResult } from "@/lib/salesforceApi";
import { cn } from "@/lib/utils";
import { extractUserDebug } from "./debugLog";
import { APEX_SAMPLES } from "./samples";

// Monaco touches `window`; never render it on the server.
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const DRAFT_KEY = "sfcode.apex.draft";

type Run =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: ApexExecutionResult; ms: number }
  | { kind: "failed"; message: string; code?: string };

type Tab = "debug" | "log";

function readDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? APEX_SAMPLES[0]?.code ?? "";
  } catch {
    return APEX_SAMPLES[0]?.code ?? "";
  }
}

export default function ApexPlayground() {
  const { resolvedTheme } = useTheme();
  const { getToken } = useAuth();
  const { state: org } = useOrgConnection();
  // Lazy init: the editor is client-only (ssr: false), so a server/client
  // difference in this value never reaches hydrated markup.
  const [code, setCode] = useState<string>(readDraft);
  const [run, setRun] = useState<Run>({ kind: "idle" });
  const [tab, setTab] = useState<Tab>("debug");
  const runRef = useRef<() => void>(() => {});
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      if (code) localStorage.setItem(DRAFT_KEY, code);
    } catch {
      /* storage unavailable: drafts just don't persist */
    }
  }, [code]);

  const canRun = org.kind === "connected" && run.kind !== "running" && code.trim().length > 0;

  const execute = useCallback(async () => {
    if (!canRun) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRun({ kind: "running" });
    const started = performance.now();
    try {
      const result = await executeAnonymous(await getToken(), code, ctrl.signal);
      setRun({ kind: "done", result, ms: Math.round(performance.now() - started) });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setRun(err instanceof ApiError ? { kind: "failed", message: err.message, code: err.code } : { kind: "failed", message: "Could not reach the SFCode server." });
    }
  }, [canRun, code, getToken]);

  useEffect(() => {
    runRef.current = () => void execute();
  }, [execute]);

  const onMount: OnMount = (editor, monaco) => {
    // Through a ref so the binding always calls the latest `execute`.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <h1 className="mr-2 text-sm font-semibold">Apex Playground</h1>
        <select
          aria-label="Load a sample"
          className="h-8 rounded-md border bg-background px-2 text-xs"
          value=""
          onChange={(e) => {
            const s = APEX_SAMPLES.find((x) => x.id === e.target.value);
            if (s) setCode(s.code);
          }}
        >
          <option value="" disabled>Samples…</option>
          {APEX_SAMPLES.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <OrgStatus org={org} />
          <Button size="sm" disabled={!canRun} onClick={() => void execute()} title="Run (Ctrl/Cmd+Enter)">
            {run.kind === "running" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
            Run
          </Button>
        </div>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize="58%" minSize="25%">
          <Editor
            language="apex"
            theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
            value={code}
            onChange={(v) => setCode(v ?? "")}
            onMount={onMount}
            options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4 }}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="42%" minSize="20%">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-1 border-b px-2 py-1.5">
              {(["debug", "log"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn("rounded-md px-2.5 py-1 text-xs font-medium", tab === t ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {t === "debug" ? "Output" : "Full debug log"}
                </button>
              ))}
              {run.kind === "done" && <span className="ml-auto text-xs text-muted-foreground">{run.ms} ms</span>}
            </div>
            <div className="flex-1 overflow-auto p-3 font-mono text-xs">
              <Output run={run} tab={tab} />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function OrgStatus({ org }: { org: ReturnType<typeof useOrgConnection>["state"] }) {
  switch (org.kind) {
    case "loading":
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    case "signed-out":
      return (
        <SignInButton mode="modal">
          <Button size="sm" variant="outline">Sign in to run</Button>
        </SignInButton>
      );
    case "unavailable":
      return <span className="text-xs text-muted-foreground">{org.message}</span>;
    case "disconnected":
      return (
        <Link href="/settings/org?returnTo=/playground/apex" className={buttonVariants({ size: "sm", variant: "outline" })}>
          <Cloud className="mr-1 h-3.5 w-3.5" /> Connect org to run
        </Link>
      );
    case "connected":
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground" title={org.connection.orgId}>
          <Cloud className="h-3.5 w-3.5 text-sky-500" /> {org.connection.username}
        </span>
      );
  }
}

function Output({ run, tab }: { run: Run; tab: Tab }) {
  if (run.kind === "idle") return <p className="text-muted-foreground">Run your code to see output here.</p>;
  if (run.kind === "running") return <p className="text-muted-foreground">Executing in your org…</p>;
  if (run.kind === "failed")
    return (
      <div className="flex gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <div>
          <p>{run.message}</p>
          {run.code === "ORG_NOT_CONNECTED" && (
            <Link href="/settings/org?returnTo=/playground/apex" className="mt-2 inline-block underline">Connect an org</Link>
          )}
        </div>
      </div>
    );

  const r = run.result;
  if (tab === "log") return <pre className="whitespace-pre-wrap break-words">{r.debugLog || "(no debug log returned)"}</pre>;

  if (!r.compiled)
    return (
      <Status icon={<XCircle className="h-4 w-4" />} tone="text-destructive" title="Compile error">
        {r.line !== null && `Line ${r.line}, column ${r.column ?? "?"}: `}
        {r.compileProblem}
      </Status>
    );

  const debugs = extractUserDebug(r.debugLog);
  return (
    <div className="space-y-3">
      {r.success ? (
        <Status icon={<CheckCircle2 className="h-4 w-4" />} tone="text-green-600 dark:text-green-400" title="Executed successfully" />
      ) : (
        <Status icon={<XCircle className="h-4 w-4" />} tone="text-destructive" title="Uncaught exception">
          {r.exceptionMessage}
          {r.exceptionStackTrace && <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.exceptionStackTrace}</pre>}
        </Status>
      )}
      {debugs.length === 0 ? (
        <p className="text-muted-foreground">No System.debug output.</p>
      ) : (
        <ul className="space-y-1">
          {debugs.map((d, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-10 shrink-0 text-right text-muted-foreground">{d.line ?? ""}</span>
              <pre className="whitespace-pre-wrap break-words">{d.message}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Status({ icon, tone, title, children }: { icon: React.ReactNode; tone: string; title: string; children?: React.ReactNode }) {
  return (
    <div className={cn("flex gap-2", tone)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-1 whitespace-pre-wrap">{children}</div>}
      </div>
    </div>
  );
}
