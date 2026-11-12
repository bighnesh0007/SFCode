/**
 * Staff roles and the admin page. Every method takes the acting user and
 * checks authorisation itself, so no route can forget to.
 *
 * Owner (SUPER_ADMIN_USER_ID, config) > admin > moderator.
 * Only the owner grants or revokes admin; admins manage moderators.
 */
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors/AppError.ts";
import { ErrorCode } from "../../errors/codes.ts";
import { logEvent } from "../../lib/logger.ts";
import type { AdminRepository, AdminUserRow, StaffRole } from "../../repositories/admin.repository.ts";
import type { Clock } from "../../types/ports.ts";

export type Standing = "owner" | StaffRole | null;
const RANK: Record<Exclude<Standing, null>, number> = { moderator: 1, admin: 2, owner: 3 };

export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly ownerId: string | undefined,
    private readonly clock: Clock,
  ) {}

  async standing(userId: string): Promise<Standing> {
    if (this.ownerId && userId === this.ownerId) return "owner";
    const roles = await this.repo.rolesOf(userId);
    return roles.includes("admin") ? "admin" : roles.includes("moderator") ? "moderator" : null;
  }

  /** Throws 403 unless the actor is at least `minimum`. Returns their standing. */
  async require(actor: string, minimum: Exclude<Standing, null>): Promise<Exclude<Standing, null>> {
    const s = await this.standing(actor);
    if (s === null || RANK[s] < RANK[minimum]) throw new ForbiddenError("Admin access required.", ErrorCode.ADMIN_REQUIRED);
    return s;
  }

  async overview(actor: string) {
    await this.require(actor, "moderator");
    return this.repo.overview(new Date(this.clock.nowMs() - 86_400_000));
  }

  async users(actor: string, query: string): Promise<(Omit<AdminUserRow, "joined"> & { joined: string; owner: boolean })[]> {
    await this.require(actor, "moderator");
    const rows = await this.repo.users(query, 50);
    return rows.map((r) => ({ ...r, joined: r.joined.toISOString(), owner: r.userId === this.ownerId }));
  }

  async grant(actor: string, target: string, role: StaffRole): Promise<void> {
    await this.require(actor, role === "admin" ? "owner" : "admin");
    if (target === this.ownerId) throw new ConflictError("The owner already has every permission.");
    if (!(await this.repo.profileExists(target))) throw new NotFoundError("No learner with that id.");
    await this.repo.grant(target, role, actor);
    logEvent("admin.role_granted", { target, role, by: actor });
  }

  async revoke(actor: string, target: string, role: StaffRole): Promise<void> {
    await this.require(actor, role === "admin" ? "owner" : "admin");
    if (!(await this.repo.revoke(target, role))) throw new NotFoundError("That user doesn't have that role.");
    logEvent("admin.role_revoked", { target, role, by: actor });
  }
}
