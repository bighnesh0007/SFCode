import type { RequestHandler } from "express";
import { validatedBody, validatedQuery } from "../middleware/validate.ts";
import type { AdminService } from "../services/admin/admin.service.ts";
import { noContent, ok } from "../utils/respond.ts";
import type { AdminUsersQuery, RoleBody } from "../validation/admin.schema.ts";

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
  return { me, overview, users, grant, revoke };
}
