/**
 * Pure grading logic: build the deploy package, and turn Salesforce's
 * DeployResult into a verdict. No I/O, so both halves are unit-testable.
 *
 * The verdict is decided here, server-side, from Salesforce's own report —
 * never from anything the client says.
 */
import { strToU8, zipSync } from "fflate";
import type { Challenge, CompileProblem, CoverageLine, GradeResult, TestOutcome } from "../../domain/challenge.ts";
import { extensionFor } from "./catalog.ts";

const MD_NS = "http://soap.sforce.com/2006/04/metadata";

function metaXml(kind: "ApexClass" | "ApexTrigger", apiVersion: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${kind} xmlns="${MD_NS}"><apiVersion>${apiVersion}</apiVersion><status>Active</status></${kind}>\n`;
}

/**
 * The user's files plus the hidden test class, as a base64 zip for a
 * single-package deploy. File NAMES come only from the problem definition;
 * the user controls file CONTENTS only.
 */
export function buildDeployPackage(challenge: Challenge, sources: Record<string, string>, apiVersion: string): string {
  const entries: Record<string, Uint8Array> = {};
  const classes = [challenge.testClass.name];
  const triggers: string[] = [];

  for (const f of challenge.files) {
    const source = sources[f.name];
    if (source === undefined) throw new Error(`missing source for ${f.name}`);
    const dir = f.type === "class" ? "classes" : "triggers";
    const path = `${dir}/${f.name}.${extensionFor(f.type)}`;
    entries[path] = strToU8(source);
    entries[`${path}-meta.xml`] = strToU8(metaXml(f.type === "class" ? "ApexClass" : "ApexTrigger", apiVersion));
    (f.type === "class" ? classes : triggers).push(f.name);
  }
  entries[`classes/${challenge.testClass.name}.cls`] = strToU8(challenge.testClass.source);
  entries[`classes/${challenge.testClass.name}.cls-meta.xml`] = strToU8(metaXml("ApexClass", apiVersion));

  const types = [
    ["ApexClass", classes],
    ["ApexTrigger", triggers],
  ] as const;
  entries["package.xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="${MD_NS}">\n` +
      types
        .filter(([, members]) => members.length > 0)
        .map(([name, members]) => `  <types>${members.map((m) => `<members>${m}</members>`).join("")}<name>${name}</name></types>\n`)
        .join("") +
      `  <version>${apiVersion}</version>\n</Package>\n`,
  );

  return Buffer.from(zipSync(entries, { level: 6 })).toString("base64");
}

// ── interpreting a DeployResult ──────────────────────────────────────────────

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const list = (v: unknown): Raw[] => (Array.isArray(v) ? v.map(obj) : v ? [obj(v)] : []);
const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const int = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function isDeployDone(raw: Raw): boolean {
  return raw.done === "true";
}

/** Map a FINISHED DeployResult to a grade. */
export function interpretDeployResult(challenge: Challenge, raw: Raw): GradeResult {
  const details = obj(raw.details);
  const runTestResult = obj(details.runTestResult);
  const userFiles = new Map(challenge.files.map((f) => [`${f.type === "class" ? "classes" : "triggers"}/${f.name}.${extensionFor(f.type)}`, f]));

  const compileErrors: CompileProblem[] = list(details.componentFailures).map((c) => {
    const fileName = text(c.fileName) ?? "";
    const own = userFiles.get(fileName);
    return {
      // Errors in the hidden test class are reported without naming the file.
      file: own ? `${own.name}.${extensionFor(own.type)}` : null,
      line: int(c.lineNumber),
      column: int(c.columnNumber),
      message: text(c.problem) ?? "Unknown deployment problem.",
    };
  });

  const tests: TestOutcome[] = [
    ...list(runTestResult.successes).map((t) => ({ method: text(t.methodName) ?? "?", passed: true, message: null, stackTrace: null, timeMs: int(t.time) })),
    ...list(runTestResult.failures).map((t) => ({
      method: text(t.methodName) ?? "?",
      passed: false,
      message: text(t.message),
      stackTrace: text(t.stackTrace),
      timeMs: int(t.time),
    })),
  ].sort((a, b) => a.method.localeCompare(b.method));

  const userNames = new Set(challenge.files.map((f) => f.name.toLowerCase()));
  const coverage: CoverageLine[] = list(runTestResult.codeCoverage)
    .filter((c) => userNames.has((text(c.name) ?? "").toLowerCase()))
    .map((c) => {
      const total = int(c.numLocations) ?? 0;
      return { name: text(c.name) ?? "?", total, covered: total - (int(c.numLocationsNotCovered) ?? 0) };
    });

  const coverageWarnings = list(runTestResult.codeCoverageWarnings)
    .map((w) => text(w.message))
    .filter((m): m is string => m !== null);

  const testsPassed = tests.filter((t) => t.passed).length;
  const base = { testsRun: tests.length, testsPassed, tests, compileErrors, coverage };

  if (raw.success === "true" && raw.status === "Succeeded") return { verdict: "accepted", message: null, ...base };
  if (compileErrors.length > 0) return { verdict: "compile_error", message: null, ...base };
  if (tests.some((t) => !t.passed)) return { verdict: "wrong_answer", message: null, ...base };
  if (coverageWarnings.length > 0) return { verdict: "coverage", message: coverageWarnings.join("\n"), ...base };
  return {
    verdict: "error",
    message: text(raw.errorMessage) ?? `Salesforce finished the deploy with status ${text(raw.status) ?? "unknown"}.`,
    ...base,
  };
}
