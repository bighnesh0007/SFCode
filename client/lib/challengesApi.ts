/** Typed calls to /api/v1/challenges. Shapes mirror server/src/services/challenges. */
import { apiRequest } from "./apiClient";

type Token = string | null;

export type Tone = "green" | "amber" | "red";
export interface DifficultyDef {
  id: string;
  rank: number;
  tone: Tone;
}

export interface ChallengeSummary {
  slug: string;
  title: string;
  difficulty: string;
  category: string;
  tags: string[];
  progress: "solved" | "attempted" | null;
}

export interface ChallengeFile {
  name: string;
  type: "class" | "trigger";
  fileName: string;
  starter: string;
}

export interface ChallengeView {
  slug: string;
  title: string;
  difficulty: string;
  category: string;
  tags: string[];
  statement: string;
  files: ChallengeFile[];
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

export const listChallenges = (token: Token) =>
  apiRequest<{ difficulties: DifficultyDef[]; challenges: ChallengeSummary[] }>("/api/v1/challenges", { token });

export const getChallenge = (slug: string) => apiRequest<ChallengeView>(`/api/v1/challenges/${encodeURIComponent(slug)}`);

export const submitSolution = (token: Token, slug: string, files: Record<string, string>) =>
  apiRequest<Submission>(`/api/v1/challenges/${encodeURIComponent(slug)}/submissions`, { method: "POST", token, body: { files } });

export const getSubmission = (token: Token, id: string) => apiRequest<Submission>(`/api/v1/challenges/submissions/${encodeURIComponent(id)}`, { token });

export const listSubmissions = (token: Token, slug: string) =>
  apiRequest<SubmissionSummary[]>(`/api/v1/challenges/${encodeURIComponent(slug)}/submissions`, { token });
