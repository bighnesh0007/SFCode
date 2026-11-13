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
  /** Set when the learner connected through their own Connected App; null = SFCode's shared app. */
  clientId: text("client_id"),
  clientSecretEnc: text("client_secret_enc"),
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
  clientId: text("client_id"),
  clientSecretEnc: text("client_secret_enc"),
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
    /** Set when the submission counted for a live contest the user had joined. */
    contestId: uuid("contest_id"),
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
    index("challenge_submissions_contest_idx").on(t.contestId),
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
    /** "moderator" rows predate the rename and read as reviewer. */
    role: text("role").$type<"admin" | "reviewer" | "buddy" | "moderator">().notNull(),
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

/** Timed contests built from catalog problems. */
export const contests = pgTable(
  "contests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("contests_slug_idx").on(t.slug), index("contests_starts_idx").on(t.startsAt)],
);

export const contestProblems = pgTable(
  "contest_problems",
  {
    contestId: uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
    problemSlug: text("problem_slug").notNull(),
    position: integer("position").notNull(),
    points: integer("points").notNull(),
  },
  (t) => [primaryKey({ columns: [t.contestId, t.problemSlug] })],
);

export const contestEntries = pgTable(
  "contest_entries",
  {
    contestId: uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.contestId, t.userId] })],
);

