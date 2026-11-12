/** Persistence for blog posts, votes and comments. */
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { blogComments, blogPosts, blogVotes } from "../data/postgres/schema.ts";

export type BlogStatus = "published" | "hidden";

export interface PostRecord {
  id: string;
  slug: string;
  authorId: string;
  title: string;
  body: string;
  status: BlogStatus;
  createdAt: Date;
  updatedAt: Date;
  score: number;
  commentCount: number;
}

export interface CommentRecord {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  status: BlogStatus;
  createdAt: Date;
}

export interface BlogRepository {
  listPublished(sort: "new" | "top", limit: number): Promise<PostRecord[]>;
  findBySlug(slug: string): Promise<PostRecord | null>;
  /** Returns null if the slug is taken. */
  create(p: { slug: string; authorId: string; title: string; body: string }): Promise<PostRecord | null>;
  update(id: string, changes: { title?: string; body?: string }): Promise<void>;
  setPostStatus(id: string, status: BlogStatus): Promise<void>;
  deletePost(id: string): Promise<void>;
  /** value 0 removes the vote. */
  vote(postId: string, userId: string, value: -1 | 0 | 1): Promise<void>;
  myVote(postId: string, userId: string): Promise<number>;
  comments(postId: string, includeHidden: boolean): Promise<CommentRecord[]>;
  addComment(c: { postId: string; authorId: string; body: string }): Promise<CommentRecord>;
  findComment(id: string): Promise<CommentRecord | null>;
  setCommentStatus(id: string, status: BlogStatus): Promise<void>;
  deleteComment(id: string): Promise<void>;
}

const isUniqueViolation = (err: unknown): boolean => {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
};

export class PgBlogRepository implements BlogRepository {
  constructor(private readonly db: PgDatabase) {}

  private readonly withCounts = {
    id: blogPosts.id,
    slug: blogPosts.slug,
    authorId: blogPosts.authorId,
    title: blogPosts.title,
    body: blogPosts.body,
    status: blogPosts.status,
    createdAt: blogPosts.createdAt,
    updatedAt: blogPosts.updatedAt,
    // Fully qualified on purpose. Drizzle renders column interpolations
    // unqualified ("id"), and inside a subquery over blog_comments — which has
    // its own id — "id" bound to the comment, so every count was 0.
    score: sql<number>`coalesce((select sum(v."value") from "blog_votes" v where v."post_id" = "blog_posts"."id"), 0)::int`,
    commentCount: sql<number>`(select count(*) from "blog_comments" c where c."post_id" = "blog_posts"."id" and c."status" = 'published')::int`,
  };

  async listPublished(sort: "new" | "top", limit: number): Promise<PostRecord[]> {
    return this.db
      .select(this.withCounts)
      .from(blogPosts)
      .where(eq(blogPosts.status, "published"))
      .orderBy(...(sort === "top" ? [desc(this.withCounts.score), desc(blogPosts.createdAt)] : [desc(blogPosts.createdAt)]))
      .limit(limit);
  }

  async findBySlug(slug: string): Promise<PostRecord | null> {
    const rows = await this.db.select(this.withCounts).from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
    return rows[0] ?? null;
  }

  async create(p: { slug: string; authorId: string; title: string; body: string }): Promise<PostRecord | null> {
    try {
      await this.db.insert(blogPosts).values({ slug: p.slug, authorId: p.authorId, title: p.title, body: p.body });
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
    return this.findBySlug(p.slug);
  }

  async update(id: string, changes: { title?: string; body?: string }): Promise<void> {
    await this.db
      .update(blogPosts)
      .set({ ...(changes.title !== undefined ? { title: changes.title } : {}), ...(changes.body !== undefined ? { body: changes.body } : {}), updatedAt: new Date() })
      .where(eq(blogPosts.id, id));
  }

  async setPostStatus(id: string, status: BlogStatus): Promise<void> {
    await this.db.update(blogPosts).set({ status }).where(eq(blogPosts.id, id));
  }

  async deletePost(id: string): Promise<void> {
    await this.db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  async vote(postId: string, userId: string, value: -1 | 0 | 1): Promise<void> {
    if (value === 0) {
      await this.db.delete(blogVotes).where(and(eq(blogVotes.postId, postId), eq(blogVotes.userId, userId)));
      return;
    }
    await this.db.insert(blogVotes).values({ postId, userId, value }).onConflictDoUpdate({ target: [blogVotes.postId, blogVotes.userId], set: { value } });
  }

  async myVote(postId: string, userId: string): Promise<number> {
    const rows = await this.db.select({ value: blogVotes.value }).from(blogVotes).where(and(eq(blogVotes.postId, postId), eq(blogVotes.userId, userId))).limit(1);
    return rows[0]?.value ?? 0;
  }

  async comments(postId: string, includeHidden: boolean): Promise<CommentRecord[]> {
    return this.db
      .select()
      .from(blogComments)
      .where(and(eq(blogComments.postId, postId), ...(includeHidden ? [] : [eq(blogComments.status, "published")])))
      .orderBy(asc(blogComments.createdAt));
  }

  async addComment(c: { postId: string; authorId: string; body: string }): Promise<CommentRecord> {
    const rows = await this.db.insert(blogComments).values(c).returning();
    const row = rows[0];
    if (!row) throw new Error("comment insert returned nothing");
    return row;
  }

  async findComment(id: string): Promise<CommentRecord | null> {
    const rows = await this.db.select().from(blogComments).where(eq(blogComments.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async setCommentStatus(id: string, status: BlogStatus): Promise<void> {
    await this.db.update(blogComments).set({ status }).where(eq(blogComments.id, id));
  }

  async deleteComment(id: string): Promise<void> {
    await this.db.delete(blogComments).where(eq(blogComments.id, id));
  }
}
