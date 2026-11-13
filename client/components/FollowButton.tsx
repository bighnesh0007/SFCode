"use client";

import { useEffect, useState } from "react";
import { UserCheck, UserPlus } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { getSocial, setFollow, type SocialInfo } from "@/lib/socialApi";

/** Follower / following counts, plus a Follow button on other people's profiles. */
export function FollowButton({ handle }: { handle: string }) {
  const { isSignedIn, getToken } = useAuthState();
  const [info, setInfo] = useState<SocialInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getToken()
      .then((t) => getSocial(t, handle))
      .then((s) => !cancelled && setInfo(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getToken, handle, isSignedIn]);

  async function toggle() {
    if (!info) return;
    setBusy(true);
    try {
      setInfo(await setFollow(await getToken(), handle, !info.isFollowing));
    } finally {
      setBusy(false);
    }
  }

  if (!info) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span><b className="tabular-nums">{info.followers}</b> <span className="text-muted-foreground">followers</span></span>
      <span><b className="tabular-nums">{info.following}</b> <span className="text-muted-foreground">following</span></span>
      {isSignedIn && !info.isMe && (
        <Button size="sm" variant={info.isFollowing ? "outline" : "default"} disabled={busy} onClick={() => void toggle()}>
          {info.isFollowing ? <UserCheck className="mr-1 h-3.5 w-3.5" /> : <UserPlus className="mr-1 h-3.5 w-3.5" />}
          {info.isFollowing ? "Following" : "Follow"}
        </Button>
      )}
    </div>
  );
}