/** Store purchases. Coins earned are derived; spent = sum(price) here. */
export const storePurchases = pgTable(
  "store_purchases",
  {
    userId: text("user_id").notNull(),
    itemId: text("item_id").notNull(),
    price: integer("price").notNull(),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
);

/** Which owned cosmetic is worn in each slot (frame, badge, accent). */
export const userEquipped = pgTable(
  "user_equipped",
  {
    userId: text("user_id").notNull(),
    slot: text("slot").notNull(),
    itemId: text("item_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.slot] })],
);

/** One row per user, written once by the welcome quiz (and again if they redo it). */
export const userOnboarding = pgTable("user_onboarding", {
  userId: text("user_id").primaryKey(),
  role: text("role").notNull(),
  level: text("level").notNull(),
  goal: text("goal").notNull(),
  hours: text("hours").notNull(),
  roadmapId: text("roadmap_id").notNull(),
  /** Lesson-only nodes the user marked as read (problem nodes complete by solving). */
  readNodes: jsonb("read_nodes").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** The optional "about" section of a public profile. */
export const userAbout = pgTable("user_about", {
  userId: text("user_id").primaryKey(),
  bio: text("bio").notNull().default(""),
  company: text("company").notNull().default(""),
  location: text("location").notNull().default(""),
  trailheadUrl: text("trailhead_url"),
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  certifications: jsonb("certifications").$type<string[]>().notNull().default([]),
  openToWork: boolean("open_to_work").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The problem of the day, fixed once picked so adding problems later never
 * rewrites history (or anyone's bonus coins). `day` is a UTC date, YYYY-MM-DD.
 */
export const dailyChallenges = pgTable("daily_challenges", {
  day: text("day").primaryKey(),
  problemSlug: text("problem_slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Small admin-editable settings, one JSON value per key (e.g. "points"). */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** "I'd like to be a Buddy" requests, decided by reviewers or admins. */
export const buddyApplications = pgTable(
  "buddy_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    motivation: text("motivation").notNull(),
    link: text("link"),
    status: text("status").$type<"pending" | "approved" | "rejected">().notNull().default("pending"),
    decidedBy: text("decided_by"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  // At most one pending application per user.
  (t) => [uniqueIndex("buddy_applications_one_pending_idx").on(t.userId).where(sql`status = 'pending'`)],
);

export type DraftStatus = "draft" | "submitted" | "changes_requested" | "approved" | "rejected";

/** The content of a community problem (no slug or order: assigned on approval). */
export interface ProblemContent {
  title: string;
  track: "apex" | "debug" | "soql";
  difficulty: "Easy" | "Medium" | "Hard";
  category: string;
  tags: string[];
  statement: string;
  files: { name: string; type: "class" | "trigger" | "soql" }[];
  starter: Record<string, string>;
  reference: Record<string, string>;
  testClass: string;
  testSource: string;
}

/** Last "run in my org" result for a draft: reference must pass, starter must fail. */
export interface DraftCheck {
  status: "running" | "passed" | "failed" | "error";
  by: string;
  at: string;
  reference?: { verdict: string; passed: number; run: number; message: string | null };
  starter?: { verdict: string };
  message?: string;
  /** Hash of the content that was checked: any edit invalidates the result. */
  contentHash: string;
}

/** Staging: Buddies write here; reviewers decide. Never graded for learners. */
export const problemDrafts = pgTable(
  "problem_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: text("author_id").notNull(),
    status: text("status").$type<DraftStatus>().notNull().default("draft"),
    slug: text("slug").notNull(),
    content: jsonb("content").$type<ProblemContent>().notNull(),
    check: jsonb("check").$type<DraftCheck>(),
    reviewNote: text("review_note"),
    reviewedBy: text("reviewed_by"),
    publishedSlug: text("published_slug"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("problem_drafts_author_idx").on(t.authorId), index("problem_drafts_status_idx").on(t.status)],
);

/** Live community problems, merged into the catalog next to the built-in ones. */
export const problems = pgTable("problems", {
  slug: text("slug").primaryKey(),
  ord: integer("ord").notNull().unique(),
  authorId: text("author_id").notNull(),
  approvedBy: text("approved_by").notNull(),
  draftId: uuid("draft_id").notNull(),
  content: jsonb("content").$type<ProblemContent>().notNull(),
  active: boolean("active").notNull().default(true),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Who follows whom. */
export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id").notNull(),
    followeeId: text("followee_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followeeId] }), index("follows_followee_idx").on(t.followeeId)],
);

export type NotificationKind = "follow" | "review" | "buddy" | "mentor" | "team";

/** In-app notifications (the bell). `data` holds what the UI needs to render and link. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    kind: text("kind").$type<NotificationKind>().notNull(),
    data: jsonb("data").$type<Record<string, string>>().notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_created_idx").on(t.userId, t.createdAt)],
);

/** Opt-in email preferences. No row = nothing is sent. */
export const emailPrefs = pgTable("email_prefs", {
  userId: text("user_id").primaryKey(),
  weeklyDigest: boolean("weekly_digest").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Every email we attempt, for the monthly caps and to never send the same
 * digest twice: (user, kind, period) is unique; period is e.g. "2026-W46".
 */
export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    kind: text("kind").notNull(),
    period: text("period").notNull(),
    status: text("status").$type<"sent" | "failed">().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("email_log_once_idx").on(t.userId, t.kind, t.period), index("email_log_sent_idx").on(t.sentAt)],
);

/** Teams / cohorts with a private leaderboard; joined with a shareable code. */
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  joinCode: text("join_code").notNull().unique(),
  ownerId: text("owner_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] }), index("team_members_user_idx").on(t.userId)],
);

/** Learners (Ranger and up) who offer to help, with the topics they're good at. */
export const mentors = pgTable("mentors", {
  userId: text("user_id").primaryKey(),
  topics: jsonb("topics").$type<string[]>().notNull(),
  note: text("note").notNull().default(""),
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Job corner: roles posted by admins. */
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location").notNull(),
  url: text("url").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull(),
  postedBy: text("posted_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** Who did what in the admin tools: roles, points, suspensions, announcements. Append-only. */
export const adminAudit = pgTable(
  "admin_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    targetId: text("target_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_audit_at_idx").on(t.at)],
);

/**
 * Crashes from browsers and the server, grouped: one row per distinct error
 * (fingerprint), counting how often it happens. No request bodies, query
 * strings or email addresses are ever stored.
 */
export const errorEvents = pgTable(
  "error_events",
  {
    fingerprint: text("fingerprint").primaryKey(),
    source: text("source").$type<"client" | "server">().notNull(),
    name: text("name").notNull(),
    message: text("message").notNull(),
    stack: text("stack"),
    /** Last path it happened on, without the query string. */
    path: text("path"),
    userAgent: text("user_agent"),
    occurrences: integer("occurrences").notNull().default(1),
    /** Distinct signed-in users who hit it, capped list (for "how many people"). */
    users: jsonb("users").$type<string[]>().notNull().default([]),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("error_events_last_seen_idx").on(t.lastSeen)],
);

/** Cookie-free page views: a count per path per UTC day, nothing per visitor. */
export const pageViews = pgTable(
  "page_views",
  {
    day: text("day").notNull(), // YYYY-MM-DD
    path: text("path").notNull(),
    views: integer("views").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.path] })],
);
