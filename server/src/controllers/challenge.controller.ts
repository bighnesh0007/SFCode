import type { RequestHandler } from "express";
import { validatedBody, validatedParams, validatedQuery } from "../middleware/validate.ts";
import type { ChallengeService } from "../services/challenges/challenge.service.ts";
import { accepted, ok } from "../utils/respond.ts";
import type { ListQuery, SlugParams, SubmissionParams, SubmitBody } from "../validation/challenge.schema.ts";

export function challengeController(service: ChallengeService) {
  const list: RequestHandler = async (req, res) => {
    ok(res, { difficulties: service.difficulties(), challenges: await service.list(req.auth?.userId ?? null, validatedQuery<ListQuery>(req).track) });
  };

  const get: RequestHandler = async (req, res) => {
    const { slug } = validatedParams<SlugParams>(req);
    const view = service.get(slug);
    const author = await service.author(slug);
    ok(res, author ? { ...view, author } : view);
  };

  const submit: RequestHandler = async (req, res) => {
    const { slug } = validatedParams<SlugParams>(req);
    const { files } = validatedBody<SubmitBody>(req);
    accepted(res, await service.submit(req.auth?.userId ?? "", slug, files));
  };

  const history: RequestHandler = async (req, res) => {
    ok(res, await service.history(req.auth?.userId ?? "", validatedParams<SlugParams>(req).slug));
  };

  const submission: RequestHandler = async (req, res) => {
    ok(res, await service.view(req.auth?.userId ?? "", validatedParams<SubmissionParams>(req).id));
  };

  const submitLwc: RequestHandler = async (req, res) => {
    const { slug } = validatedParams<SlugParams>(req);
    const { files } = validatedBody<SubmitBody>(req);
    ok(res, await service.submitLwc(req.auth?.userId ?? "", slug, files));
  };

  return { list, get, submit, submitLwc, history, submission };
}
