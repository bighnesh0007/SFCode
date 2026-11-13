/** Grouped errors and page-view counts. */
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { errorEvents, pageViews } from "../data/postgres/schema.ts";
import { MAX_USERS_PER_ERROR } from "../domain/telemetry.ts";

export interface ErrorInput {
  fingerprint: string;
  source: "client" | "server";
  name: string;
  message: string;
  stack: string | null;
  path: string | null;
  userAgent: string | null;
  userId: string | null;
}

export interface ErrorGroup {
  fingerprint: string;
  source: "client" | "server";
  name: string;
  message: string;
  stack: string | null;
  path: string | null;
  userAgent: string | null;
  occurrences: number;
  users: number;
  firstSeen: Date;
  lastSeen: Date;
  resolvedAt: Date | null;
}

export interface TelemetryRepository {
  /** Inserts a new group, or counts another occurrence (and reopens it if it was resolved). */
  recordError(e: ErrorInput): Promise<void>;
  errors(opts: { open: boolean; limit: number }): Promise<ErrorGroup[]>;
  resolve(fingerprint: string): Promise<boolean>;
  countView(day: string, path: string): Promise<void>;
  views(sinceDay: string): Promise<{ day: string; path: string; views: number }[]>;
}

export class PgTelemetryRepository implements TelemetryRepository {
  constructor(private readonly db: PgDatabase) {}

  async recordError(e: ErrorInput): Promise<void> {
    const users = e.userId ? [e.userId] : [];
    await this.db
      .insert(errorEvents)
      .values({ fingerprint: e.fingerprint, source: e.source, name: e.name, message: e.message, stack: e.stack, path: e.path, userAgent: e.userAgent, users })
      .onConflictDoUpdate({
        target: errorEvents.fingerprint,
        set: {
          occurrences: sql`${errorEvents.occurrences} + 1`,
          lastSeen: sql`now()`,
          resolvedAt: null,
          message: e.message,
          stack: e.stack,
          path: e.path,
          userAgent: e.userAgent,
          // Append the user if new, keeping at most MAX_USERS_PER_ERROR ids.
          users: e.userId
            ? sql`case when ${errorEvents.users} ? ${e.userId} or jsonb_array_length(${errorEvents.users}) >= ${MAX_USERS_PER_ERROR} then ${errorEvents.users} else ${errorEvents.users} || ${JSON.stringify([e.userId])}::jsonb end`
            : sql`${errorEvents.users}`,
        },
      });
  }

  async errors(opts: { open: boolean; limit: number }): Promise<ErrorGroup[]> {
    const rows = await this.db
      .select()
      .from(errorEvents)
      .where(opts.open ? isNull(errorEvents.resolvedAt) : undefined)
      .orderBy(desc(errorEvents.lastSeen))
      .limit(opts.limit);
    return rows.map((r) => ({ ...r, users: r.users.length }));
  }

  async resolve(fingerprint: string): Promise<boolean> {
    const rows = await this.db
      .update(errorEvents)
      .set({ resolvedAt: sql`now()` })
      .where(and(eq(errorEvents.fingerprint, fingerprint), isNull(errorEvents.resolvedAt)))
      .returning({ fp: errorEvents.fingerprint });
    return rows.length > 0;
  }

  async countView(day: string, path: string): Promise<void> {
    await this.db
      .insert(pageViews)
      .values({ day, path, views: 1 })
      .onConflictDoUpdate({ target: [pageViews.day, pageViews.path], set: { views: sql`${pageViews.views} + 1` } });
  }

  async views(sinceDay: string): Promise<{ day: string; path: string; views: number }[]> {
    return this.db.select().from(pageViews).where(gte(pageViews.day, sinceDay));
  }
}
