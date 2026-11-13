/** Teams, mentors and jobs. */
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { jobs, mentors, teamMembers, teams, userAbout } from "../data/postgres/schema.ts";
import { isUniqueViolation } from "./pgErrors.ts";

export interface TeamRecord {
  id: string;
  slug: string;
  name: string;
  joinCode: string;
  ownerId: string;
  createdAt: Date;
}
export interface MentorRecord {
  userId: string;
  topics: string[];
  note: string;
  active: boolean;
}
export interface JobRecord {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  tags: string[];
  createdAt: Date;
  expiresAt: Date;
}

export class PgHubRepository {
  constructor(private readonly db: PgDatabase) {}

  // ── teams ──
  async createTeam(t: { slug: string; name: string; joinCode: string; ownerId: string }): Promise<TeamRecord | null> {
    try {
      return await this.db.transaction(async (tx) => {
        const [row] = await tx.insert(teams).values(t).returning();
        if (!row) return null;
        await tx.insert(teamMembers).values({ teamId: row.id, userId: t.ownerId });
        return row;
      });
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }
  async teamBySlug(slug: string): Promise<TeamRecord | null> {
    const [row] = await this.db.select().from(teams).where(eq(teams.slug, slug)).limit(1);
    return row ?? null;
  }
  async teamByCode(code: string): Promise<TeamRecord | null> {
    const [row] = await this.db.select().from(teams).where(eq(teams.joinCode, code)).limit(1);
    return row ?? null;
  }
  async teamsOf(userId: string): Promise<(TeamRecord & { members: number })[]> {
    const mine = (await this.db.select({ id: teamMembers.teamId }).from(teamMembers).where(eq(teamMembers.userId, userId))).map((r) => r.id);
    if (mine.length === 0) return [];
    const rows = await this.db.select().from(teams).where(inArray(teams.id, mine)).orderBy(asc(teams.createdAt));
    const counts = await this.db.select({ id: teamMembers.teamId, n: sql<number>`count(*)::int` }).from(teamMembers).where(inArray(teamMembers.teamId, mine)).groupBy(teamMembers.teamId);
    const byId = new Map(counts.map((c) => [c.id, c.n]));
    return rows.map((r) => ({ ...r, members: byId.get(r.id) ?? 0 }));
  }
  async ownedCount(userId: string): Promise<number> {
    const [row] = await this.db.select({ n: sql<number>`count(*)::int` }).from(teams).where(eq(teams.ownerId, userId));
    return row?.n ?? 0;
  }
  async members(teamId: string): Promise<string[]> {
    return (await this.db.select({ id: teamMembers.userId }).from(teamMembers).where(eq(teamMembers.teamId, teamId)).orderBy(asc(teamMembers.joinedAt))).map((r) => r.id);
  }
  async addMember(teamId: string, userId: string): Promise<boolean> {
    return (await this.db.insert(teamMembers).values({ teamId, userId }).onConflictDoNothing().returning({ id: teamMembers.userId })).length > 0;
  }
  async removeMember(teamId: string, userId: string): Promise<boolean> {
    return (await this.db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))).returning({ id: teamMembers.userId })).length > 0;
  }
  async setJoinCode(teamId: string, code: string): Promise<void> {
    await this.db.update(teams).set({ joinCode: code }).where(eq(teams.id, teamId));
  }
  async deleteTeam(teamId: string): Promise<void> {
    await this.db.delete(teams).where(eq(teams.id, teamId));
  }

  // ── mentors ──
  async mentor(userId: string): Promise<MentorRecord | null> {
    const [row] = await this.db.select({ userId: mentors.userId, topics: mentors.topics, note: mentors.note, active: mentors.active }).from(mentors).where(eq(mentors.userId, userId)).limit(1);
    return row ?? null;
  }
  async saveMentor(m: MentorRecord): Promise<void> {
    await this.db
      .insert(mentors)
      .values(m)
      .onConflictDoUpdate({ target: mentors.userId, set: { topics: m.topics, note: m.note, active: m.active, updatedAt: sql`now()` } });
  }
  async activeMentors(): Promise<MentorRecord[]> {
    return this.db.select({ userId: mentors.userId, topics: mentors.topics, note: mentors.note, active: mentors.active }).from(mentors).where(eq(mentors.active, true)).orderBy(desc(mentors.updatedAt));
  }

  // ── jobs ──
  async createJob(j: Omit<JobRecord, "id" | "createdAt"> & { postedBy: string }): Promise<JobRecord> {
    const [row] = await this.db.insert(jobs).values(j).returning();
    if (!row) throw new Error("job insert returned nothing");
    return row;
  }
  async openJobs(now: Date): Promise<JobRecord[]> {
    return this.db.select().from(jobs).where(gt(jobs.expiresAt, now)).orderBy(desc(jobs.createdAt));
  }
  async deleteJob(id: string): Promise<boolean> {
    return (await this.db.delete(jobs).where(eq(jobs.id, id)).returning({ id: jobs.id })).length > 0;
  }

  /** Learners who marked themselves open to work on their profile. */
  async openToWork(): Promise<string[]> {
    return (await this.db.select({ id: userAbout.userId }).from(userAbout).where(eq(userAbout.openToWork, true))).map((r) => r.id);
  }
}
