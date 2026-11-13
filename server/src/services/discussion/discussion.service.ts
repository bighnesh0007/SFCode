/**
 * Discussion under each problem. Anyone reads; signed-in learners post.
 * Authors delete their own comments; buddies and up hide anyone's (kept, out of view).
 */
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../errors/AppError.ts";
import type { DiscussionComment, DiscussionRepository } from "../../repositories/discussion.repository.ts";
import type { ProfileRecord, ProfileRepository } from "../../repositories/profile.repository.ts";
import type { Clock } from "../../types/ports.ts";
import type { AdminService } from "../admin/admin.service.ts";
import type { ChallengeCatalog } from "../challenges/catalog.ts";
import type { CommunityService } from "../community/community.service.ts";

export const MAX_COMMENT_CHARS = 4000;
/** A cap on top of the per-minute rate limit, so one account can't flood the threads. */
export const MAX_COMMENTS_PER_DAY = 30;

export interface DiscussionAuthor {
  handle: string;
  displayName: string;
  imageUrl: string | null;
}

export interface DiscussionView {
  id: string;
  body: string;
  spoiler: boolean;
  hidden: boolean;
  author: DiscussionAuthor;
  createdAt: string;
  canDelete: boolean;
  canHide: boolean;
}

const UNKNOWN: DiscussionAuthor = { handle: "unknown", displayName: "Former learner", imageUrl: null };

export class DiscussionService {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly catalog: ChallengeCatalog,
    private readonly profiles: ProfileRepository,
    private readonly community: CommunityService,
    private readonly admin: AdminService,
    private readonly clock: Clock,
  ) {}

  private async isModerator(userId: string | null): Promise<boolean> {
    return userId !== null && (await this.admin.standing(userId)) !== null;
  }

  private mustExist(slug: string): void {
    if (!this.catalog.get(slug)) throw new NotFoundError("Problem not found.");
  }

  private async authors(ids: string[]): Promise<Map<string, ProfileRecord>> {
    return new Map((await this.profiles.findByUsers([...new Set(ids)])).map((p) => [p.userId, p]));
  }

  private view(c: DiscussionComment, authors: Map<string, ProfileRecord>, viewer: string | null, moderator: boolean): DiscussionView {
    const p = authors.get(c.authorId);
    return {
      id: c.id,
      body: c.body,
      spoiler: c.spoiler,
      hidden: c.status === "hidden",
      author: p ? { handle: p.handle, displayName: p.displayName, imageUrl: p.imageUrl } : UNKNOWN,
      createdAt: c.createdAt.toISOString(),
      canDelete: viewer !== null && viewer === c.authorId,
      canHide: moderator,
    };
  }

  /** Oldest first, like a conversation. Hidden comments only reach moderators. */
  async list(slug: string, viewer: string | null): Promise<DiscussionView[]> {
    this.mustExist(slug);
    const moderator = await this.isModerator(viewer);
    const rows = await this.repo.list(slug, moderator);
    const authors = await this.authors(rows.map((r) => r.authorId));
    return rows.map((r) => this.view(r, authors, viewer, moderator));
  }

  async post(userId: string, slug: string, body: string, spoiler: boolean): Promise<DiscussionView[]> {
    this.mustExist(slug);
    const text = body.trim();
    if (text.length < 2 || text.length > MAX_COMMENT_CHARS) throw new ValidationError(`A comment is 2–${MAX_COMMENT_CHARS} characters.`);
    if ((await this.repo.countSince(userId, new Date(this.clock.nowMs() - 86_400_000))) >= MAX_COMMENTS_PER_DAY) {
      throw new ConflictError(`You can post ${MAX_COMMENTS_PER_DAY} comments a day. Try again tomorrow.`);
    }
    await this.community.ensureProfile(userId);
    await this.repo.add({ problemSlug: slug, authorId: userId, body: text, spoiler });
    return this.list(slug, userId);
  }

  /** Authors delete their own comment for good. */
  async remove(userId: string, id: string): Promise<void> {
    const c = await this.repo.find(id);
    if (!c) throw new NotFoundError("Comment not found.");
    if (c.authorId !== userId) throw new ForbiddenError("You can only delete your own comments.");
    await this.repo.delete(id);
  }

  /** Buddies and up hide or restore any comment. */
  async setHidden(userId: string, id: string, hidden: boolean): Promise<void> {
    await this.admin.require(userId, "buddy");
    const c = await this.repo.find(id);
    if (!c) throw new NotFoundError("Comment not found.");
    await this.repo.setStatus(id, hidden ? "hidden" : "published");
  }

  /** Newest comments across all problems, hidden ones included, for the moderation tab. */
  async recent(userId: string): Promise<(DiscussionView & { problem: { slug: string; title: string; track: string } })[]> {
    await this.admin.require(userId, "buddy");
    const rows = await this.repo.recent(100);
    const authors = await this.authors(rows.map((r) => r.authorId));
    return rows.map((r) => {
      const ch = this.catalog.get(r.problemSlug);
      return { ...this.view(r, authors, userId, true), problem: { slug: r.problemSlug, title: ch?.title ?? r.problemSlug, track: ch?.track ?? "apex" } };
    });
  }

  counts(slugs: string[]): Promise<Map<string, number>> {
    return this.repo.counts(slugs);
  }
}
