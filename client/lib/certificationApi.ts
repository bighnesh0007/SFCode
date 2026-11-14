/** Typed calls to /api/v1/certification. Shapes mirror server/src/services/certification. */
import { apiRequest } from "./apiClient";

type Token = string | null;

export interface ExamSummary {
  exam: string;
  title: string;
  description: string;
  questionCount: number;
  mock: { questions: number; minutes: number; passPercent: number } | null;
  sections: { id: string; title: string; total: number; answered: number | null; correct: number | null }[];
  readiness: number | null;
  weakest: string | null;
}

export interface PracticeQuestion {
  id: string;
  section: string;
  prompt: string;
  options: { id: string; text: string }[];
  choose: number;
  /** Written by a community Buddy and approved by a reviewer. */
  community?: boolean;
}

export interface AnswerResult {
  correct: boolean;
  answer: string[];
  explanation: string;
}

export const listExams = (token: Token) => apiRequest<ExamSummary[]>("/api/v1/certification", { token });

export const getPractice = (exam: string, section: string | null, count = 10) =>
  apiRequest<PracticeQuestion[]>(
    `/api/v1/certification/${encodeURIComponent(exam)}/questions?count=${count}${section ? `&section=${encodeURIComponent(section)}` : ""}`,
  );

export const submitAnswer = (token: Token, questionId: string, selected: string[]) =>
  apiRequest<AnswerResult>("/api/v1/certification/answers", { method: "POST", token, body: { questionId, selected } });

export interface ReviewQueue {
  due: PracticeQuestion[];
  upcoming: number;
  nextDueAt: string | null;
  mastered: number;
}
export const getReview = (token: Token) => apiRequest<ReviewQueue>("/api/v1/certification/review", { token });

export interface MockExam {
  exam: string;
  title: string;
  minutes: number;
  passPercent: number;
  realQuestions: number;
  realMinutes: number;
  questions: PracticeQuestion[];
}

export interface MockResult {
  score: number;
  passed: boolean;
  passPercent: number;
  correct: number;
  total: number;
  sections: { id: string; title: string; correct: number; total: number }[];
  results: { id: string; correct: boolean; selected: string[]; answer: string[]; explanation: string }[];
}

export const getMock = (exam: string) => apiRequest<MockExam>(`/api/v1/certification/${encodeURIComponent(exam)}/mock`);

export const gradeMock = (token: Token, exam: string, answers: Record<string, string[]>) =>
  apiRequest<MockResult>(`/api/v1/certification/${encodeURIComponent(exam)}/mock/grade`, { method: "POST", token, body: { answers } });
