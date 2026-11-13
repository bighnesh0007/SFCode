/** Admin-editable settings stored as JSON per key. */
import { eq, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { appSettings } from "../data/postgres/schema.ts";

export interface SettingsRepository {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, by: string): Promise<void>;
}

export class PgSettingsRepository implements SettingsRepository {
  constructor(private readonly db: PgDatabase) {}

  async get(key: string): Promise<unknown> {
    const [row] = await this.db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key)).limit(1);
    return row?.value ?? null;
  }

  async set(key: string, value: unknown, by: string): Promise<void> {
    await this.db
      .insert(appSettings)
      .values({ key, value, updatedBy: by })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: by, updatedAt: sql`now()` } });
  }
}
