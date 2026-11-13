/** Roles and the read-only stats behind the admin page. */
import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { adminAudit, certAttempts, challengeSubmissions, salesforceConnections, userProfiles, userRoles } from "../data/postgres/schema.ts";

export type StaffRole = "admin" | "reviewer" | "buddy";
/** What may be stored: StaffRole plus the pre-rename "moderator" (read as reviewer). */
export type StoredRole = StaffRole | "moderator";

export interface AdminUserRow {
  userId: string;
  handle: string;
  displayName: string;
  joined: Date;
  roles: StaffRole[];
}

export interface DailyPoint {
  day: string; // YYYY-MM-DD (UTC)
  signups: number;
  submissions: number;
  accepted: number;
  active: number;
}

export interface ProblemStat {
  slug: string;
  submissions: number;
  accepted: number;
  solvers: number;
  /** Distinct learners who submitted at least once. */
  attempters: number;
}

export interface Dashboard {
  days: DailyPoint[];
  problems: ProblemStat[];
}

export interface UserDetail {
  userId: string;
  handle: string;
  displayName: string;
  imageUrl: string | null;
  joined: Date;
  roles: StaffRole[];
  submissions: number;
  accepted: number;
  solved: number;
  lastActive: Date | null;
  certAnswers: number;
  org: { username: string; connectedAt: Date } | null;
  recent: { slug: string; status: string; at: Date }[];
}

export interface AuditRow {
  id: string;
  actorId: string;
  action: string;
  targetId: string | null;
  detail: Record<string, unknown>;
  at: Date;
}

export interface AdminRepository {
  rolesOf(userId: string): Promise<StoredRole[]>;
  countRole(role: StaffRole): Promise<number>;
  grant(userId: string, role: StaffRole, by: string): Promise<void>;
  revoke(userId: string, role: StoredRole): Promise<boolean>;
  overview(since24h: Date): Promise<{ learners: number; connectedOrgs: number; submissions: number; submissions24h: number; byStatus: Record<string, number> }>;
  users(query: string, limit: number): Promise<AdminUserRow[]>;
  profileExists(userId: string): Promise<boolean>;
  dashboard(since: Date): Promise<Dashboard>;
  userDetail(userId: string): Promise<UserDetail | null>;
  audit(entry: { actorId: string; action: string; targetId?: string | null; detail?: Record<string, unknown> }): Promise<void>;
  auditLog(limit: number): Promise<AuditRow[]>;
}

export class PgAdminRepository implements AdminRepository {
  constructor(private readonly db: PgDatabase) {}

  async countRole(role: StaffRole): Promise<number> {
    const [row] = await this.db.select({ n: sql<number>`count(*)::int` }).from(userRoles).where(eq(userRoles.role, role));
    return row?.n ?? 0;
  }

  async rolesOf(userId: string): Promise<StoredRole[]> {
    const rows = await this.db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
    return rows.map((r) => r.role);
  }

  async grant(userId: string, role: StaffRole, by: string): Promise<void> {
    await this.db.insert(userRoles).values({ userId, role, grantedBy: by }).onConflictDoNothing();
  }

