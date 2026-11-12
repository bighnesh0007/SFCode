/**
 * Frozen, typed configuration object. Import this — never `process.env`.
 */
import { parseEnv, resolveCapabilities, type Capability, type Env } from "./env.ts";

const env: Env = parseEnv();

export const config = Object.freeze({
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
  port: env.API_PORT,
  host: env.HOST,

  databaseUrl: env.DATABASE_URL,

  clerk: Object.freeze({
    secretKey: env.CLERK_SECRET_KEY,
    authorizedParties: env.CLERK_AUTHORIZED_PARTIES,
  }),

  salesforce: Object.freeze({
    clientId: env.SF_CLIENT_ID,
    clientSecret: env.SF_CLIENT_SECRET,
    apiVersion: env.SF_API_VERSION,
    timeoutMs: env.SF_TIMEOUT_MS,
    // Derived, not configured: it must match what is registered in Salesforce,
    // and the browser reaches the API through the site's /backend proxy.
    redirectUri: `${env.APP_URL.replace(/\/$/, "")}/backend/api/v1/salesforce/oauth/callback`,
  }),

  secrets: Object.freeze({
    tokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY,
    oauthStateSecret: env.OAUTH_STATE_SECRET,
  }),

  http: Object.freeze({
    appUrl: env.APP_URL.replace(/\/$/, ""),
    corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS,
    trustProxy: env.TRUST_PROXY,
  }),

  log: Object.freeze({
    level: env.LOG_LEVEL,
    pretty: env.LOG_PRETTY ?? env.NODE_ENV === "development",
  }),
});

export type Config = typeof config;

export const capabilities = resolveCapabilities(env);

export function hasCapability(capability: Capability): boolean {
  return capabilities.enabled.includes(capability);
}

export type { Capability };
