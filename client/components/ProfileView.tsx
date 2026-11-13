"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { RankBadge } from "@/components/RankBadge";
import { AboutCard, AchievementsWall, ContestHistory, RoadmapProgress, ShareButtons, SkillRadar, StatsStrip } from "@/components/profile/Sections";
import { Flair, accentClass, frameClass } from "@/components/Cosmetics";
import { useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { updateMyProfile, type ProfileView as Profile } from "@/lib/communityApi";
import { trackInfo } from "@/lib/tracks";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;

/** 53 weeks × 7 days, UTC, oldest first; darker = more submissions that day. */
function Heatmap({ activity }: { activity: Profile["activity"] }) {
  const counts = new Map(activity.map((a) => [a.day, a.count]));
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const start = today - (52 * 7 + new Date(today).getUTCDay()) * DAY;
  const days = Array.from({ length: Math.round((today - start) / DAY) + 1 }, (_, i) => {
    const day = new Date(start + i * DAY).toISOString().slice(0, 10);
    return { day, count: counts.get(day) ?? 0 };
  });
  const level = (n: number) => (n === 0 ? "bg-muted" : n < 2 ? "bg-primary/30" : n < 4 ? "bg-primary/60" : "bg-primary");
  const total = activity.reduce((n, a) => n + a.count, 0);
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">{total} submission{total === 1 ? "" : "s"} in the last year</p>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px] overflow-x-auto pb-1" role="img" aria-label={`Activity heatmap: ${total} submissions in the last year`}>
        {days.map((d) => (
          <span key={d.day} title={`${d.day}: ${d.count}`} className={cn("h-2.5 w-2.5 rounded-[2px]", level(d.count))} />
        ))}
      </div>
    </div>
  );
}

function Bar({ label, solved, total }: { label: string; solved: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((solved / total) * 100);
  return (
    <div className="text-sm">
      <div className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{solved}/{total}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${solved} of ${total}`}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ProfileView({ profile: initial, editable }: { profile: Profile; editable: boolean }) {
  const { getToken } = useAuthState();
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [handle, setHandle] = useState(initial.handle);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      const next = await updateMyProfile(await getToken(), {
        ...(handle !== profile.handle ? { handle } : {}),
        ...(displayName !== profile.displayName ? { displayName } : {}),
      });
      setProfile(next);
      setEditing(false);
      if (next.handle !== initial.handle) router.replace(`/u/${next.handle}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={profile.imageUrl} name={profile.displayName} size={64} className={frameClass(profile.cosmetics.frame)} />
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <input aria-label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} className="h-9 rounded-md border bg-background px-2 text-sm" />
              <span className="text-sm text-muted-foreground">@</span>
              <input aria-label="Handle" value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={30} className="h-9 w-40 rounded-md border bg-background px-2 font-mono text-sm" />
              <Button size="sm" onClick={() => void save()}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setError(null); setHandle(profile.handle); setDisplayName(profile.displayName); }}>Cancel</Button>
            </div>
          ) : (
            <>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <span className={accentClass(profile.cosmetics.accent)}>{profile.displayName}</span>
                <Flair badge={profile.cosmetics.badge} />
                {editable && (
                  <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Edit profile">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <RankBadge id={profile.tier.id} title={profile.tier.title} />
                {profile.tier.next && (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground" title={`${profile.tier.points} of ${profile.tier.next.min} points`}>
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500" style={{ width: `${profile.tier.progress}%` }} /></span>
                    {profile.tier.next.min - profile.tier.points} pts to {profile.tier.next.title}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">@{profile.handle} · joined {new Date(profile.joined).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</p>
            </>
          )}
          {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
        </div>
        <ShareButtons p={profile} />
      </div>

      <StatsStrip p={profile} />

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <AboutCard p={profile} editable={editable} onChange={setProfile} />
        <SkillRadar p={profile} />
      </div>

      <div className="mt-6">
        <AchievementsWall p={profile} />
      </div>

      <div className={cn("mt-6 grid gap-6", (profile.roadmap || profile.contests.length > 0) && "md:grid-cols-2")}>
        <section className="rounded-xl border p-5">
          <h2 className="mb-4 text-sm font-semibold">By difficulty</h2>
          <div className="space-y-3">
            {profile.byDifficulty.map((d) => <Bar key={d.difficulty} label={d.difficulty} solved={d.solved} total={d.total} />)}
          </div>
        </section>
        <div className="space-y-6">
          <RoadmapProgress p={profile} editable={editable} />
          <ContestHistory p={profile} />
        </div>
      </div>

      <section className="mt-6 rounded-xl border p-5">
        <h2 className="mb-4 text-sm font-semibold">Activity</h2>
        <Heatmap activity={profile.activity} />
      </section>

      <section className="mt-6 rounded-lg border p-5">
        <h2 className="mb-3 text-sm font-semibold">Recently solved</h2>
        {profile.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing solved yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {profile.recent.map((r) => (
              <li key={r.slug} className="flex items-center justify-between gap-3 py-2">
                <Link href={`${trackInfo(r.track).base}/${r.slug}`} className="truncate hover:text-primary">{r.title}</Link>
                <span className="shrink-0 text-xs text-muted-foreground">{trackInfo(r.track).label} · {new Date(r.at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
