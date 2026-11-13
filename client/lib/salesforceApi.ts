/** Typed calls to the backend's /api/v1/salesforce surface. */
import { API_BASE_URL, apiRequest } from "./apiClient";

export interface OrgConnection {
  orgId: string;
  username: string;
  instanceUrl: string;
  environment: "production" | "sandbox" | "custom";
  connectedAt: string;
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

type Token = string | null;

export async function getConnection(token: Token): Promise<OrgConnection | null> {
  return (await apiRequest<{ connection: OrgConnection | null }>("/api/v1/salesforce/connection", { token })).connection;
}

export async function startConnect(token: Token, loginUrl: string, returnTo: string): Promise<string> {
  const { authorizeUrl } = await apiRequest<{ authorizeUrl: string }>("/api/v1/salesforce/connect", {
    method: "POST",
    token,
    body: { loginUrl, returnTo },
  });
  return authorizeUrl;
}

export async function disconnect(token: Token): Promise<void> {
  await fetch(`${API_BASE_URL}/api/v1/salesforce/connection`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then((r) => {
    if (!r.ok && r.status !== 204) throw new Error(`Disconnect failed (HTTP ${r.status}).`);
  });
}

export function executeAnonymous(token: Token, code: string, signal?: AbortSignal): Promise<ApexExecutionResult> {
  return apiRequest<ApexExecutionResult>("/api/v1/salesforce/apex/execute", {
    method: "POST",
    token,
    body: { code },
    ...(signal ? { signal } : {}),
  });
}

export interface SoqlQueryResult {
  totalSize: number;
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
}

export function runSoql(token: Token, soql: string, signal?: AbortSignal): Promise<SoqlQueryResult> {
  return apiRequest<SoqlQueryResult>("/api/v1/salesforce/soql/query", {
    method: "POST",
    token,
    body: { soql },
    ...(signal ? { signal } : {}),
  });
}
