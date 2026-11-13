"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown, Users } from "lucide-react";
import { SignInButton, useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { createTeam, joinTeam, myTeams, type TeamSummary } from "@/lib/hubApi";

export default function TeamsPage() {
  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const router = useRouter();
  const [teams, setTeams] = useState<TeamSummary[] | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    getToken().then(myTeams).then(setTeams).catch(() => setTeams([]));
  }, [isSignedIn, getToken]);

  async function go(fn: () => Promise<{ slug: string }>) {
    setError(null);
    try {
      router.push(`/teams/${(await fn()).slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Teams & cohorts</h1>
      <p className="mt-1 text-sm text-muted-foreground">Study with friends, a bootcamp cohort or your company: a private leaderboard, joined with a code.</p>
      {isLoaded && !isSignedIn ? (
        <div className="mt-8 rounded-xl border p-6 text-center"><p className="text-sm">Sign in to create or join a team.</p><SignInButton><Button className="mt-3">Sign in</Button></SignInButton></div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <form className="rounded-xl border p-4" onSubmit={(e) => { e.preventDefault(); void go(async () => createTeam(await getToken(), name)); }}>
              <h2 className="font-semibold">Create a team</h2>
              <input aria-label="Team name" placeholder="e.g. Pune Trailblazers" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="mt-3 h-9 w-full rounded-md border bg-background px-2 text-sm" />
              <Button className="mt-3" size="sm" disabled={name.trim().length < 3}>Create</Button>
            </form>
            <form className="rounded-xl border p-4" onSubmit={(e) => { e.preventDefault(); void go(async () => joinTeam(await getToken(), code)); }}>
              <h2 className="font-semibold">Join with a code</h2>
              <input aria-label="Join code" placeholder="8-character code" value={code} maxLength={16} onChange={(e) => setCode(e.target.value.toUpperCase())} className="mt-3 h-9 w-full rounded-md border bg-background px-2 font-mono text-sm uppercase tracking-widest" />
              <Button className="mt-3" size="sm" variant="outline" disabled={code.trim().length < 4}>Join</Button>
            </form>
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your teams</h2>
          <ul className="mt-3 divide-y rounded-xl border">
            {teams === null && <li className="p-4"><div className="h-5 animate-pulse rounded bg-muted" /></li>}
            {teams?.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No teams yet: create one or ask a friend for their code.</li>}
            {teams?.map((t) => (
              <li key={t.slug}>
                <Link href={`/teams/${t.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/60">
                  <Users className="h-4 w-4 text-sky-700 dark:text-sky-400" />
                  <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                  {t.owner && <Crown className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" aria-label="You own this team" />}
                  <span className="text-xs text-muted-foreground">{t.members} member{t.members === 1 ? "" : "s"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
