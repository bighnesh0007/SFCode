import type { RequestHandler } from "express";
import { validatedBody, validatedParams } from "../middleware/validate.ts";
import type { RoadmapService } from "../services/roadmap/roadmap.service.ts";
import type { ContestService } from "../services/contests/contest.service.ts";
import type { StoreService } from "../services/store/store.service.ts";
import { created, noContent, ok } from "../utils/respond.ts";
import type { ContestSlugParams, CreateContestBody, EquipBody, OnboardingBody, RoadmapParams, RoadmapReadBody, StoreItemBody } from "../validation/contest.schema.ts";

export function contestController(service: ContestService) {
  const user = (req: { auth?: { userId: string } }) => req.auth?.userId ?? "";
  const slug = (req: Parameters<RequestHandler>[0]) => validatedParams<ContestSlugParams>(req).slug;
  return {
    list: (async (_req, res) => ok(res, await service.list())) as RequestHandler,
    get: (async (req, res) => ok(res, await service.get(slug(req), req.auth?.userId ?? null))) as RequestHandler,
    join: (async (req, res) => ok(res, await service.join(user(req), slug(req)))) as RequestHandler,
    create: (async (req, res) => {
      const b = validatedBody<CreateContestBody>(req);
      const c = await service.create(user(req), { title: b.title, startsAt: new Date(b.startsAt), endsAt: new Date(b.endsAt), problems: b.problems });
      created(res, c, `/api/v1/contests/${c.slug}`);
    }) as RequestHandler,
    remove: (async (req, res) => {
      await service.remove(user(req), slug(req));
      noContent(res);
    }) as RequestHandler,
  };
}

export function storeController(service: StoreService) {
  const user = (req: { auth?: { userId: string } }) => req.auth?.userId ?? "";
  return {
    view: (async (req, res) => ok(res, await service.view(req.auth?.userId ?? null))) as RequestHandler,
    buy: (async (req, res) => ok(res, await service.buy(user(req), validatedBody<StoreItemBody>(req).itemId))) as RequestHandler,
    equip: (async (req, res) => {
      const { itemId, on } = validatedBody<EquipBody>(req);
      ok(res, await service.equip(user(req), itemId, on));
    }) as RequestHandler,
  };
}

export function roadmapController(service: RoadmapService) {
  const user = (req: { auth?: { userId: string } }) => req.auth?.userId ?? "";
  return {
    list: ((_req, res) => ok(res, service.list())) as RequestHandler,
    /** null data = hasn't done the welcome quiz yet. */
    onboarding: (async (req, res) => ok(res, await service.onboarding(user(req)))) as RequestHandler,
    saveOnboarding: (async (req, res) => ok(res, await service.saveOnboarding(user(req), validatedBody<OnboardingBody>(req)))) as RequestHandler,
    view: (async (req, res) => ok(res, await service.view(validatedParams<RoadmapParams>(req).id, req.auth?.userId ?? null))) as RequestHandler,
    read: (async (req, res) => {
      const { nodeId, read } = validatedBody<RoadmapReadBody>(req);
      ok(res, await service.setRead(user(req), validatedParams<RoadmapParams>(req).id, nodeId, read));
    }) as RequestHandler,
  };
}
