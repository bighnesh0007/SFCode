import "server-only";

/**
 * Fetches from the Express API during server rendering. The browser goes
 * through the /backend proxy; the server talks to the API directly.
 * Responses are cached for `revalidate` seconds so crawlers don't hammer it.
 */
const BASE = (process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:4100").replace(/\/+$/, "");
// During `next build` the build's workers saturate the CPU the API shares, and
// 4s requests timed out, silently prerendering pages without their data.
const TIMEOUT_MS = process.env.NEXT_PHASE === "phase-production-build" ? 30_000 : 4000;

// T is the caller's declared shape of the API's data; nothing checks it at runtime.
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
/** `missing` is a definite 404 from the API; `null` data otherwise means it couldn't be reached. */
export async function serverFetch<T>(path: string, revalidate = 600): Promise<{ data: T | null; missing: boolean }> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 404) return { data: null, missing: true };
    if (!res.ok) return { data: null, missing: false };
    const body = (await res.json()) as { success?: boolean; data?: T };
    return { data: body.success ? (body.data ?? null) : null, missing: false };
  } catch {
    return { data: null, missing: false };
  }
}

/** The data, or null on any failure: pages then fall back to loading in the browser. */
export const serverApi = async <T,>(path: string, revalidate = 600): Promise<T | null> => (await serverFetch<T>(path, revalidate)).data;

/**
 * For cached pages (landing pages, the sitemap): at runtime a failed fetch throws,
 * so Next keeps serving the last good copy instead of caching an empty one for the
 * whole revalidate window. During `next build` (CI has no API) it returns null.
 */
export async function serverApiOrKeepStale<T>(path: string, revalidate = 600): Promise<T | null> {
  const data = await serverApi<T>(path, revalidate);
  if (data === null && process.env.NEXT_PHASE !== "phase-production-build") throw new Error(`API unavailable: ${path}`);
  return data;
}
/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */
