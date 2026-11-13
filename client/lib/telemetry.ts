/** Sends crash reports and page views to our own server. Best effort: never throws, never blocks. */
import { API_BASE_URL } from "./apiClient";

const MAX_REPORTS_PER_PAGE = 10;
let sent = 0;
const seen = new Set<string>();

function post(path: string, body: unknown, token?: string | null) {
  try {
    void fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}

export function reportError(error: unknown, token?: string | null) {
  const e = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Non-Error thrown");
  const key = `${e.name}:${e.message}`;
  // The same error repeating (a render loop) is one report, and a page sends at most a handful.
  if (seen.has(key) || sent >= MAX_REPORTS_PER_PAGE) return;
  seen.add(key);
  sent++;
  post("/api/v1/telemetry/error", { name: e.name, message: e.message, stack: e.stack ?? null, path: window.location.pathname }, token);
}

export function reportPageView(path: string) {
  post("/api/v1/telemetry/view", { path });
}
