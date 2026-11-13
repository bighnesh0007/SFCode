import { z } from "zod";
import { MAX_SESSION_QUESTIONS } from "../services/certification/certification.service.ts";

const id = z.string().regex(/^[a-z0-9-]{1,80}$/);

export const examParams = z.strictObject({ exam: id });
export type ExamParams = z.infer<typeof examParams>;

export const practiceQuery = z.object({
  section: id.optional(),
  count: z.coerce.number().int().min(1).max(MAX_SESSION_QUESTIONS).default(10),
});
export type PracticeQuery = z.infer<typeof practiceQuery>;

export const answerBody = z.strictObject({
  questionId: id,
  selected: z.array(z.string().regex(/^[a-h]$/)).min(1).max(8),
});
export type AnswerBody = z.infer<typeof answerBody>;

export const mockGradeBody = z.strictObject({
  // An empty array is an unanswered question; it still counts toward the score.
  answers: z.record(id, z.array(z.string().regex(/^[a-h]$/)).max(8)).refine((a) => Object.keys(a).length <= 100, "Too many questions."),
});
export type MockGradeBody = z.infer<typeof mockGradeBody>;
