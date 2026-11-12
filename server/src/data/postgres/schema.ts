/**
 * PostgreSQL schema. Migrations are generated from this file with
 * `npm run db:generate` — never hand-edit a generated migration.
 */
import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { GradeResult, SubmissionStatus } from "../../domain/challenge.ts";

/**
 * One connected org per user for now. Keyed by user rather than (user, org) so
 * reconnecting replaces the old connection instead of accumulating stale ones;
 * multi-org support would widen this key, which is a migration — deliberately
 * deferred until a feature needs it.
 */
export const salesforceConnections = pgTable("salesforce_connections", {
  userId: text("user_id").primaryKey(),
  orgId: text("org_id").notNull(),
  sfUserId: text("sf_user_id").notNull(),
  username: text("username").notNull(),
  instanceUrl: text("instance_url").notNull(),
  loginUrl: text("login_url").notNull(),
  // Both stored as `enc:v1:…` (lib/crypto/tokenCipher.ts). Never plaintext.
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * In-flight OAuth handshakes. Holds the PKCE verifier server-side — putting it in
 * `state` would hand it to anyone who can read the redirect URL, which is the
 * exact party PKCE exists to defeat. Rows are single-use: consumed on callback.
 */
export const oauthPending = pgTable("oauth_pending", {
  nonce: text("nonce").primaryKey(),
  userId: text("user_id").notNull(),
  loginUrl: text("login_url").notNull(),
  codeVerifierEnc: text("code_verifier_enc").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/**
 * Apex Challenge Arena submissions. Grading is a check-only deploy in the
 * user's org; `deploy_id` is Salesforce's async id, polled when the client
 * asks for the submission (no background worker, so a restart loses nothing).
 */
export const challengeSubmissions = pgTable(
  "challenge_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    problemSlug: text("problem_slug").notNull(),
    orgId: text("org_id").notNull(),
    status: text("status").$type<SubmissionStatus>().notNull(),
    deployId: text("deploy_id"),
    /** The user's source, keyed by file name. */
    files: jsonb("files").$type<Record<string, string>>().notNull(),
    result: jsonb("result").$type<GradeResult>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("challenge_submissions_user_problem_idx").on(t.userId, t.problemSlug, t.createdAt),
    // One grading run per user at a time, enforced by the database rather than
    // a check-then-insert that two quick clicks could race past.
    uniqueIndex("challenge_submissions_one_running_idx").on(t.userId).where(sql`${t.status} = 'running'`),
  ],
);

/** One answered Certification Prep question. Signed-in users only. */
export const certAttempts = pgTable(
  "cert_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    exam: text("exam").notNull(),
    questionId: text("question_id").notNull(),
    correct: boolean("correct").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cert_attempts_user_exam_idx").on(t.userId, t.exam, t.answeredAt)],
);

/**
 * Public identity on SFCode. `handle` is the /u/<handle> URL. It is never
 * derived from the email address (that would leak it); defaults to the Clerk
 * username, else a random learner-xxxxxx.
 */
export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: text("user_id").primaryKey(),
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Case-insensitive uniqueness: /u/Ada and /u/ada are the same person.
  (t) => [uniqueIndex("user_profiles_handle_lower_idx").on(sql`lower(${t.handle})`)],
);

/** Granted roles. The owner (SUPER_ADMIN_USER_ID) is config, not a row. */
export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id").notNull(),
    role: text("role").$type<"admin" | "moderator">().notNull(),
    grantedBy: text("granted_by").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

/** Community blog. Markdown, rendered client-side through DOMPurify. */
export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    authorId: text("author_id").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** "hidden" = removed by a moderator; kept for the record, never listed. */
    status: text("status").$type<"published" | "hidden">().notNull().default("published"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("blog_posts_slug_idx").on(t.slug), index("blog_posts_created_idx").on(t.createdAt)],
);

/** One vote per user per post: +1 or -1 (absent = no vote). */
export const blogVotes = pgTable(
  "blog_votes",
  {
    postId: uuid("post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    value: integer("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

export const blogComments = pgTable(
  "blog_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    body: text("body").notNull(),
    status: text("status").$type<"published" | "hidden">().notNull().default("published"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("blog_comments_post_idx").on(t.postId, t.createdAt)],
);
