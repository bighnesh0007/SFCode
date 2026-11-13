import type { RequestHandler } from "express";
import { validatedBody, validatedParams, validatedQuery } from "../middleware/validate.ts";
import type { CertificationService } from "../services/certification/certification.service.ts";
import { ok } from "../utils/respond.ts";
import type { AnswerBody, ExamParams, MockGradeBody, PracticeQuery } from "../validation/certification.schema.ts";

export function certificationController(service: CertificationService) {
  const list: RequestHandler = async (req, res) => {
    ok(res, await service.list(req.auth?.userId ?? null));
  };
  const practice: RequestHandler = (req, res) => {
    const { section, count } = validatedQuery<PracticeQuery>(req);
    ok(res, service.practice(validatedParams<ExamParams>(req).exam, section, count));
  };
  const answer: RequestHandler = async (req, res) => {
    const { questionId, selected } = validatedBody<AnswerBody>(req);
    ok(res, await service.answer(req.auth?.userId ?? null, questionId, selected));
  };
  const mock: RequestHandler = (req, res) => {
    ok(res, service.mock(validatedParams<ExamParams>(req).exam));
  };
  const gradeMock: RequestHandler = async (req, res) => {
    const { answers } = validatedBody<MockGradeBody>(req);
    ok(res, await service.gradeMock(req.auth?.userId ?? null, validatedParams<ExamParams>(req).exam, answers));
  };
  return { list, practice, answer, mock, gradeMock };
}
