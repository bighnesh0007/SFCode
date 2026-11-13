/**
 * Teams (private leaderboards joined by code), mentors (Ranger and up offer
 * help; requests arrive as in-app notifications), and the job corner
 * (admin-posted roles plus learners open to work).
 */
import { randomBytes } from "node:crypto";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../errors/AppError.ts";
import type { ProfileRecord, ProfileRepository } from "../../repositories/profile.repository.ts";
import type { PgHubRepository } from "../../repositories/hub.repository.ts";
import type { Clock } from "../../types/ports.ts";
import type { AdminService } from "../admin/admin.service.ts";
import type { CommunityService } from "../community/community.service.ts";
import type { SocialService } from "../social/social.service.ts";

export const MAX_OWNED_TEAMS = 3;
export const MAX_TEAM_SIZE = 200;
/** Rank level needed to be listed as a mentor (2 = Ranger). */
export const MENTOR_MIN_LEVEL = 2;
const MENTOR_TOPICS = ["Apex", "SOQL", "Triggers", "Flows", "LWC", "Testing", "Async Apex", "Integration", "Admin", "Certification", "Career"] as const;
export { MENTOR_TOPICS };

const code = () => randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 8).toUpperCase();
const slugify = (name: string) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "team"}-${randomBytes(2).toString("hex")}`;

export class HubService {
  constructor(
    private readonly repo: PgHubRepository,
    private readonly profiles: ProfileRepository,
    private readonly community: CommunityService,
    private readonly admin: AdminService,
    private readonly social: SocialService | undefined,
    private readonly clock: Clock,
  ) {}

  private async people(ids: string[]): Promise<Map<string, ProfileRecord>> {
    return new Map((await this.profiles.findByUsers(ids)).map((p) => [p.userId, p]));
  }

  // ── teams ──
  async createTeam(actor: string, name: string) {
    const clean = name.trim();
    if (clean.length < 3 || clean.length > 60) throw new BadRequestError("Team names are 3–60 characters.");
    await this.community.ensureProfile(actor);
    if ((await this.repo.ownedCount(actor)) >= MAX_OWNED_TEAMS) throw new ConflictError(`You can own up to ${MAX_OWNED_TEAMS} teams.`);
    const t = await this.repo.createTeam({ slug: slugify(clean), name: clean, joinCode: code(), ownerId: actor });
    if (!t) throw new ConflictError("Couldn't create the team; try again.");
    return this.team(actor, t.slug);
  }

  async myTeams(actor: string) {
    return (await this.repo.teamsOf(actor)).map((t) => ({ slug: t.slug, name: t.name, members: t.members, owner: t.ownerId === actor }));
  }

  async join(actor: string, joinCode: string) {
    const t = await this.repo.teamByCode(joinCode.trim().toUpperCase());
    if (!t) throw new NotFoundError("No team with that code.");
    if ((await this.repo.members(t.id)).length >= MAX_TEAM_SIZE) throw new ConflictError("That team is full.");
    const me = await this.community.ensureProfile(actor);
    if (await this.repo.addMember(t.id, actor)) {
      void this.social?.notify(t.ownerId, "team", { team: t.name, slug: t.slug, handle: me.handle }).catch(() => undefined);
    }
    return this.team(actor, t.slug);
  }

  /** The private leaderboard: members only. */
  async team(actor: string, slug: string) {
    const t = await this.repo.teamBySlug(slug);
    if (!t) throw new NotFoundError("No such team.");
    const memberIds = await this.repo.members(t.id);
    if (!memberIds.includes(actor)) throw new ForbiddenError("Join this team with its code to see it.");
    const profiles = await this.people(memberIds);
    const rows = await Promise.all(
      memberIds.map(async (id) => {
        const tier = await this.community.myTier(id);
        const p = profiles.get(id);
        return { handle: p?.handle ?? "?", displayName: p?.displayName ?? "Learner", imageUrl: p?.imageUrl ?? null, points: tier.points, tier: { id: tier.id, title: tier.title }, owner: id === t.ownerId, me: id === actor };
      }),
    );
    rows.sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName));
    const isOwner = t.ownerId === actor;
    return { slug: t.slug, name: t.name, owner: isOwner, joinCode: isOwner ? t.joinCode : null, members: rows.map((r, i) => ({ ...r, place: i + 1 })) };
  }

  private async owned(actor: string, slug: string) {
    const t = await this.repo.teamBySlug(slug);
    if (!t) throw new NotFoundError("No such team.");
    if (t.ownerId !== actor) throw new ForbiddenError("Only the team owner can do that.");
    return t;
  }

  async rotateCode(actor: string, slug: string) {
    const t = await this.owned(actor, slug);
    await this.repo.setJoinCode(t.id, code());
    return this.team(actor, slug);
  }

  async leave(actor: string, slug: string): Promise<void> {
    const t = await this.repo.teamBySlug(slug);
    if (!t) throw new NotFoundError("No such team.");
    if (t.ownerId === actor) {
      await this.repo.deleteTeam(t.id); // the owner leaving closes the team
      return;
    }
    await this.repo.removeMember(t.id, actor);
  }

  async removeMember(actor: string, slug: string, handle: string) {
    const t = await this.owned(actor, slug);
    const p = await this.profiles.findByHandle(handle);
    if (!p || p.userId === actor) throw new BadRequestError("Can't remove that member.");
    await this.repo.removeMember(t.id, p.userId);
    return this.team(actor, slug);
  }

  // ── mentors ──
  async mentors() {
    const list = await this.repo.activeMentors();
    const profiles = await this.people(list.map((m) => m.userId));
    return Promise.all(
      list.flatMap((m) => {
        const p = profiles.get(m.userId);
        if (!p) return [];
        return [this.community.myTier(m.userId).then((tier) => ({ handle: p.handle, displayName: p.displayName, imageUrl: p.imageUrl, tier: { id: tier.id, title: tier.title }, topics: m.topics, note: m.note }))];
      }),
    );
  }

  async myMentor(actor: string) {
    const [m, tier] = await Promise.all([this.repo.mentor(actor), this.community.myTier(actor)]);
    return { eligible: tier.level >= MENTOR_MIN_LEVEL, rank: tier.title, topics: m?.topics ?? [], note: m?.note ?? "", active: m?.active ?? false };
  }

  async setMentor(actor: string, input: { topics: string[]; note: string; active: boolean }) {
    if (input.active && (await this.community.myTier(actor)).level < MENTOR_MIN_LEVEL) throw new ForbiddenError("Reach Ranger rank to mentor others.");
    if (input.active && input.topics.length === 0) throw new BadRequestError("Pick at least one topic.");
    await this.community.ensureProfile(actor);
    await this.repo.saveMentor({ userId: actor, topics: [...new Set(input.topics)], note: input.note.trim(), active: input.active });
    return this.myMentor(actor);
  }

  /** A learner asks a mentor for help: delivered as an in-app notification (no email budget used). */
  async ask(actor: string, handle: string, message: string): Promise<void> {
    const p = await this.profiles.findByHandle(handle);
    const m = p ? await this.repo.mentor(p.userId) : null;
    if (!p || !m?.active) throw new NotFoundError("That mentor isn't available.");
    if (p.userId === actor) throw new BadRequestError("You can't ask yourself.");
    const text = message.trim();
    if (text.length < 10) throw new BadRequestError("Say a little more about what you need (10+ characters).");
    const me = await this.community.ensureProfile(actor);
    await this.social?.notify(p.userId, "mentor", { handle: me.handle, displayName: me.displayName, message: text.slice(0, 500) });
  }

  // ── jobs ──
  async jobs() {
    const [open, ids] = await Promise.all([this.repo.openJobs(this.clock.now()), this.repo.openToWork()]);
    const profiles = await this.people(ids);
    return {
      jobs: open.map((j) => ({ id: j.id, title: j.title, company: j.company, location: j.location, url: j.url, tags: j.tags, postedAt: j.createdAt.toISOString(), expiresAt: j.expiresAt.toISOString() })),
      openToWork: [...profiles.values()].map((p) => ({ handle: p.handle, displayName: p.displayName, imageUrl: p.imageUrl })),
    };
  }

  async postJob(actor: string, j: { title: string; company: string; location: string; url: string; tags: string[]; days: number }) {
    await this.admin.require(actor, "admin");
    await this.repo.createJob({ title: j.title.trim(), company: j.company.trim(), location: j.location.trim(), url: j.url, tags: j.tags, postedBy: actor, expiresAt: new Date(this.clock.nowMs() + j.days * 86_400_000) });
    return this.jobs();
  }

  async removeJob(actor: string, id: string) {
    await this.admin.require(actor, "admin");
    if (!(await this.repo.deleteJob(id))) throw new NotFoundError("No such job.");
    return this.jobs();
  }
}
