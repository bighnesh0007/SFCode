"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthState } from "@/components/auth";
import { getOnboarding } from "@/lib/roadmapApi";

/** Per-browser "not now", so skipping the quiz doesn't nag on every page. */
export const SKIP_KEY = "sfcode.onboarding.skipped";

/**
 * Sends a signed-in learner who hasn't done the welcome quiz to /welcome,
 * once. Renders nothing; any failure (API down, local mode) just doesn't redirect.
 */
export function OnboardingGate() {
  const { isSignedIn, getToken } = useAuthState();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isSignedIn || pathname.startsWith("/welcome")) return;
    try {
      if (localStorage.getItem(SKIP_KEY)) return;
    } catch {
      // storage blocked: still ask
    }
    let cancelled = false;
    getToken()
      .then((t) => getOnboarding(t))
      .then((ob) => {
        if (!cancelled && ob === null) router.replace(`/welcome?next=${encodeURIComponent(pathname)}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Checked once per sign-in, not on every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  return null;
}
