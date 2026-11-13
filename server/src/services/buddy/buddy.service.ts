/**
 * Becoming a Buddy: a signed-in learner applies; a reviewer or admin
 * approves (which grants the buddy role) or rejects with an optional note.
 */
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/AppError.ts";
import { logEvent } from "../../lib/logger.ts";
import type { BuddyApplication, BuddyRepository } from "../../repositories/buddy.repository.ts";
import type { ProfileRepository } from "../../repositories/profile.repository.ts";
import type { AdminService } from "../admin/admin.service.ts";
import type { CommunityService } from "../community/community.service.ts";

export interface MyContributorStatus {
  standing: "owner" | "admin" | "reviewer" | "buddy" | null;
  application: { status: BuddyApplication["status"]; createdAt: string; note: string | null } | null;
}

export type Notifier = (userId: string, kind: "review" | "buddy", data: Record<string, string>) => Promise<void>;

export class BuddyService {
  private notifier: Notifier | undefined;
  /** Wired after construction (the social service depends on profiles). Failures never block the action. */
  setNotifier(fn: Notifier): void {
    this.notifier = fn;
  }
  private tell(userId: string, kind: "review" | "buddy", data: Record<string, string>): void {
    void this.notifier?.(userId, kind, data).catch(() => undefined);
  }

  constructor(
    private readonly repo: BuddyRepository,
    private readonly admin: AdminService,
    private readonly community: CommunityService,
    private readonly profiles: ProfileRepository,
  ) {}

  async me(userId: string): Promise<MyContributorStatus> {
    const [standing, app] = await Promise.all([this.admin.standing(userId), this.repo.latestFor(userId)]);
    return { standing, application: app ? { status: app.status, createdAt: app.createdAt.toISOString(), note: app.note } : null };
  }

  async apply(userId: string, motivation: string, link: string): Promise<MyContributorStatus> {
    if ((await this.admin.standing(userId)) !== null) throw new BadRequestError("You already have a contributor role.");
    const text = motivation.trim();
    if (text.length < 30) throw new BadRequestError("Tell us a little more (at least 30 characters).");
    await this.community.ensureProfile(userId);
    if (!(await this.repo.create(userId, text, link || null))) throw new ConflictError("Your application is already waiting for review.");
    logEvent("buddy.applied", { userId });
    return this.me(userId);
  }

  async pending(actor: string) {
    await this.admin.require(actor, "reviewer");
    const apps = await this.repo.pending();
    const profiles = new Map((await this.profiles.findByUsers(apps.map((a) => a.userId))).map((p) => [p.userId, p]));
    return apps.map((a) => ({
      id: a.id,
      motivation: a.motivation,
      link: a.link,
      createdAt: a.createdAt.toISOString(),
      handle: profiles.get(a.userId)?.handle ?? null,
      displayName: profiles.get(a.userId)?.displayName ?? "Unknown",
    }));
  }

  async decide(actor: string, id: string, approve: boolean, note: string): Promise<void> {
    await this.admin.require(actor, "reviewer");
    const app = await this.repo.find(id);
    if (!app) throw new NotFoundError("No such application.");
    if (app.status !== "pending") throw new ConflictError("That application was already decided.");
    // Grant first: if it fails (e.g. the user was deleted), the application stays pending.
    if (approve) await this.admin.grant(actor, app.userId, "buddy");
    if (!(await this.repo.decide(id, approve ? "approved" : "rejected", actor, note.trim() || null))) throw new ConflictError("That application was already decided.");
    logEvent("buddy.decided", { id, approve, by: actor });
    this.tell(app.userId, "buddy", { approved: approve ? "yes" : "no", ...(note.trim() ? { note: note.trim().slice(0, 200) } : {}) });
  }
}
