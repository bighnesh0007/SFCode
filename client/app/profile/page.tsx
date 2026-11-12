"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SignInButton, useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { getMyProfile } from "@/lib/communityApi";

/** /profile → your own /u/<handle> (creating the profile on first visit). */
export default function MyProfile() {
  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    getToken()
      .then((t) => getMyProfile(t))
      .then((p) => router.replace(`/u/${p.handle}`))
      .catch(() => setError("Could not load your profile."));
  }, [isLoaded, isSignedIn, getToken, router]);

  if (isLoaded && !isSignedIn)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
        <p className="text-muted-foreground">Sign in to see your profile.</p>
        <SignInButton>
          <Button>Sign in</Button>
        </SignInButton>
      </div>
    );
  return <div className="flex flex-1 items-center justify-center py-24">{error ? <p className="text-destructive">{error}</p> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}</div>;
}
