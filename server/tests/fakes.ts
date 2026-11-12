import type { PendingHandshake, SalesforceConnectionRepository, StoredConnection } from "../src/repositories/salesforceConnection.repository.ts";
import type { Clock } from "../src/types/ports.ts";

export class MemoryConnectionRepository implements SalesforceConnectionRepository {
  readonly connections = new Map<string, StoredConnection>();
  readonly pending = new Map<string, PendingHandshake>();

  findByUser(userId: string) {
    return Promise.resolve(this.connections.get(userId) ?? null);
  }
  upsert(conn: Omit<StoredConnection, "connectedAt">) {
    this.connections.set(conn.userId, { ...conn, connectedAt: new Date(0) });
    return Promise.resolve();
  }
  updateAccessToken(userId: string, accessTokenEnc: string, instanceUrl: string) {
    const c = this.connections.get(userId);
    if (c) this.connections.set(userId, { ...c, accessTokenEnc, instanceUrl });
    return Promise.resolve();
  }
  delete(userId: string) {
    return Promise.resolve(this.connections.delete(userId));
  }
  savePending(p: PendingHandshake) {
    this.pending.set(p.nonce, p);
    return Promise.resolve();
  }
  consumePending(nonce: string, userId: string, now: Date) {
    const p = this.pending.get(nonce);
    this.pending.delete(nonce);
    return Promise.resolve(p?.userId === userId && p && p.expiresAt > now ? p : null);
  }
}

export function fixedClock(ms = 1_700_000_000_000): Clock & { advance(by: number): void } {
  let t = ms;
  return { now: () => new Date(t), nowMs: () => t, advance: (by) => (t += by) };
}

interface Call {
  url: string;
  init: RequestInit;
  /** `init.body` as text; every body this codebase sends is a string. */
  body: string;
}

/** Scripted fetch: each handler gets the call and returns a Response; calls are recorded. */
export function scriptedFetch(handler: (call: Call) => Response) {
  const calls: Call[] = [];
  const fn = (input: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: input instanceof Request ? input.url : String(input), init, body: typeof init.body === "string" ? init.body : "" };
    calls.push(call);
    return Promise.resolve(handler(call));
  };
  return Object.assign(fn, { calls });
}

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
