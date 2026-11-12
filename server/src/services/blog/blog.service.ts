/**
 * Community blog. Permissions:
 * - anyone reads published posts and comments
 * - signed-in users write posts and comments, and vote (not on their own posts)
 * - authors edit their posts and delete their own posts and comments
 * - moderators and up hide any post or comment (kept, never listed) and can see hidden ones
 */
import { randomBytes } from "node:crypto";
import { ForbiddenError, NotFoundError, ValidationError } from "../../errors/AppError.ts";
import type { BlogRepository, CommentRecord, PostRecord } from "../../repositories/blog.repository.ts";
import type { ProfileRecord, ProfileRepository } from "../../repositories/profile.repository.ts";
import type { AdminService } from "../admin/admin.service.ts";
import type { CommunityService } from "../community/community.service.ts";

export const LIMITS = { title: [5, 120], body: [20, 20_000], comment: [1, 2_000] } as const;

export interface Author {
  handle: string;
  displayName: string;
  imageUrl: string | null;
}

export interface PostSummary {
  slug: string;
  title: string;
  excerpt: string;
  author: Author;
  score: number;
  commentCount: number;
  createdAt: string;
}

export interface PostView extends PostSummary {
  body: string;
  status: "published" | "hidden";
  updatedAt: string;
  myVote: number;
  canEdit: boolean;
  canModerate: boolean;
  comments: { id: string; body: string; author: Author; createdAt: string; hidden: boolean; canDelete: boolean }[];
}

const UNKNOWN: Author = { handle: "deleted", displayName: "Deleted user", imageUrl: null };

/** Plain-text preview: drops Markdown syntax well enough for a teaser. */
function excerpt(md: string): string {
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 200 ? `${text.slice(0, 197)}…` : text;
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "post"}-${randomBytes(3).toString("hex")}`;
}

function checkLength(what: keyof typeof LIMITS, value: string): string {
  const v = value.trim();
  const [min, max] = LIMITS[what];
  if (v.length < min || v.length > max) throw new ValidationError(`The ${what} must be ${min}–${max} characters.`);
  return v;
}

export class BlogService {
  constructor(
    private readonly repo: BlogRepository,
    private readonly profiles: ProfileRepository,
    private readonly community: CommunityService,
    private readonly admin: AdminService,
  ) {}

  async list(sort: "new" | "top"): Promise<PostSummary[]> {
    const posts = await this.repo.listPublished(sort, 50);
    const authors = await this.authors(posts.map((p) => p.authorId));
    return posts.map((p) => this.summary(p, authors));
  }

  async get(slug: string, viewerId: string | null): Promise<PostView> {
    const post = await this.repo.findBySlug(slug);
    const canModerate = viewerId ? await this.isModerator(viewerId) : false;
    if (!post || (post.status === "hidden" && !canModerate)) throw new NotFoundError("Post not found.");
    const comments = await this.repo.comments(post.id, canModerate);
    const authors = await this.authors([post.authorId, ...comments.map((c) => c.authorId)]);
    return {
      ...this.summary(post, authors),
      body: post.body,
      status: post.status,
      updatedAt: post.updatedAt.toISOString(),
      myVote: viewerId ? await this.repo.myVote(post.id, viewerId) : 0,
      canEdit: viewerId === post.authorId,
      canModerate,
      comments: comments.map((c: CommentRecord) => ({
        id: c.id,
        body: c.body,
        author: this.author(authors, c.authorId),
        createdAt: c.createdAt.toISOString(),
        hidden: c.status === "hidden",
        canDelete: viewerId === c.authorId || canModerate,
      })),
    };
  }

  async create(userId: string, input: { title: string; body: string }): Promise<PostView> {
    const title = checkLength("title", input.title);
    const body = checkLength("body", input.body);
    await this.community.ensureProfile(userId);
    for (let attempt = 0; attempt < 5; attempt++) {
      const post = await this.repo.create({ slug: slugify(title), authorId: userId, title, body });
      if (post) return this.get(post.slug, userId);
    }
    throw new Error("could not allocate a post slug");
  }

  async update(userId: string, slug: string, changes: { title?: string; body?: string }): Promise<PostView> {
    const post = await this.mustFind(slug);
    if (post.authorId !== userId) throw new ForbiddenError("Only the author can edit this post.");
    await this.repo.update(post.id, {
      ...(changes.title !== undefined ? { title: checkLength("title", changes.title) } : {}),
      ...(changes.body !== undefined ? { body: checkLength("body", changes.body) } : {}),
    });
    return this.get(slug, userId);
  }

  /** Authors delete their own post; moderators hide (or unhide) anyone's. */
  async remove(userId: string, slug: string): Promise<void> {
    const post = await this.mustFind(slug);
    if (post.authorId === userId) return this.repo.deletePost(post.id);
    if (!(await this.isModerator(userId))) throw new ForbiddenError("You can't remove this post.");
    await this.repo.setPostStatus(post.id, "hidden");
  }

  async setHidden(userId: string, slug: string, hidden: boolean): Promise<void> {
    const post = await this.repo.findBySlug(slug);
    if (!post) throw new NotFoundError("Post not found.");
    await this.admin.require(userId, "moderator");
    await this.repo.setPostStatus(post.id, hidden ? "hidden" : "published");
  }

  async vote(userId: string, slug: string, value: -1 | 0 | 1): Promise<{ score: number; myVote: number }> {
    const post = await this.mustFind(slug);
    if (post.authorId === userId) throw new ValidationError("You can't vote on your own post.");
    await this.repo.vote(post.id, userId, value);
    const after = await this.mustFind(slug);
    return { score: after.score, myVote: value };
  }

  async comment(userId: string, slug: string, body: string): Promise<PostView> {
    const post = await this.mustFind(slug);
    await this.community.ensureProfile(userId);
    await this.repo.addComment({ postId: post.id, authorId: userId, body: checkLength("comment", body) });
    return this.get(slug, userId);
  }

  async removeComment(userId: string, commentId: string): Promise<void> {
    const c = await this.repo.findComment(commentId);
    if (!c) throw new NotFoundError("Comment not found.");
    if (c.authorId === userId) return this.repo.deleteComment(c.id);
    if (!(await this.isModerator(userId))) throw new ForbiddenError("You can't remove this comment.");
    await this.repo.setCommentStatus(c.id, "hidden");
  }

  /** A published post; hidden ones are treated as absent for writes. */
  private async mustFind(slug: string): Promise<PostRecord> {
    const post = await this.repo.findBySlug(slug);
    if (post?.status !== "published") throw new NotFoundError("Post not found.");
    return post;
  }

  private async isModerator(userId: string): Promise<boolean> {
    return (await this.admin.standing(userId)) !== null;
  }

  private async authors(ids: string[]): Promise<Map<string, ProfileRecord>> {
    return new Map((await this.profiles.findByUsers([...new Set(ids)])).map((p) => [p.userId, p]));
  }

  private author(authors: Map<string, ProfileRecord>, id: string): Author {
    const p = authors.get(id);
    return p ? { handle: p.handle, displayName: p.displayName, imageUrl: p.imageUrl } : UNKNOWN;
  }

  private summary(p: PostRecord, authors: Map<string, ProfileRecord>): PostSummary {
    return {
      slug: p.slug,
      title: p.title,
      excerpt: excerpt(p.body),
      author: this.author(authors, p.authorId),
      score: p.score,
      commentCount: p.commentCount,
      createdAt: p.createdAt.toISOString(),
    };
  }
}
