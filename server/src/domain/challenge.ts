/** Shapes shared by the challenge catalogue, grader and API. */
import type { Difficulty } from "./difficulty.ts";

export type ApexFileType = "class" | "trigger" | "soql";
/** Practice areas. The one list: catalog validation and the API schema both read it. */
export const TRACKS = ["apex", "soql", "debug", "flow", "lwc"] as const;
export type Track = (typeof TRACKS)[number];
/**
 * Tracks whose solves the server verified itself (an org deploy ran the tests).
 * Only these earn points: LWC tests run in the learner's browser and their
 * result can't be trusted by the server.
 */
export const SCORED_TRACKS: readonly Track[] = ["apex", "soql", "debug", "flow"];

export interface ChallengeFile {
  name: string;
  type: ApexFileType;
}

/** A problem as loaded from server/problems/<slug>. Holds secrets: never serialise whole. */
export interface Challenge {
  slug: string;
  title: string;
  difficulty: Difficulty;
  track: Track;
  category: string;
  order: number;
  tags: string[];
  statement: string;
  files: ChallengeFile[];
  /** Starter source keyed by file name. */
  starter: Record<string, string>;
  /** Hidden. Never sent to a client. */
  reference: Record<string, string>;
  /** Hidden. Never sent to a client. */
  testClass: { name: string; source: string };
  /**
   * Flow problems only: the flow the learner builds in their own org. There
   * are no editable files; the hidden tests exercise the org's active flow.
   */
  flow?: { apiName: string; kind: "record-triggered" | "autolaunched" };
  /**
   * LWC problems only. Compiled on the server, run and tested in the learner's
   * browser (sandboxed iframe), so `tests` is sent to the client by design.
   */
  lwc?: { component: string; tests: string };
}

export const VERDICTS = ["accepted", "wrong_answer", "compile_error", "coverage", "error"] as const;
export type Verdict = (typeof VERDICTS)[number];
export type SubmissionStatus = "running" | Verdict;

export interface TestOutcome {
  method: string;
  passed: boolean;
  message: string | null;
  stackTrace: string | null;
  timeMs: number | null;
}

export interface CompileProblem {
  /** The user's file name, or null when the problem is in the hidden tests. */
  file: string | null;
  line: number | null;
  column: number | null;
  message: string;
}

export interface CoverageLine {
  name: string;
  covered: number;
  total: number;
}

export interface GradeResult {
  verdict: Verdict;
  testsRun: number;
  testsPassed: number;
  tests: TestOutcome[];
  compileErrors: CompileProblem[];
  coverage: CoverageLine[];
  /** Deploy-level message (coverage warnings, cancellations). */
  message: string | null;
}
