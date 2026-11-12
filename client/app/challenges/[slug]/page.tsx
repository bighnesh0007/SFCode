"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/apiClient";
import { getChallenge, type ChallengeView } from "@/lib/challengesApi";
import { Workspace } from "./Workspace";

export default function ChallengePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
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
        <Link href="/challenges" className="text-sm text-primary underline">Back to challenges</Link>
      </div>
    );
  if (!challenge)
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  return <Workspace challenge={challenge} />;
}