  async revoke(userId: string, role: StoredRole): Promise<boolean> {
    const rows = await this.db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.role, role))).returning({ userId: userRoles.userId });
    return rows.length > 0;
  }

  async overview(since24h: Date) {
    const count = sql<number>`count(*)::int`;
    const [learners] = await this.db.select({ n: count }).from(userProfiles);
    const [orgs] = await this.db.select({ n: count }).from(salesforceConnections);
    const [total] = await this.db.select({ n: count }).from(challengeSubmissions);
    const [recent] = await this.db.select({ n: count }).from(challengeSubmissions).where(gte(challengeSubmissions.createdAt, since24h));
    const statuses = await this.db.select({ status: challengeSubmissions.status, n: count }).from(challengeSubmissions).groupBy(challengeSubmissions.status);
    return {
      learners: learners?.n ?? 0,
      connectedOrgs: orgs?.n ?? 0,
      submissions: total?.n ?? 0,
      submissions24h: recent?.n ?? 0,
      byStatus: Object.fromEntries(statuses.map((s) => [s.status, s.n])),
    };
  }

  async users(query: string, limit: number): Promise<AdminUserRow[]> {
    const q = query.trim();
    // ilike with a bound parameter; % and _ in the input are escaped so they match literally.
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const profiles = await this.db
      .select()
      .from(userProfiles)
      .where(q ? or(ilike(userProfiles.handle, pattern), ilike(userProfiles.displayName, pattern), eq(userProfiles.userId, q)) : undefined)
      .orderBy(userProfiles.createdAt)
      .limit(limit);
    const roles = profiles.length ? await this.db.select().from(userRoles).where(inArray(userRoles.userId, profiles.map((p) => p.userId))) : [];
    return profiles.map((p) => ({
      userId: p.userId,
      handle: p.handle,
      displayName: p.displayName,
      joined: p.createdAt,
      // Pre-rename "moderator" rows show as reviewer.
      roles: [...new Set(roles.filter((r) => r.userId === p.userId).map((r): StaffRole => (r.role === "moderator" ? "reviewer" : r.role)))],
    }));
  }

  async profileExists(userId: string): Promise<boolean> {
    const rows = await this.db.select({ id: userProfiles.userId }).from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    return rows.length > 0;
  }

  async dashboard(since: Date): Promise<Dashboard> {
    const day = (col: unknown) => sql<string>`to_char(date_trunc('day', ${col} at time zone 'UTC'), 'YYYY-MM-DD')`;
    const n = sql<number>`count(*)::int`;
    const signups = await this.db
      .select({ day: day(userProfiles.createdAt), n })
      .from(userProfiles)
      .where(gte(userProfiles.createdAt, since))
      .groupBy(sql`1`);
    const subs = await this.db
      .select({
        day: day(challengeSubmissions.createdAt),
        n,
        accepted: sql<number>`count(*) filter (where ${challengeSubmissions.status} = 'accepted')::int`,
        active: sql<number>`count(distinct ${challengeSubmissions.userId})::int`,
      })
      .from(challengeSubmissions)
      .where(gte(challengeSubmissions.createdAt, since))
      .groupBy(sql`1`);
    const problems = await this.db
      .select({
        slug: challengeSubmissions.problemSlug,
        submissions: n,
        accepted: sql<number>`count(*) filter (where ${challengeSubmissions.status} = 'accepted')::int`,
        solvers: sql<number>`count(distinct ${challengeSubmissions.userId}) filter (where ${challengeSubmissions.status} = 'accepted')::int`,
        attempters: sql<number>`count(distinct ${challengeSubmissions.userId})::int`,
      })
      .from(challengeSubmissions)
      .where(sql`${challengeSubmissions.status} <> 'running'`)
      .groupBy(challengeSubmissions.problemSlug);

    // Every day in the window, including the quiet ones, so charts don't skip.
    const byDay = new Map<string, DailyPoint>();
    for (let t = Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()); t <= Date.now(); t += 86_400_000) {
      const d = new Date(t).toISOString().slice(0, 10);
      byDay.set(d, { day: d, signups: 0, submissions: 0, accepted: 0, active: 0 });
    }
    for (const r of signups) {
      const p = byDay.get(r.day);
      if (p) p.signups = r.n;
    }
    for (const r of subs) {
      const p = byDay.get(r.day);
      if (p) Object.assign(p, { submissions: r.n, accepted: r.accepted, active: r.active });
    }
    return { days: [...byDay.values()], problems };
  }

  async userDetail(userId: string): Promise<UserDetail | null> {
    const [p] = await this.db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    if (!p) return null;
    const roles = await this.db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
    const [stats] = await this.db
      .select({
        submissions: sql<number>`count(*)::int`,
        accepted: sql<number>`count(*) filter (where ${challengeSubmissions.status} = 'accepted')::int`,
        solved: sql<number>`count(distinct ${challengeSubmissions.problemSlug}) filter (where ${challengeSubmissions.status} = 'accepted')::int`,
        last: sql<Date | null>`max(${challengeSubmissions.createdAt})`,
      })
      .from(challengeSubmissions)
      .where(eq(challengeSubmissions.userId, userId));
    const [cert] = await this.db.select({ n: sql<number>`count(*)::int`, last: sql<Date | null>`max(${certAttempts.answeredAt})` }).from(certAttempts).where(eq(certAttempts.userId, userId));
    const [org] = await this.db
      .select({ username: salesforceConnections.username, connectedAt: salesforceConnections.connectedAt })
      .from(salesforceConnections)
      .where(eq(salesforceConnections.userId, userId))
      .limit(1);
    const recent = await this.db
      .select({ slug: challengeSubmissions.problemSlug, status: challengeSubmissions.status, at: challengeSubmissions.createdAt })
      .from(challengeSubmissions)
      .where(eq(challengeSubmissions.userId, userId))
      .orderBy(desc(challengeSubmissions.createdAt))
      .limit(10);
    // Raw aggregates come back as strings from the driver.
    const asDate = (v: Date | string | null | undefined) => (v ? new Date(v) : null);
    const lastSub = asDate(stats?.last);
    const lastCert = asDate(cert?.last);
    const lastActive = lastSub && lastCert ? (lastSub > lastCert ? lastSub : lastCert) : (lastSub ?? lastCert);
    return {
      userId: p.userId,
      handle: p.handle,
      displayName: p.displayName,
      imageUrl: p.imageUrl,
      joined: p.createdAt,
      roles: [...new Set(roles.map((r): StaffRole => (r.role === "moderator" ? "reviewer" : r.role)))],
      submissions: stats?.submissions ?? 0,
      accepted: stats?.accepted ?? 0,
      solved: stats?.solved ?? 0,
      lastActive,
      certAnswers: cert?.n ?? 0,
      org: org ?? null,
      recent,
    };
  }

  async audit(entry: { actorId: string; action: string; targetId?: string | null; detail?: Record<string, unknown> }): Promise<void> {
    await this.db.insert(adminAudit).values({ actorId: entry.actorId, action: entry.action, targetId: entry.targetId ?? null, detail: entry.detail ?? {} });
  }

  async auditLog(limit: number): Promise<AuditRow[]> {
    return this.db.select().from(adminAudit).orderBy(desc(adminAudit.at)).limit(limit);
  }
}
