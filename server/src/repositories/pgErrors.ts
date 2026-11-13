/**
 * Postgres unique violation (SQLSTATE 23505). Drizzle wraps driver errors,
 * so the code can be on the error or on its `cause`; checking only the top
 * level surfaced clashes as 500s instead of a clean "taken" (caught by the
 * Postgres suite).
 */
export const isUniqueViolation = (err: unknown): boolean => {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
};
