/**
 * Ports (interfaces) for everything the services depend on that touches the
 * outside world. Constructor-injecting these is what lets unit tests run with
 * trivial fakes instead of a network, a clock, or a Clerk instance.
 */

/** `globalThis.fetch`, narrowed so tests can substitute a stub. */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** Injectable time source; makes TTLs and durations deterministic in tests. */
export interface Clock {
  now(): Date;
  nowMs(): number;
}

export const systemClock: Clock = {
  now: () => new Date(),
  nowMs: () => Date.now(),
};

/** Verified identity extracted from a bearer token. */
export interface VerifiedIdentity {
  userId: string;
  sessionId?: string;
  /** Raw JWT claims, for anything not surfaced above. */
  claims?: Record<string, unknown>;
}

/** Wraps Clerk's `verifyToken`. */
export interface TokenVerifier {
  verify(token: string): Promise<VerifiedIdentity>;
}
