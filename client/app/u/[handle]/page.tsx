"use client";

import { use, useEffect, useState } from "react";
import { useAuthState } from "@/components/auth";
import { ProfileView } from "@/components/ProfileView";
import { ApiError } from "@/lib/apiClient";
import { getMyProfile, getProfile, type ProfileView as Profile } from "@/lib/communityApi";
import { PageSkeleton } from "@/components/ui/skeleton";

export default function UserPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = use(params);
  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const [state, setState] = useState<{ profile: Profile; mine: boolean } | { error: string } | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    void (async () => {
      try {
        const profile = await getProfile(handle);
        // Editable only if it's the signed-in user's own profile.
        const mine = isSignedIn ? (await getMyProfile(await getToken())).handle.toLowerCase() === profile.handle.toLowerCase() : false;
        if (!cancelled) setState({ profile, mine });
      } catch (err) {
        if (!cancelled) setState({ error: err instanceof ApiError ? err.message : "Could not load this profile." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, isLoaded, isSignedIn, getToken]);

  if (state === null)
    return (
      <PageSkeleton blocks={3} />
    );
  if ("error" in state) return <p className="py-24 text-center text-muted-foreground">{state.error}</p>;
  return <ProfileView profile={state.profile} editable={state.mine} />;
}
