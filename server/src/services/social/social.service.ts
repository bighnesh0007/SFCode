/**
 * Follows, the activity feed, and notifications.
 *
 * The feed is derived from data that already exists (first solves, rank-ups
 * computed from each person's solve history, published community problems,
 * blog posts), so there's no event log to keep in sync or backfill.
 */
import { BadRequestError, NotFoundError } from "../../errors/AppError.ts";
import { SCORED_TRACKS } from "../../domain/challenge.ts";
import { rankFor } from "../../domain/ranks.ts";
import type { NotificationKind } from "../../data/postgres/schema.ts";
import type { ChallengeSubmissionRepository } from "../../repositories/challengeSubmission.repository.ts";
import type { ProfileRecord, ProfileRepository } from "../../repositories/profile.repository.ts";
import type { SocialRepository } from "../../repositories/social.repository.ts";
import type { Clock } from "../../types/ports.ts";
import type { ChallengeCatalog } from "../challenges/catalog.ts";
import type { CommunityService } from "../community/community.service.ts";
import type { PointsService } from "../points/points.service.ts";

const FEED_DAYS = 14;
const FEED_LIMIT = 40;

export interface FeedActor {
  handle: string;
  displayName: string;
  imageUrl: string | null;
}

export type FeedItem =
  | { kind: "solve"; at: string; actor: FeedActor; problem: { slug: string; title: string; track: string; difficulty: string } }
  | { kind: "rank"; at: string; actor: FeedActor; rank: { id: string; title: string } }
  | { kind: "problem"; at: string; actor: FeedActor; problem: { slug: string; title: string; track: string; difficulty: string } }
  | { kind: "post"; at: string; actor: FeedActor; post: { slug: string; title: string } };

/** Sources the feed reads that live in other services. */
export interface FeedSources {
  communityProblems(): Promise<{ slug: string; title: string; track: string; difficulty: string; authorId: string; publishedAt: Date }[]>;
  posts(): Promise<{ slug: string; title: string; authorHandle: string; createdAt: string }[]>;
}

export class SocialService {
  private sources: FeedSources | undefined;

  constructor(
    private readonly repo: SocialRepository,
    private readonly profiles: ProfileRepository,
    private readonly community: CommunityService,
    private readonly submissions: ChallengeSubmissionRepository,
    private readonly catalog: ChallengeCatalog,
    private readonly points: PointsService,
    private readonly clock: Clock,
  ) {}

  setSources(sources: FeedSources): void {
    this.sources = sources;
  }

  private async byHandle(handle: string): Promise<ProfileRecord> {
    const p = await this.profiles.findByHandle(handle);
    if (!p) throw new NotFoundError("No learner with that handle.");
    return p;
  }

  async follow(actor: string, handle: string, on: boolean) {
    const target = await this.byHandle(handle);
    if (target.userId === actor) throw new BadRequestError("You can't follow yourself.");
    const me = await this.community.ensureProfile(actor);
    if (on) {
      if (await this.repo.follow(actor, target.userId)) await this.notify(target.userId, "follow", { handle: me.handle, displayName: me.displayName });
    } else {
      await this.repo.unfollow(actor, target.userId);
    }
    return this.socialFor(handle, actor);
  }

  async socialFor(handle: string, viewer: string | null) {
    const target = await this.byHandle(handle);
    const counts = await this.repo.counts(target.userId);
    return { ...counts, isFollowing: viewer ? await this.repo.isFollowing(viewer, target.userId) : false, isMe: viewer === target.userId };
  }

  /** "following": people you follow (plus you); "everyone": the whole community. */
  async feed(viewer: string | null, scope: "following" | "everyone"): Promise<FeedItem[]> {
    const since = new Date(this.clock.nowMs() - FEED_DAYS * 86_400_000);
    const ids = scope === "following" && viewer ? new Set([...(await this.repo.following(viewer)), viewer]) : null;
    const inScope = (id: string) => ids === null || ids.has(id);

    const recent = (await this.submissions.firstSolves(since)).filter((s) => inScope(s.userId));
    const actorIds = [...new Set(recent.map((s) => s.userId))];
    const problemsSrc = this.sources ? await this.sources.communityProblems() : [];
    const published = problemsSrc.filter((p) => p.publishedAt >= since && inScope(p.authorId));
    const profiles = new Map((await this.profiles.findByUsers([...new Set([...actorIds, ...published.map((p) => p.authorId)])])).map((p) => [p.userId, p]));
    const actor = (id: string): FeedActor | null => {
      const p = profiles.get(id);
      return p ? { handle: p.handle, displayName: p.displayName, imageUrl: p.imageUrl } : null;
    };

    const items: FeedItem[] = [];
    for (const s of recent) {
      const c = this.catalog.get(s.slug);
      const a = actor(s.userId);
      if (c && a) items.push({ kind: "solve", at: s.at.toISOString(), actor: a, problem: { slug: c.slug, title: c.title, track: c.track, difficulty: c.difficulty } });
    }

    // Rank-ups: walk each recent actor's full solve history and note when they crossed a rank.
    const table = await this.points.table();
    for (const id of actorIds) {
      const a = actor(id);
      if (!a) continue;
      let total = 0;
      let level = 0;
      for (const s of (await this.submissions.firstSolves(undefined, id)).sort((x, y) => x.at.getTime() - y.at.getTime())) {
        const c = this.catalog.get(s.slug);
        if (!c || !SCORED_TRACKS.includes(c.track)) continue;
        total += table.points(c.track, c.difficulty);
        const r = rankFor(total);
        if (r.level > level) {
          level = r.level;
          if (s.at >= since) items.push({ kind: "rank", at: s.at.toISOString(), actor: a, rank: { id: r.id, title: r.title } });
        }
      }
    }

    for (const p of published) {
      const a = actor(p.authorId);
      if (a) items.push({ kind: "problem", at: p.publishedAt.toISOString(), actor: a, problem: { slug: p.slug, title: p.title, track: p.track, difficulty: p.difficulty } });
    }

    if (this.sources) {
      const handles = ids === null ? null : new Set([...ids].map((id) => profiles.get(id)?.handle).filter(Boolean));
      if (ids !== null) {
        // Followed people without recent solves aren't in `profiles` yet.
        for (const p of await this.profiles.findByUsers([...ids])) handles?.add(p.handle);
      }
      const authorProfiles = new Map<string, ProfileRecord>();
      for (const post of await this.sources.posts()) {
        if (Date.parse(post.createdAt) < since.getTime() || (handles && !handles.has(post.authorHandle))) continue;
        let p = authorProfiles.get(post.authorHandle);
        if (!p) {
          p = (await this.profiles.findByHandle(post.authorHandle)) ?? undefined;
          if (p) authorProfiles.set(post.authorHandle, p);
        }
        if (p) items.push({ kind: "post", at: post.createdAt, actor: { handle: p.handle, displayName: p.displayName, imageUrl: p.imageUrl }, post: { slug: post.slug, title: post.title } });
      }
    }

    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, FEED_LIMIT);
  }

  async notify(userId: string, kind: NotificationKind, data: Record<string, string>): Promise<void> {
    await this.repo.notify(userId, kind, data);
  }

  async notifications(userId: string) {
    const [items, unread] = await Promise.all([this.repo.notificationsFor(userId, 30), this.repo.unreadCount(userId)]);
    return { unread, items: items.map((n) => ({ id: n.id, kind: n.kind, data: n.data, read: n.readAt !== null, at: n.createdAt.toISOString() })) };
  }

  async unread(userId: string): Promise<number> {
    return this.repo.unreadCount(userId);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.markAllRead(userId);
  }
}
