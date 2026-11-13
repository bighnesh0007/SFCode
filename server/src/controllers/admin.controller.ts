import type { RequestHandler } from "express";
import { validatedBody, validatedParams, validatedQuery } from "../middleware/validate.ts";
import type { AdminService } from "../services/admin/admin.service.ts";
import { noContent, ok } from "../utils/respond.ts";
import type { AdminUsersQuery, AnnouncementBody, RoleBody, SuspendBody, UserIdParams } from "../validation/admin.schema.ts";

export function adminController(service: AdminService) {
  const actor = (req: { auth?: { userId: string } }) => req.auth?.userId ?? "";
  const me: RequestHandler = async (req, res) => ok(res, { standing: await service.require(actor(req), "buddy") });
  const overview: RequestHandler = async (req, res) => ok(res, await service.overview(actor(req)));
  const users: RequestHandler = async (req, res) => ok(res, await service.users(actor(req), validatedQuery<AdminUsersQuery>(req).q));
  const grant: RequestHandler = async (req, res) => {
    const { userId, role } = validatedBody<RoleBody>(req);
    await service.grant(actor(req), userId, role);
    noContent(res);
  };
  const revoke: RequestHandler = async (req, res) => {
    const { userId, role } = validatedBody<RoleBody>(req);
    await service.revoke(actor(req), userId, role);
    noContent(res);
  };
  const dashboard: RequestHandler = async (req, res) => ok(res, await service.dashboard(actor(req)));
  const user: RequestHandler = async (req, res) => ok(res, await service.user(actor(req), validatedParams<UserIdParams>(req).userId));
  const suspend: RequestHandler = async (req, res) => {
    const { suspended, reason } = validatedBody<SuspendBody>(req);
    await service.setSuspended(actor(req), validatedParams<UserIdParams>(req).userId, suspended, reason);
    noContent(res);
  };
  const audit: RequestHandler = async (req, res) => ok(res, await service.auditLog(actor(req)));
  const announcement: RequestHandler = async (_req, res) => ok(res, { announcement: await service.announcement() });
  const setAnnouncement: RequestHandler = async (req, res) =>
    ok(res, { announcement: await service.setAnnouncement(actor(req), validatedBody<AnnouncementBody>(req).announcement) });
  return { me, overview, users, grant, revoke, dashboard, user, suspend, audit, announcement, setAnnouncement };
}
