import type { RequestHandler } from "express";
import { validatedBody, validatedParams, validatedQuery } from "../middleware/validate.ts";
import type { CommunityService } from "../services/community/community.service.ts";
import { ok } from "../utils/respond.ts";
import type { AboutBody, HandleParams, LeaderboardQuery, ProfileUpdateBody } from "../validation/community.schema.ts";

export function communityController(service: CommunityService) {
  const me: RequestHandler = async (req, res) => ok(res, await service.me(req.auth?.userId ?? ""));
  const updateMe: RequestHandler = async (req, res) => {
    const { handle, displayName } = validatedBody<ProfileUpdateBody>(req);
    ok(res, await service.updateProfile(req.auth?.userId ?? "", { ...(handle !== undefined ? { handle } : {}), ...(displayName !== undefined ? { displayName } : {}) }));
  };
  const byHandle: RequestHandler = async (req, res) => ok(res, await service.byHandle(validatedParams<HandleParams>(req).handle));
  const leaderboard: RequestHandler = async (req, res) => {
    const q = validatedQuery<LeaderboardQuery>(req);
    ok(res, await service.leaderboard(q.window, 100, q.track, q.country));
  };
  const updateAbout: RequestHandler = async (req, res) => {
    const b = validatedBody<AboutBody>(req);
    ok(res, await service.updateAbout(req.auth?.userId ?? "", { ...b, trailheadUrl: b.trailheadUrl || null, linkedinUrl: b.linkedinUrl || null, githubUrl: b.githubUrl || null }));
  };
  return { me, updateMe, updateAbout, byHandle, leaderboard };
}
