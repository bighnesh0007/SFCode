"use client";

import { useAuthState } from "@/components/auth";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import { getConnection, type OrgConnection } from "@/lib/salesforceApi";

export type OrgState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "unavailable"; message: string }
  | { kind: "disconnected" }
  | { kind: "connected"; connection: OrgConnection };

/** The signed-in user's org connection, re-fetchable after connect/disconnect. */
export function useOrgConnection(): { state: OrgState; refresh: () => void } {
  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const [fetched, setFetched] = useState<OrgState>({ kind: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    getToken()
      .then((token) => getConnection(token))
      .then((connection) => {
        if (!cancelled) setFetched(connection ? { kind: "connected", connection } : { kind: "disconnected" });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof ApiError && err.code === "NOT_CONFIGURED" ? err.message : "Could not reach the SFCode server.";
        setFetched({ kind: "unavailable", message });
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  // Auth status is derived, not stored, so signing out needs no effect to sync it.
  const state: OrgState = !isLoaded ? { kind: "loading" } : !isSignedIn ? { kind: "signed-out" } : fetched;
  return { state, refresh };
}
