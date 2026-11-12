/**
 * Connecting, using and disconnecting a user's Salesforce org.
 *
 * Tokens are decrypted only inside this service, only for the duration of a call,
 * and never returned to a controller.
 */
import { BadRequestError, AppError } from "../../errors/AppError.ts";
import { ErrorCode } from "../../errors/codes.ts";
import { signOAuthState, verifyOAuthState, OAUTH_STATE_TTL_MS, safeReturnTo } from "../../lib/crypto/oauthState.ts";
import { createPkcePair } from "../../lib/crypto/pkce.ts";
import { decryptToken, encryptToken } from "../../lib/crypto/tokenCipher.ts";
import { logEvent } from "../../lib/logger.ts";
import type { SalesforceConnectionRepository, StoredConnection } from "../../repositories/salesforceConnection.repository.ts";
import type { Clock } from "../../types/ports.ts";
import { resolveLoginUrl } from "./loginUrl.ts";
import { RefreshRevokedError, SessionExpiredError, type ApexExecutionResult, type SalesforceClient } from "./salesforceClient.ts";

export class OrgNotConnectedError extends AppError {
  constructor(message = "Connect a Salesforce org first.") {
    super({ code: ErrorCode.ORG_NOT_CONNECTED, message, status: 409, expose: true });
  }
}

/** A live session handed to callers of `withOrg`. */
export interface OrgSession {
  orgId: string;
  instanceUrl: string;
  accessToken: string;
}

/** What the client is allowed to see about a connection. */
export interface ConnectionView {
  orgId: string;
  username: string;
  instanceUrl: string;
  environment: "production" | "sandbox" | "custom";
  connectedAt: string;
}

function toView(c: StoredConnection): ConnectionView {
  const environment = c.loginUrl === "https://login.salesforce.com" ? "production" : c.loginUrl === "https://test.salesforce.com" ? "sandbox" : "custom";
  return { orgId: c.orgId, username: c.username, instanceUrl: c.instanceUrl, environment, connectedAt: c.connectedAt.toISOString() };
}

export class SalesforceConnectionService {
  constructor(
    private readonly repo: SalesforceConnectionRepository,
    private readonly sf: SalesforceClient,
    private readonly secrets: { tokenKey: string; stateSecret: string },
    private readonly clock: Clock,
  ) {}

  async start(userId: string, loginInput: string, returnTo: string): Promise<{ authorizeUrl: string }> {
    const loginUrl = resolveLoginUrl(loginInput);
    if (!loginUrl) throw new BadRequestError("Login URL must be production, sandbox, or an https://<domain>.my.salesforce.com address.");

    const state = signOAuthState({ userId, returnTo }, this.secrets.stateSecret, this.clock.nowMs());
    const nonce = verifyOAuthState(state, this.secrets.stateSecret, this.clock.nowMs())?.nonce;
    if (!nonce) throw new Error("freshly signed state failed to verify");

    const pkce = createPkcePair();
    await this.repo.savePending({
      nonce,
      userId,
      loginUrl,
      codeVerifierEnc: encryptToken(pkce.verifier, this.secrets.tokenKey),
      expiresAt: new Date(this.clock.nowMs() + OAUTH_STATE_TTL_MS),
    });
    logEvent("salesforce.connect_started", { loginUrl });
    return { authorizeUrl: this.sf.authorizeUrl(loginUrl, state, pkce.challenge) };
  }

  /**
   * Finish the handshake. Returns where to send the browser; failures are encoded
   * in the redirect (`?sf=error`) because this is a top-level navigation, not XHR.
   */
  async complete(input: { code?: string; state?: string; error?: string }): Promise<string> {
    const payload = input.state ? verifyOAuthState(input.state, this.secrets.stateSecret, this.clock.nowMs()) : null;
    const returnTo = payload ? payload.returnTo : safeReturnTo(undefined);
    const fail = (reason: string): string => {
      logEvent("salesforce.connect_failed", { reason }, "warn");
      return withQuery(returnTo, { sf: "error", reason });
    };

    if (!payload) return fail("invalid_state");
    if (input.error) return fail(input.error === "access_denied" ? "denied" : "salesforce_error");
    if (!input.code) return fail("missing_code");

    const pending = await this.repo.consumePending(payload.nonce, payload.userId, this.clock.now());
    if (!pending) return fail("expired");

    try {
      const verifier = decryptToken(pending.codeVerifierEnc, this.secrets.tokenKey);
      const tokens = await this.sf.exchangeCode(pending.loginUrl, input.code, verifier);
      const who = await this.sf.identity(tokens.instanceUrl, tokens.accessToken);
      await this.repo.upsert({
        userId: payload.userId,
        orgId: who.orgId,
        sfUserId: who.sfUserId,
        username: who.username,
        instanceUrl: tokens.instanceUrl,
        loginUrl: pending.loginUrl,
        accessTokenEnc: encryptToken(tokens.accessToken, this.secrets.tokenKey),
        refreshTokenEnc: encryptToken(tokens.refreshToken, this.secrets.tokenKey),
      });
      logEvent("salesforce.connected", { orgId: who.orgId });
      return withQuery(returnTo, { sf: "connected" });
    } catch (err) {
      logEvent("salesforce.connect_failed", { reason: "exchange", err }, "error");
      return withQuery(returnTo, { sf: "error", reason: "exchange" });
    }
  }

  async status(userId: string): Promise<ConnectionView | null> {
    const c = await this.repo.findByUser(userId);
    return c ? toView(c) : null;
  }

  /** Removes our copy. Revoking at Salesforce is left to the user's Connected Apps page for now. */
  async disconnect(userId: string): Promise<void> {
    if (await this.repo.delete(userId)) logEvent("salesforce.disconnected");
  }

  async executeAnonymous(userId: string, apex: string): Promise<ApexExecutionResult> {
    const result = await this.withOrg(userId, (org) => this.sf.executeAnonymous(org.instanceUrl, org.accessToken, apex));
    logEvent("apex.executed", { compiled: result.compiled, success: result.success, chars: apex.length });
    return result;
  }

  /**
   * Runs `fn` against the user's org with a live access token, refreshing once
   * on an expired session. The token never leaves this call.
   */
  async withOrg<T>(userId: string, fn: (org: OrgSession) => Promise<T>): Promise<T> {
    const conn = await this.repo.findByUser(userId);
    if (!conn) throw new OrgNotConnectedError();

    try {
      return await fn({ orgId: conn.orgId, instanceUrl: conn.instanceUrl, accessToken: decryptToken(conn.accessTokenEnc, this.secrets.tokenKey) });
    } catch (err) {
      if (!(err instanceof SessionExpiredError)) throw err;
    }

    let refreshed;
    try {
      refreshed = await this.sf.refresh(conn.loginUrl, decryptToken(conn.refreshTokenEnc, this.secrets.tokenKey));
    } catch (err) {
      if (err instanceof RefreshRevokedError) {
        // The stored connection can never work again; drop it so the UI asks to reconnect.
        await this.repo.delete(userId);
        throw new OrgNotConnectedError("Your Salesforce connection expired or was revoked. Connect again.");
      }
      throw err;
    }
    await this.repo.updateAccessToken(userId, encryptToken(refreshed.accessToken, this.secrets.tokenKey), refreshed.instanceUrl);
    logEvent("salesforce.token_refreshed");
    return fn({ orgId: conn.orgId, instanceUrl: refreshed.instanceUrl, accessToken: refreshed.accessToken });
  }
}

function withQuery(path: string, params: Record<string, string>): string {
  const url = new URL(path, "http://placeholder");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return `${url.pathname}${url.search}`;
}

