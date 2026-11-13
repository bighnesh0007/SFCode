"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuthState } from "@/components/auth";
import { reportError, reportPageView } from "@/lib/telemetry";

/** Reports uncaught errors and counts page views (no cookies, nothing per visitor). */
export function Telemetry() {
  const pathname = usePathname();
  const { getToken } = useAuthState();
  const tokenRef = useRef(getToken);
  useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    // Errors from browser extensions and third-party scripts aren't ours to fix.
    const ours = (filename?: string) => !filename || filename.startsWith(window.location.origin);
    const onError = (e: ErrorEvent) => {
      if (!ours(e.filename)) return;
      void tokenRef.current().then((t) => reportError(e.error ?? e.message, t), () => reportError(e.error ?? e.message));
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      void tokenRef.current().then((t) => reportError(e.reason, t), () => reportError(e.reason));
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    if (pathname) reportPageView(pathname);
  }, [pathname]);

  return null;
}
