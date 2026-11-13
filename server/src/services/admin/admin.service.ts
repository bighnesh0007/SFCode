/**
 * Staff roles and the admin page. Every method takes the acting user and
 * checks authorisation itself, so no route can forget to.
 *
 * Owner (SUPER_ADMIN_USER_ID, config) > admin (at most MAX_ADMINS) >
 * reviewer > buddy.
 * - the owner grants or revokes admins;
 * - admins grant or revoke reviewers;
 * - reviewers and admins grant or revoke buddies.
 * Rows written before the rename say "moderator"; they read as reviewer.
 */
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors/AppError.ts";
import { ErrorCode } from "../../errors/codes.ts";
import { logEvent } from "../../lib/logger.ts";
import type { AdminRepository, AdminUserRow, StaffRole } from "../../repositories/admin.repository.ts";
import type { Clock } from "../../types/ports.ts";

export type Standing = "owner" | "admin" | "reviewer" | "buddy" | null;
type Rank = Exclude<Standing, null>;
const RANK: Record<Rank, number> = { buddy: 1, reviewer: 2, admin: 3, owner: 4 };
/** Who may grant or revoke each role. */
const GRANTED_BY: Record<StaffRole, Rank> = { admin: "owner", reviewer: "admin", buddy: "reviewer" };
export const MAX_ADMINS = 2;

export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly ownerId: string | undefined,
    private readonly clock: Clock,
  ) {}

  async standing(userId: string): Promise<Standing> {
    if (this.ownerId && userId === this.ownerId) return "owner";
    const roles = await this.repo.rolesOf(userId);
    if (roles.includes("admin")) return "admin";
    if (roles.includes("reviewer") || roles.includes("moderator")) return "reviewer";
    return roles.includes("buddy") ? "buddy" : null;
  }

  /** Throws 403 unless the actor is at least `minimum`. Returns their standing. */
  async require(actor: string, minimum: Rank): Promise<Rank> {
    const s = await this.standing(actor);
    if (s === null || RANK[s] < RANK[minimum]) throw new ForbiddenError("Admin access required.", ErrorCode.ADMIN_REQUIRED);
    return s;
  }

  async overview(actor: string) {
    await this.require(actor, "reviewer");
    return this.repo.overview(new Date(this.clock.nowMs() - 86_400_000));
  }

  async users(actor: string, query: string): Promise<(Omit<AdminUserRow, "joined"> & { joined: string; owner: boolean })[]> {
    await this.require(actor, "reviewer");
    const rows = await this.repo.users(query, 50);
    return rows.map((r) => ({ ...r, joined: r.joined.toISOString(), owner: r.userId === this.ownerId }));
  }

  async grant(actor: string, target: string, role: StaffRole): Promise<void> {
    await this.require(actor, GRANTED_BY[role]);
    if (target === this.ownerId) throw new ConflictError("The owner already has every permission.");
    if (!(await this.repo.profileExists(target))) throw new NotFoundError("No learner with that id.");
    if (role === "admin" && !(await this.repo.rolesOf(target)).includes("admin") && (await this.repo.countRole("admin")) >= MAX_ADMINS) {
      throw new ConflictError(`There can be at most ${MAX_ADMINS} admins. Remove one first.`);
    }
    await this.repo.grant(target, role, actor);
    logEvent("admin.role_granted", { target, role, by: actor });
  }

  async revoke(actor: string, target: string, role: StaffRole): Promise<void> {
    await this.require(actor, GRANTED_BY[role]);
    // Pre-rename rows say "moderator"; revoking reviewer removes either spelling.
    const removed = await this.repo.revoke(target, role);
    const legacy = role === "reviewer" ? await this.repo.revoke(target, "moderator") : false;
    if (!removed && !legacy) throw new NotFoundError("That user doesn't have that role.");
    logEvent("admin.role_revoked", { target, role, by: actor });
  }
}
