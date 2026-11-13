/** The optional "about" section of public profiles. */
import { inArray, isNotNull, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { userAbout } from "../data/postgres/schema.ts";

export interface AboutRecord {
  bio: string;
  company: string;
  location: string;
  trailheadUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  certifications: string[];
  openToWork: boolean;
  country: string | null;
}

export const EMPTY_ABOUT: AboutRecord = { bio: "", company: "", location: "", trailheadUrl: null, linkedinUrl: null, githubUrl: null, certifications: [], openToWork: false, country: null };

export interface AboutRepository {
  /** userId → country for everyone who set one. */
  countries(): Promise<Map<string, string>>;
  get(userId: string): Promise<AboutRecord | null>;
  getMany(userIds: string[]): Promise<Map<string, AboutRecord>>;
  save(userId: string, about: AboutRecord): Promise<void>;
}

export class PgAboutRepository implements AboutRepository {
  constructor(private readonly db: PgDatabase) {}

  async get(userId: string): Promise<AboutRecord | null> {
    return (await this.getMany([userId])).get(userId) ?? null;
  }

  async getMany(userIds: string[]): Promise<Map<string, AboutRecord>> {
    const out = new Map<string, AboutRecord>();
    if (userIds.length === 0) return out;
    const rows = await this.db
      .select({
        userId: userAbout.userId,
        bio: userAbout.bio,
        company: userAbout.company,
        location: userAbout.location,
        trailheadUrl: userAbout.trailheadUrl,
        linkedinUrl: userAbout.linkedinUrl,
        githubUrl: userAbout.githubUrl,
        certifications: userAbout.certifications,
        openToWork: userAbout.openToWork,
        country: userAbout.country,
      })
      .from(userAbout)
      .where(inArray(userAbout.userId, userIds));
    for (const { userId, ...about } of rows) out.set(userId, about);
    return out;
  }

  async countries(): Promise<Map<string, string>> {
    const rows = await this.db.select({ userId: userAbout.userId, country: userAbout.country }).from(userAbout).where(isNotNull(userAbout.country));
    return new Map(rows.flatMap((r) => (r.country ? [[r.userId, r.country] as const] : [])));
  }

  async save(userId: string, about: AboutRecord): Promise<void> {
    await this.db
      .insert(userAbout)
      .values({ userId, ...about })
      .onConflictDoUpdate({ target: userAbout.userId, set: { ...about, updatedAt: sql`now()` } });
  }
}

