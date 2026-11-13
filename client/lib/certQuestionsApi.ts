/** Buddy-written certification questions. Shapes mirror server/src/services/certification/certQuestion.service.ts. */
import { apiRequest } from "./apiClient";

type Token = string | null;

export type CertQuestionStatus = "submitted" | "changes_requested" | "approved" | "rejected";

export interface CertQuestionContent {
  exam: string;
  section: string;
  prompt: string;
  options: { id: string; text: string }[];
  answer: string[];
  explanation: string;
}

export interface CertQuestionView {
  id: string;
  status: CertQuestionStatus;
  content: CertQuestionContent;
  examTitle: string;
  sectionTitle: string;
  reviewNote: string | null;
  active: boolean;
  author: string | null;
  updatedAt: string;
}

export const myCertQuestions = (t: Token) => apiRequest<CertQuestionView[]>("/api/v1/contribute/cert-questions", { token: t });
export const submitCertQuestion = (t: Token, content: CertQuestionContent) =>
  apiRequest<CertQuestionView>("/api/v1/contribute/cert-questions", { method: "POST", token: t, body: { content } });
export const editCertQuestion = (t: Token, id: string, content: CertQuestionContent) =>
  apiRequest<CertQuestionView>(`/api/v1/contribute/cert-questions/${id}`, { method: "PUT", token: t, body: { content } });
export const certReviewQueue = (t: Token) => apiRequest<CertQuestionView[]>("/api/v1/admin/cert-review", { token: t });
export const decideCertQuestion = (t: Token, id: string, action: "approve" | "changes" | "reject", note: string) =>
  apiRequest<CertQuestionView>(`/api/v1/admin/cert-review/${id}`, { method: "POST", token: t, body: { action, note } });

export const STATUS_TEXT: Record<CertQuestionStatus, string> = {
  submitted: "Waiting for review",
  changes_requested: "Changes requested",
  approved: "Live in practice",
  rejected: "Not accepted",
};
