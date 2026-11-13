"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BrainCircuit } from "lucide-react";
import { SignInButton, useAuthState } from "@/components/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { getReview, type ReviewQueue } from "@/lib/certificationApi";
import { PracticeSession } from "../[exam]/PracticeSession";
import { PageSkeleton } from "@/components/ui/skeleton";

export default function ReviewPage() {
  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const [queue, setQueue] = useState<ReviewQueue | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    getToken()
      .then((t) => getReview(t))
      .then((q) => !cancelled && setQueue(q))
      .catch(() => !cancelled && setQueue({ due: [], upcoming: 0, nextDueAt: null, mastered: 0 }));
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  // Restarting the session refetches what's due now.
  const load = useCallback(async () => (await getReview(await getToken())).due, [getToken]);

  if (isLoaded && !isSignedIn)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-muted-foreground">Sign in to review the questions you&apos;ve missed.</p>
        <SignInButton><Button className="mt-4">Sign in</Button></SignInButton>
      </div>
    );
  if (!queue) return <PageSkeleton blocks={3} className="max-w-3xl" />;
  if (queue.due.length === 0)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <BrainCircuit className="mx-auto h-10 w-10 text-sky-700 dark:text-sky-400" />
        <h1 className="mt-3 text-xl font-semibold">Nothing due right now</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {queue.upcoming > 0 && queue.nextDueAt
            ? `${queue.upcoming} question${queue.upcoming === 1 ? "" : "s"} coming back; the next on ${new Date(queue.nextDueAt).toLocaleString()}.`
            : "Questions you miss in practice show up here to review later."}
          {queue.mastered > 0 && ` ${queue.mastered} mastered.`}
        </p>
        <Link href="/certification" className={`${buttonVariants({ variant: "outline" })} mt-6`}>Practice questions</Link>
      </div>
    );
  return <PracticeSession exam="review" section={null} load={load} title={`Review · ${queue.due.length} due`} />;
}
