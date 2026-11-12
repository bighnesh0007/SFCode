/**
 * The ONLY place in the codebase that reads `process.env`.
 *
 * Parsing happens once at import time and reports EVERY invalid variable at once
 * rather than failing on the first one — a half-configured deploy should tell you
 * everything that is wrong in a single log line.
 */
import { z } from "zod";

const booleanish = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const csv = z
  .string()
  .transform((v) =>
    v
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // 4100/8100 rather than DWCode's 4000/8000 so both stacks run side by side.
  // Not `PORT`: tools that launch the whole stack (and Next itself) set PORT for
  // the web app, and the API inheriting it would collide with the site.
  API_PORT: z.coerce.number().int().positive().default(4100),
  HOST: z.string().min(1).default("127.0.0.1"),

  // ── Database ───────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL").optional(),

  // ── Clerk ──────────────────────────────────────────────────────────────────
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_AUTHORIZED_PARTIES: csv.optional(),

  // ── Salesforce External Client App ─────────────────────────────────────────
  SF_CLIENT_ID: z.string().min(1).optional(),
  SF_CLIENT_SECRET: z.string().min(1).optional(),
  SF_API_VERSION: z.string().regex(/^\d{2}\.0$/, "like 62.0").default("62.0"),
  // Per-call budget for Salesforce HTTP requests. Anonymous Apex can run long.
  SF_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),

  // ── Secrets at rest ────────────────────────────────────────────────────────
  // 32-byte hex key for AES-256-GCM encryption of stored Salesforce tokens.
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "must be 64 hex characters (32 bytes)")
    .optional(),
  // HMAC key for signing OAuth `state`.
  OAUTH_STATE_SECRET: z.string().min(16).optional(),

  // ── HTTP ───────────────────────────────────────────────────────────────────
  APP_URL: z.url().default("http://localhost:8100"),
  // NOTE: in Zod 4 `.default()` supplies the OUTPUT value, so this is an array.
  CORS_ALLOWED_ORIGINS: csv.default(["http://localhost:8100"]),
  // "loopback": trust only proxies on this machine (the Next.js /backend proxy).
  TRUST_PROXY: z
    .enum(["true", "false", "1", "0", "loopback"])
    .transform((v) => (v === "loopback" ? ("loopback" as const) : v === "true" || v === "1"))
    .default(false),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  LOG_PRETTY: booleanish.optional(),
});

export type Env = z.infer<typeof envSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

/** Parse the given record, or throw with every problem listed. */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // `KEY=` with nothing after it means "not configured" — that is how a copied
  // .env.example looks — so blank values are dropped rather than validated.
  const present = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v.trim() !== ""));
  const result = envSchema.safeParse(present);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${formatIssues(result.error)}`);
  }
  return result.data;
}

/**
 * Variables that must be present for a capability to work. `server.ts` reports
 * missing ones as warnings so a partially configured dev box still boots.
 */
export const CAPABILITY_REQUIREMENTS = {
  database: ["DATABASE_URL"],
  auth: ["CLERK_SECRET_KEY"],
  // Connecting an org stores tokens, so it needs the database and both secrets too.
  salesforce: ["SF_CLIENT_ID", "SF_CLIENT_SECRET", "TOKEN_ENCRYPTION_KEY", "OAUTH_STATE_SECRET", "DATABASE_URL"],
} as const satisfies Record<string, readonly (keyof Env)[]>;

export type Capability = keyof typeof CAPABILITY_REQUIREMENTS;

/** Which capabilities are fully configured, and what each missing one needs. */
export function resolveCapabilities(env: Env): {
  enabled: Capability[];
  missing: { capability: Capability; vars: string[] }[];
} {
  const enabled: Capability[] = [];
  const missing: { capability: Capability; vars: string[] }[] = [];

  for (const [capability, vars] of Object.entries(CAPABILITY_REQUIREMENTS)) {
    const absent = vars.filter((name) => env[name as keyof Env] === undefined);
    if (absent.length === 0) enabled.push(capability as Capability);
    else missing.push({ capability: capability as Capability, vars: absent });
  }

  return { enabled, missing };
}
