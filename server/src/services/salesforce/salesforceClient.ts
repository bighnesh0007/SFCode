/**
 * HTTP calls to Salesforce: the OAuth token endpoint, userinfo, and the Apex SOAP
 * API. No persistence and no Express — the connection service owns those.
 *
 * Anonymous Apex goes through SOAP rather than the Tooling REST
 * `executeAnonymous` GET because SOAP (1) takes the body in a POST, so code
 * length is not capped by URL limits, and (2) returns the debug log in the same
 * response via DebuggingHeader, where REST needs a TraceFlag + ApexLog query.
 */
import { XMLParser } from "fast-xml-parser";
import { UpstreamError } from "../../errors/AppError.ts";
import type { FetchLike } from "../../types/ports.ts";
import { normaliseSalesforceOrigin } from "./loginUrl.ts";

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  instanceUrl: string;
}

export interface OrgIdentity {
  orgId: string;
  sfUserId: string;
  username: string;
}

export interface ApexExecutionResult {
  compiled: boolean;
  success: boolean;
  compileProblem: string | null;
  exceptionMessage: string | null;
  exceptionStackTrace: string | null;
  line: number | null;
  column: number | null;
  debugLog: string;
}

/** Salesforce rejected the session — the caller should refresh and retry once. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Salesforce session expired.");
    this.name = "SessionExpiredError";
  }
}

/** The refresh token itself is no longer valid (revoked, user deactivated, app policy). */
export class RefreshRevokedError extends Error {
  constructor() {
    super("Salesforce refresh token was rejected.");
    this.name = "RefreshRevokedError";
  }
}

export interface SalesforceClientOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  apiVersion: string;
  timeoutMs: number;
  fetch?: FetchLike;
}

const xml = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true, parseTagValue: false });

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c);
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v === "" ? null : v;
  return null;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export class SalesforceClient {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly opts: SalesforceClientOptions) {
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  authorizeUrl(loginUrl: string, state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.opts.clientId,
      redirect_uri: this.opts.redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      scope: "api refresh_token",
      prompt: "login consent",
    });
    return `${loginUrl}/services/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCode(loginUrl: string, code: string, codeVerifier: string): Promise<TokenResponse & { refreshToken: string }> {
    const tokens = await this.tokenRequest(loginUrl, {
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      redirect_uri: this.opts.redirectUri,
    });
    if (!tokens.refreshToken) {
      // Without one we could not keep the connection alive past the session timeout.
      throw new UpstreamError("Salesforce did not issue a refresh token. Enable the refresh_token scope on the app.");
    }
    return { ...tokens, refreshToken: tokens.refreshToken };
  }

  async refresh(loginUrl: string, refreshToken: string): Promise<TokenResponse> {
    return this.tokenRequest(loginUrl, { grant_type: "refresh_token", refresh_token: refreshToken });
  }

  async identity(instanceUrl: string, accessToken: string): Promise<OrgIdentity> {
    const res = await this.send(`${instanceUrl}/services/oauth2/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 401) throw new SessionExpiredError();
    if (!res.ok) throw new UpstreamError(`Salesforce userinfo failed (HTTP ${res.status}).`);
    const body = (await res.json()) as Record<string, unknown>;
    const orgId = str(body.organization_id);
    const sfUserId = str(body.user_id);
    const username = str(body.preferred_username);
    if (!orgId || !sfUserId || !username) throw new UpstreamError("Salesforce userinfo response was incomplete.");
    return { orgId, sfUserId, username };
  }

  async executeAnonymous(instanceUrl: string, accessToken: string, apex: string): Promise<ApexExecutionResult> {
    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:apex="http://soap.sforce.com/2006/08/apex">
  <soapenv:Header>
    <apex:SessionHeader><apex:sessionId>${escapeXml(accessToken)}</apex:sessionId></apex:SessionHeader>
    <apex:DebuggingHeader>
      <apex:categories><apex:category>Apex_code</apex:category><apex:level>DEBUG</apex:level></apex:categories>
      <apex:categories><apex:category>Db</apex:category><apex:level>INFO</apex:level></apex:categories>
      <apex:categories><apex:category>Apex_profiling</apex:category><apex:level>INFO</apex:level></apex:categories>
      <apex:debugLevel>NONE</apex:debugLevel>
    </apex:DebuggingHeader>
  </soapenv:Header>
  <soapenv:Body>
    <apex:executeAnonymous><apex:String>${escapeXml(apex)}</apex:String></apex:executeAnonymous>
  </soapenv:Body>
</soapenv:Envelope>`;

    const res = await this.send(`${instanceUrl}/services/Soap/s/${this.opts.apiVersion}`, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=UTF-8", SOAPAction: '""' },
      body: envelope,
    });
    const text = await res.text();
    const doc = xml.parse(text) as { Envelope?: { Header?: unknown; Body?: Record<string, unknown> } };
    const body = doc.Envelope?.Body;

    const fault = body?.Fault as { faultcode?: unknown; faultstring?: unknown } | undefined;
    if (fault) {
      const code = str(fault.faultcode) ?? "";
      if (code.includes("INVALID_SESSION_ID")) throw new SessionExpiredError();
      throw new UpstreamError(`Salesforce rejected the request: ${str(fault.faultstring) ?? code}`);
    }
    if (!res.ok || !body) throw new UpstreamError(`Salesforce Apex API failed (HTTP ${res.status}).`);

    const result = (body.executeAnonymousResponse as { result?: Record<string, unknown> } | undefined)?.result ?? {};
    const header = doc.Envelope?.Header as { DebuggingInfo?: { debugLog?: unknown } } | undefined;

    return {
      compiled: result.compiled === "true",
      success: result.success === "true",
      compileProblem: str(result.compileProblem),
      exceptionMessage: str(result.exceptionMessage),
      exceptionStackTrace: str(result.exceptionStackTrace),
      line: num(result.line),
      column: num(result.column),
      debugLog: str(header?.DebuggingInfo?.debugLog) ?? "",
    };
  }

  private async tokenRequest(loginUrl: string, params: Record<string, string>): Promise<TokenResponse> {
    const res = await this.send(`${loginUrl}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ ...params, client_id: this.opts.clientId, client_secret: this.opts.clientSecret }).toString(),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      if (params.grant_type === "refresh_token" && body.error === "invalid_grant") throw new RefreshRevokedError();
      // Salesforce's error_description is user-meaningful ("expired authorization code").
      throw new UpstreamError(`Salesforce sign-in failed: ${str(body.error_description) ?? str(body.error) ?? `HTTP ${res.status}`}`);
    }
    const accessToken = str(body.access_token);
    const instanceUrl = normaliseSalesforceOrigin(str(body.instance_url) ?? "");
    if (!accessToken || !instanceUrl) throw new UpstreamError("Salesforce token response was incomplete or named an unexpected host.");
    const refreshToken = str(body.refresh_token);
    return { accessToken, instanceUrl, ...(refreshToken ? { refreshToken } : {}) };
  }

  private send(url: string, init: RequestInit): Promise<Response> {
    // `redirect: "error"` so a 3xx can never carry a bearer token to another host.
    return this.fetchImpl(url, { ...init, redirect: "error", signal: AbortSignal.timeout(this.opts.timeoutMs) });
  }
}
