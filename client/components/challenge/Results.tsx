"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { Submission } from "@/lib/challengesApi";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/verdicts";
import { cn } from "@/lib/utils";

const HINT: Partial<Record<Submission["status"], string>> = {
  compile_error: "Fix the errors below. Ones marked “hidden tests” mean your code doesn't provide what the tests call — check method names and signatures against the statement.",
  coverage: "Every class and trigger needs 75% coverage from the hidden tests. Remove code the tests can't reach.",
};

const FLOW_HINT =
  "Most flow failures come down to three things: the flow isn't Active, its API name doesn't match the statement exactly, or its entry conditions differ from what's asked. The messages below come from the hidden tests.";

/**
 * Splits an Apex assertion failure into its parts. System.assertEquals reports
 * "Assertion Failed: <message>: Expected: X, Actual: Y"; anything else is shown as is.
 */
export function parseAssertion(raw: string): { note: string | null; expected: string; actual: string; rest: string } | null {
  const m = /^(?:System\.AssertException: )?Assertion Failed: (?:(.*?): )?Expected: ([\s\S]*?), Actual: ([^\n]*)([\s\S]*)$/.exec(raw.trim());
  if (!m) return null;
  return { note: m[1] ?? null, expected: m[2] ?? "", actual: m[3] ?? "", rest: (m[4] ?? "").trim() };
}

function FailureMessage({ message }: { message: string }) {
  const a = parseAssertion(message);
  if (!a) return <pre className="mt-1.5 whitespace-pre-wrap font-mono text-xs text-red-600 dark:text-red-400">{message}</pre>;
  return (
    <div className="mt-2 space-y-1.5 text-xs">
      {a.note && <p className="text-foreground">{a.note}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono">
        <dt className="text-muted-foreground">Expected</dt>
        <dd className="whitespace-pre-wrap rounded bg-green-500/10 px-1.5 py-0.5 text-green-700 dark:text-green-300">{a.expected || "(empty)"}</dd>
        <dt className="text-muted-foreground">Got</dt>
        <dd className="whitespace-pre-wrap rounded bg-red-500/10 px-1.5 py-0.5 text-red-700 dark:text-red-300">{a.actual || "(empty)"}</dd>
      </dl>
      {a.rest && <pre className="whitespace-pre-wrap font-mono text-muted-foreground">{a.rest}</pre>}
    </div>
  );
}

export function Results({ submission, isFlow = false, onOpenFile }: { submission: Submission | null; isFlow?: boolean; onOpenFile: (fileName: string) => void }) {
  if (!submission) return <p className="text-sm text-muted-foreground">Submit to grade your solution against the hidden tests.</p>;
  if (submission.status === "running")
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Deploying check-only and running tests in your org… this usually takes 10–60 seconds.
      </div>
    );

  const r = submission.result;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-baseline gap-3">
        <h2 className={cn("text-lg font-semibold", STATUS_CLASS[submission.status])}>{STATUS_LABEL[submission.status]}</h2>
        {r && r.testsRun > 0 && (
          <span className="tabular-nums text-muted-foreground">
            {r.testsPassed}/{r.testsRun} tests passed
          </span>
        )}
      </div>
      {isFlow && submission.status === "wrong_answer" ? (
        <p className="text-xs text-muted-foreground">{FLOW_HINT}</p>
      ) : (
        HINT[submission.status] && <p className="text-xs text-muted-foreground">{HINT[submission.status]}</p>
      )}
      {r?.message && <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 font-mono text-xs">{r.message}</pre>}

      {r && r.compileErrors.length > 0 && (
        <ul className="space-y-1.5">
          {r.compileErrors.map((e, i) => (
            <li key={i} className="font-mono text-xs">
              {e.file ? (
                <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => onOpenFile(e.file ?? "")}>
                  {e.file}
                  {e.line !== null && `:${e.line}`}
                  {e.column !== null && `:${e.column}`}
                </button>
              ) : (
                <span className="text-muted-foreground">hidden tests</span>
              )}{" "}
              — {e.message}
            </li>
          ))}
        </ul>
      )}

      {r && r.tests.length > 0 && (
        <ul className="space-y-1.5">
          {r.tests.map((t) => (
            <li key={t.method} className="rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                {t.passed ? <CheckCircle2 className="h-4 w-4 text-green-700 dark:text-green-400" /> : <XCircle className="h-4 w-4 text-red-500" />}
                <span className="font-mono text-xs">{t.method}</span>
                {t.timeMs !== null && <span className="ml-auto text-xs tabular-nums text-muted-foreground">{t.timeMs} ms</span>}
              </div>
              {!t.passed && t.message && <FailureMessage message={t.message} />}
            </li>
          ))}
        </ul>
      )}

      {r && r.coverage.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Coverage</h3>
          <ul className="space-y-1.5">
            {r.coverage.map((c) => {
              const pct = c.total === 0 ? 100 : Math.round((c.covered / c.total) * 100);
              return (
                <li key={c.name} className="flex items-center gap-2 text-xs">
                  <span className="w-48 truncate font-mono">{c.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", pct >= 75 ? "bg-green-500" : "bg-amber-500")} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
