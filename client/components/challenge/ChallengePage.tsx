"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/apiClient";
import { getChallenge, type ChallengeView } from "@/lib/challengesApi";
import { LwcWorkspace } from "./LwcWorkspace";
import { Workspace } from "./Workspace";
import { WorkspaceSkeleton } from "@/components/ui/skeleton";

/** Loads one problem and renders the workspace. `backHref` is the list it belongs to. */
export function ChallengePage({ slug, backHref }: { slug: string; backHref: string }) {
  const [challenge, setChallenge] = useState<ChallengeView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getChallenge(slug)
      .then((c) => !cancelled && setChallenge(c))
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not load this challenge."));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-muted-foreground">{error}</p>
        <Link href={backHref} className="text-sm text-primary underline">Back to the list</Link>
      </div>
    );
  if (!challenge)
    return (
      <WorkspaceSkeleton />
    );
  return challenge.lwc ? <LwcWorkspace challenge={challenge} backHref={backHref} /> : <Workspace challenge={challenge} backHref={backHref} />;
}
