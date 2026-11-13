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
import type { AdminRepository, AdminUserRow, AuditRow, ProblemStat, StaffRole, UserDetail } from "../../repositories/admin.repository.ts";
import type { SettingsRepository } from "../../repositories/settings.repository.ts";
import type { Clock } from "../../types/ports.ts";

export type Standing = "owner" | "admin" | "reviewer" | "buddy" | null;
type Rank = Exclude<Standing, null>;
const RANK: Record<Rank, number> = { buddy: 1, reviewer: 2, admin: 3, owner: 4 };
/** Who may grant or revoke each role. */
const GRANTED_BY: Record<StaffRole, Rank> = { admin: "owner", reviewer: "admin", buddy: "reviewer" };
export const MAX_ADMINS = 2;
export const DASHBOARD_DAYS = 30;
/** Problems need this many graded submissions before their acceptance rate means anything. */
export const MIN_ATTEMPTS_FOR_RATE = 5;
const ANNOUNCEMENT_KEY = "announcement";

/** Blocks or restores sign-in at the identity provider (Clerk). */
export interface AccountModeration {
  ban(userId: string): Promise<void>;
  unban(userId: string): Promise<void>;
  isBanned(userId: string): Promise<boolean | null>;
}

export interface Announcement {
  text: string;
  tone: "info" | "warning" | "success";
  /** Stable id, so a dismissed banner stays dismissed until the text changes. */
  id: string;
  updatedAt: string;
}

export interface ProblemRow extends ProblemStat {
  title: string;
  /** 0-100, or null below MIN_ATTEMPTS_FOR_RATE. */
  rate: number | null;
}

export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly ownerId: string | undefined,
    private readonly clock: Clock,
    private readonly settings?: SettingsRepository,
    private readonly moderation?: AccountModeration,
  ) {}

  private titleOf: (slug: string) => string = (slug) => slug;
  /** Set after the catalog loads, so the dashboard can show titles instead of slugs. */
  setProblemTitles(fn: (slug: string) => string | undefined) {
    this.titleOf = (slug) => fn(slug) ?? slug;
  }

  /** Append to the audit log. Never throws: a failed audit write mustn't undo the action it records. */
  async record(actorId: string, action: string, targetId: string | null, detail: Record<string, unknown> = {}): Promise<void> {
    try {
      await this.repo.audit({ actorId, action, targetId, detail });
    } catch {
      logEvent("admin.audit_failed", { action });
    }
  }

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
    await this.record(actor, "role.grant", target, { role });
  }

  async revoke(actor: string, target: string, role: StaffRole): Promise<void> {
    await this.require(actor, GRANTED_BY[role]);
    // Pre-rename rows say "moderator"; revoking reviewer removes either spelling.
    const removed = await this.repo.revoke(target, role);
    const legacy = role === "reviewer" ? await this.repo.revoke(target, "moderator") : false;
    if (!removed && !legacy) throw new NotFoundError("That user doesn't have that role.");
    logEvent("admin.role_revoked", { target, role, by: actor });
    await this.record(actor, "role.revoke", target, { role });
  }

  async dashboard(actor: string): Promise<{ days: Awaited<ReturnType<AdminRepository["dashboard"]>>["days"]; top: ProblemRow[]; hardest: ProblemRow[] }> {
    await this.require(actor, "reviewer");
    const since = new Date(this.clock.nowMs() - (DASHBOARD_DAYS - 1) * 86_400_000);
    const { days, problems } = await this.repo.dashboard(since);
    const rows: ProblemRow[] = problems.map((p) => ({
      ...p,
      title: this.titleOf(p.slug),
      rate: p.submissions >= MIN_ATTEMPTS_FOR_RATE ? Math.round((100 * p.accepted) / p.submissions) : null,
    }));
    const top = [...rows].sort((a, b) => b.submissions - a.submissions).slice(0, 8);
    const hardest = rows
      .filter((r) => r.rate !== null)
      .sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0) || b.submissions - a.submissions)
      .slice(0, 8);
    return { days, top, hardest };
  }

  async user(actor: string, target: string): Promise<Omit<UserDetail, "joined" | "lastActive" | "org" | "recent"> & {
    joined: string;
    lastActive: string | null;
    org: { username: string; connectedAt: string } | null;
    recent: { slug: string; title: string; status: string; at: string }[];
    owner: boolean;
    suspended: boolean | null;
  }> {
    await this.require(actor, "reviewer");
    const d = await this.repo.userDetail(target);
    if (!d) throw new NotFoundError("No learner with that id.");
    return {
      ...d,
      joined: d.joined.toISOString(),
      lastActive: d.lastActive?.toISOString() ?? null,
      org: d.org ? { username: d.org.username, connectedAt: d.org.connectedAt.toISOString() } : null,
      recent: d.recent.map((r) => ({ slug: r.slug, title: this.titleOf(r.slug), status: r.status, at: r.at.toISOString() })),
      owner: target === this.ownerId,
      suspended: this.moderation ? await this.moderation.isBanned(target) : null,
    };
  }

  /**
   * Suspend (ban at Clerk: signs them out everywhere and blocks sign-in) or
   * restore a user. Admins only; nobody suspends themselves or the owner, and
   * only the owner can suspend an admin.
   */
  async setSuspended(actor: string, target: string, suspended: boolean, reason: string): Promise<void> {
    const standing = await this.require(actor, "admin");
    if (!this.moderation) throw new ConflictError("Suspending needs Clerk (CLERK_SECRET_KEY).");
    if (target === actor) throw new ConflictError("You can't suspend yourself.");
    if (target === this.ownerId) throw new ForbiddenError("The owner can't be suspended.", ErrorCode.ADMIN_REQUIRED);
    if (standing !== "owner" && (await this.standing(target)) === "admin") throw new ForbiddenError("Only the owner can suspend an admin.", ErrorCode.ADMIN_REQUIRED);
    if (!(await this.repo.profileExists(target))) throw new NotFoundError("No learner with that id.");
    if (suspended) await this.moderation.ban(target);
    else await this.moderation.unban(target);
    logEvent(suspended ? "admin.user_suspended" : "admin.user_restored", { target, by: actor });
    await this.record(actor, suspended ? "user.suspend" : "user.restore", target, reason ? { reason } : {});
  }

  async auditLog(actor: string): Promise<(Omit<AuditRow, "at"> & { at: string })[]> {
    await this.require(actor, "admin");
    return (await this.repo.auditLog(200)).map((r) => ({ ...r, at: r.at.toISOString() }));
  }

  /** The site-wide banner, or null. Public. */
  async announcement(): Promise<Announcement | null> {
    if (!this.settings) return null;
    const v = (await this.settings.get(ANNOUNCEMENT_KEY)) as Announcement | null;
    return v?.text ? v : null;
  }

  async setAnnouncement(actor: string, value: { text: string; tone: Announcement["tone"] } | null): Promise<Announcement | null> {
    await this.require(actor, "admin");
    if (!this.settings) throw new ConflictError("Announcements need the database.");
    const next: Announcement | null = value?.text.trim()
      ? { text: value.text.trim(), tone: value.tone, id: this.clock.nowMs().toString(36), updatedAt: new Date(this.clock.nowMs()).toISOString() }
      : null;
    await this.settings.set(ANNOUNCEMENT_KEY, next ?? {}, actor);
    await this.record(actor, next ? "announcement.set" : "announcement.clear", null, next ? { text: next.text, tone: next.tone } : {});
    return next;
  }
}
