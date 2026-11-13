"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Crown, RefreshCw } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { RankBadge } from "@/components/RankBadge";
import { useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { getTeam, leaveTeam, removeMember, rotateCode, type TeamView } from "@/lib/hubApi";
import { cn } from "@/lib/utils";

export default function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { isSignedIn, getToken } = useAuthState();
  const router = useRouter();
  const [team, setTeam] = useState<TeamView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    getToken()
      .then((t) => getTeam(t, slug))
      .then(setTeam)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Could not load the team."));
  }, [getToken, slug]);
  useEffect(load, [load, isSignedIn]);

  async function act(fn: (t: string | null) => Promise<TeamView>) {
    try {
      setTeam(await fn(await getToken()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work.");
    }
  }

  if (error && !team) return <div className="py-20 text-center text-sm text-muted-foreground">{error} <Link href="/teams" className="underline">Your teams</Link></div>;
  if (!team) return <div className="mx-auto max-w-3xl px-4 py-10"><div className="h-8 w-64 animate-pulse rounded bg-muted" /></div>;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/teams" className="text-sm text-muted-foreground hover:text-foreground">← Teams</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
        <span className="text-sm text-muted-foreground">{team.members.length} members</span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={async () => { if (!confirm(team.owner ? "Close this team for everyone?" : "Leave this team?")) return; await leaveTeam(await getToken(), slug); router.push("/teams"); }}>
          {team.owner ? "Close team" : "Leave"}
        </Button>
      </div>
      {team.joinCode && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-sm">
          <span>Invite code:</span>
          <code className="rounded bg-background px-2 py-1 font-mono text-base tracking-widest">{team.joinCode}</code>
          <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(team.joinCode ?? "").then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
            <Copy className="mr-1 h-3.5 w-3.5" /> {copied ? "Copied" : "Copy"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void act((t) => rotateCode(t, slug))} title="Old code stops working"><RefreshCw className="mr-1 h-3.5 w-3.5" /> New code</Button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <ol className="mt-6 divide-y rounded-xl border">
        {team.members.map((m) => (
          <li key={m.handle} className={cn("flex items-center gap-3 px-4 py-3 text-sm", m.me && "bg-sky-500/5")}>
            <span className={cn("w-6 tabular-nums", m.place <= 3 ? "font-semibold" : "text-muted-foreground")}>{m.place}</span>
            <Avatar src={m.imageUrl} name={m.displayName} size={28} />
            <Link href={`/u/${m.handle}`} className="min-w-0 flex-1 truncate font-medium hover:text-primary">{m.displayName}</Link>
            {m.owner && <Crown className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />}
            <RankBadge id={m.tier.id} title={m.tier.title} size="sm" className="hidden sm:inline-flex" />
            <span className="w-16 text-right font-semibold tabular-nums">{m.points} pts</span>
            {team.owner && !m.owner && <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => void act((t) => removeMember(t, slug, m.handle))}>Remove</button>}
          </li>
        ))}
      </ol>
    </div>
  );
}
