import type { ChallengeSubmissionRepository, SubmissionRecord } from "../src/repositories/challengeSubmission.repository.ts";
import type { GradeResult, SubmissionStatus } from "../src/domain/challenge.ts";
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


export class MemorySubmissionRepository implements ChallengeSubmissionRepository {
  readonly rows = new Map<string, SubmissionRecord>();
  private seq = 0;
  constructor(private readonly clock: Clock) {}

  createRunning(input: { userId: string; problemSlug: string; orgId: string; files: Record<string, string> }) {
    // Mirrors the partial unique index: one running submission per user.
    if ([...this.rows.values()].some((r) => r.userId === input.userId && r.status === "running")) return Promise.resolve(null);
    const id = `00000000-0000-4000-8000-${String(++this.seq).padStart(12, "0")}`;
    const row: SubmissionRecord = { id, ...input, status: "running", deployId: null, result: null, createdAt: this.clock.now(), checkedAt: null, completedAt: null };
    this.rows.set(id, row);
    return Promise.resolve({ ...row });
  }
  setDeployId(id: string, deployId: string) {
    const r = this.rows.get(id);
    if (r) r.deployId = deployId;
    return Promise.resolve();
  }
  markChecked(id: string, at: Date) {
    const r = this.rows.get(id);
    if (r) r.checkedAt = at;
    return Promise.resolve();
  }
  complete(id: string, status: Exclude<SubmissionStatus, "running">, result: GradeResult, at: Date) {
    const r = this.rows.get(id);
    if (r?.status !== "running") return Promise.resolve(false);
    Object.assign(r, { status, result, completedAt: at });
    return Promise.resolve(true);
  }
  findById(id: string) {
    const r = this.rows.get(id);
    return Promise.resolve(r ? { ...r } : null);
  }
  listForProblem(userId: string, problemSlug: string, limit: number) {
    return Promise.resolve(
      [...this.rows.values()].filter((r) => r.userId === userId && r.problemSlug === problemSlug).reverse().slice(0, limit),
    );
  }
  progress(userId: string) {
    const out = new Map<string, "solved" | "attempted">();
    for (const r of this.rows.values()) {
      if (r.userId !== userId) continue;
      if (r.status === "accepted") out.set(r.problemSlug, "solved");
      else if (!out.has(r.problemSlug)) out.set(r.problemSlug, "attempted");
    }
    return Promise.resolve(out);
  }
}
