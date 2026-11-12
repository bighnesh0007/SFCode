/** Roles and the read-only stats behind the admin page. */
import { and, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { challengeSubmissions, salesforceConnections, userProfiles, userRoles } from "../data/postgres/schema.ts";

export type StaffRole = "admin" | "moderator";

export interface AdminUserRow {
  userId: string;
  handle: string;
  displayName: string;
  joined: Date;
  roles: StaffRole[];
}

export interface AdminRepository {
  rolesOf(userId: string): Promise<StaffRole[]>;
  grant(userId: string, role: StaffRole, by: string): Promise<void>;
  revoke(userId: string, role: StaffRole): Promise<boolean>;
  overview(since24h: Date): Promise<{ learners: number; connectedOrgs: number; submissions: number; submissions24h: number; byStatus: Record<string, number> }>;
  users(query: string, limit: number): Promise<AdminUserRow[]>;
  profileExists(userId: string): Promise<boolean>;
}

export class PgAdminRepository implements AdminRepository {
  constructor(private readonly db: PgDatabase) {}

  async rolesOf(userId: string): Promise<StaffRole[]> {
    const rows = await this.db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
    return rows.map((r) => r.role);
  }

  async grant(userId: string, role: StaffRole, by: string): Promise<void> {
    await this.db.insert(userRoles).values({ userId, role, grantedBy: by }).onConflictDoNothing();
  }

  async revoke(userId: string, role: StaffRole): Promise<boolean> {
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
      roles: roles.filter((r) => r.userId === p.userId).map((r) => r.role),
    }));
  }

  async profileExists(userId: string): Promise<boolean> {
    const rows = await this.db.select({ id: userProfiles.userId }).from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    return rows.length > 0;
  }
}
