/**
 * PostgreSQL schema. Migrations are generated from this file with
 * `npm run db:generate` — never hand-edit a generated migration.
 */
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * One connected org per user for now. Keyed by user rather than (user, org) so
 * reconnecting replaces the old connection instead of accumulating stale ones;
 * multi-org support would widen this key, which is a migration — deliberately
 * deferred until a feature needs it.
 */
export const salesforceConnections = pgTable("salesforce_connections", {
  userId: text("user_id").primaryKey(),
  orgId: text("org_id").notNull(),
  sfUserId: text("sf_user_id").notNull(),
  username: text("username").notNull(),
  instanceUrl: text("instance_url").notNull(),
  loginUrl: text("login_url").notNull(),
  // Both stored as `enc:v1:…` (lib/crypto/tokenCipher.ts). Never plaintext.
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * In-flight OAuth handshakes. Holds the PKCE verifier server-side — putting it in
 * `state` would hand it to anyone who can read the redirect URL, which is the
 * exact party PKCE exists to defeat. Rows are single-use: consumed on callback.
 */
export const oauthPending = pgTable("oauth_pending", {
  nonce: text("nonce").primaryKey(),
  userId: text("user_id").notNull(),
  loginUrl: text("login_url").notNull(),
  codeVerifierEnc: text("code_verifier_enc").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
