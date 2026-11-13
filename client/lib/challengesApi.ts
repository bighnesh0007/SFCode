/** Typed calls to /api/v1/challenges. Shapes mirror server/src/services/challenges. */
import { apiRequest } from "./apiClient";

type Token = string | null;

export type Tone = "green" | "amber" | "red";
// Mirrors server/src/domain/challenge.ts TRACKS.
export type Track = "apex" | "soql" | "debug" | "flow" | "lwc";
export interface DifficultyDef {
  id: string;
  rank: number;
  tone: Tone;
}

export interface ChallengeSummary {
  slug: string;
  track: Track;
  title: string;
  difficulty: string;
  category: string;
  tags: string[];
  progress: "solved" | "attempted" | null;
  community?: boolean;
}

export interface ChallengeFile {
  name: string;
  type: "class" | "trigger" | "soql" | "lwc";
  fileName: string;
  starter: string;
}

export interface ChallengeView {
  /** Community problems: who wrote it. */
  author?: { handle: string; displayName: string };
  slug: string;
  track: Track;
  title: string;
  difficulty: string;
  category: string;
  tags: string[];
  statement: string;
  files: ChallengeFile[];
  /** Flow problems: built in the learner's org; there are no files. */
  flow?: { apiName: string; kind: "record-triggered" | "autolaunched" };
  /** LWC problems: compiled on the server, run and tested in a sandboxed iframe. */
  lwc?: { component: string; tests: string };
}

export type Verdict = "accepted" | "wrong_answer" | "compile_error" | "coverage" | "error";
export type SubmissionStatus = "running" | Verdict;

export interface GradeResult {
  verdict: Verdict;
  testsRun: number;
  testsPassed: number;
  tests: { method: string; passed: boolean; message: string | null; stackTrace: string | null; timeMs: number | null }[];
  compileErrors: { file: string | null; line: number | null; column: number | null; message: string }[];
  coverage: { name: string; covered: number; total: number }[];
  message: string | null;
}

export interface Submission {
  id: string;
  problemSlug: string;
  status: SubmissionStatus;
  createdAt: string;
  completedAt: string | null;
  files: Record<string, string>;
  result: GradeResult | null;
}

export interface SubmissionSummary {
  id: string;
  status: SubmissionStatus;
  createdAt: string;
  testsPassed: number | null;
  testsRun: number | null;
}

export const listChallenges = (token: Token, track: Track) =>
  apiRequest<{ difficulties: DifficultyDef[]; challenges: ChallengeSummary[] }>(`/api/v1/challenges?track=${track}`, { token });

export const getChallenge = (slug: string) => apiRequest<ChallengeView>(`/api/v1/challenges/${encodeURIComponent(slug)}`);

export const submitSolution = (token: Token, slug: string, files: Record<string, string>) =>
  apiRequest<Submission>(`/api/v1/challenges/${encodeURIComponent(slug)}/submissions`, { method: "POST", token, body: { files } });

export const getSubmission = (token: Token, id: string) => apiRequest<Submission>(`/api/v1/challenges/submissions/${encodeURIComponent(id)}`, { token });

export const listSubmissions = (token: Token, slug: string) =>
  apiRequest<SubmissionSummary[]>(`/api/v1/challenges/${encodeURIComponent(slug)}/submissions`, { token });
