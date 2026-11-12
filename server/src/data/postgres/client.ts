import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

export type PgDatabase = ReturnType<typeof createPgDatabase>;

/** A Drizzle handle over a pooled connection to `url`. */
export function createPgDatabase(url: string) {
  const pool = new Pool({ connectionString: url, max: 5 });
  return Object.assign(drizzle(pool, { schema }), { close: () => pool.end() });
}
