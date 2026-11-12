"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, Briefcase, Bug, Check, Coins, Copy, Database, Flame, Code2, Gauge, Link2, Map as MapIcon, MapPin, Medal, Mountain, Share2, Sparkles, Swords, Timer, Trophy, Workflow, Zap } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { CERTIFICATIONS, updateMyAbout, type ProfileView as Profile } from "@/lib/communityApi";
import { trackInfo } from "@/lib/tracks";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Award> = { sparkles: Sparkles, database: Database, zap: Zap, bug: Bug, workflow: Workflow, gauge: Gauge, timer: Timer, mountain: Mountain, trophy: Trophy, flame: Flame, swords: Swords, medal: Medal, map: MapIcon };

/** Headline numbers. */
export function StatsStrip({ p }: { p: Profile }) {
  const tiles = [
    { label: "Streak", value: p.stats.streak ? `${p.stats.streak}d` : "0", hint: `Longest ${p.stats.longestStreak}d`, icon: Flame, tone: p.stats.streak > 0 ? "text-orange-500" : "text-muted-foreground", glow: p.stats.streak >= 3 },
    { label: "Points", value: String(p.score), hint: `${p.solved} solved`, icon: Trophy, tone: "text-amber-500" },
    { label: "Rank", value: p.rank ? `#${p.rank}` : "—", hint: "All time", icon: Medal, tone: "text-sky-500" },
    { label: "Coins", value: p.stats.coins === null ? "—" : String(p.stats.coins), hint: "Spend in the store", icon: Coins, tone: "text-yellow-500" },
    { label: "Contests", value: String(p.stats.contests), hint: p.stats.bestPlacement ? `Best #${p.stats.bestPlacement}` : "No finishes yet", icon: Swords, tone: "text-violet-500" },
    { label: "Active days", value: String(p.stats.activeDays), hint: "Last 12 months", icon: Sparkles, tone: "text-emerald-500" },
  ];
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border bg-card p-3 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><t.icon className={cn("h-3.5 w-3.5", t.tone, t.glow && "animate-pulse")} />{t.label}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{t.value}</div>
          <div className="text-[11px] text-muted-foreground">{t.hint}</div>
        </div>
      ))}
    </div>
  );
}

/** Solved share per track on a radar; reads at a glance where someone is strong. */
export function SkillRadar({ p }: { p: Profile }) {
  const axes = p.byTrack.map((t) => ({ label: trackInfo(t.track).label, v: t.total ? t.solved / t.total : 0, solved: t.solved, total: t.total }));
  const n = axes.length;
  const cx = 110, cy = 105, R = 78;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const poly = (r: (i: number) => number) => axes.map((_, i) => pt(i, r(i)).join(",")).join(" ");
  return (
    <section className="rounded-xl border p-5">
      <h2 className="text-sm font-semibold">Skills</h2>
      <svg viewBox="-40 0 300 210" className="mx-auto mt-2 w-full max-w-sm" role="img" aria-label={axes.map((a) => `${a.label} ${a.solved} of ${a.total}`).join(", ")}>
        {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={poly(() => R * f)} className="fill-none stroke-border" />)}
        {axes.map((_, i) => <line key={i} x1={cx} y1={cy} x2={pt(i, R)[0]} y2={pt(i, R)[1]} className="stroke-border" />)}
        <polygon points={poly((i) => R * Math.max(0.04, axes[i]?.v ?? 0))} className="fill-sky-500/25 stroke-sky-500 transition-all duration-700" strokeWidth={2} />
        {axes.map((a, i) => {
          const [x, y] = pt(i, R + 16);
          return <text key={a.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[9px]">{a.label} {a.solved}/{a.total}</text>;
        })}
      </svg>
    </section>
  );
}

export function AchievementsWall({ p }: { p: Profile }) {
  const earned = p.achievements.filter((a) => a.earned).length;
  return (
    <section className="rounded-xl border p-5">
      <h2 className="text-sm font-semibold">Achievements <span className="font-normal text-muted-foreground">{earned}/{p.achievements.length}</span></h2>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        {p.achievements.map((a) => {
          const Icon = ICONS[a.icon] ?? Award;
          const pct = Math.round((100 * a.progress.current) / a.progress.target);
          return (
            <li key={a.id} title={`${a.description} (${a.progress.current}/${a.progress.target})`} className={cn("group flex flex-col items-center rounded-lg border p-3 text-center transition-all", a.earned ? "border-amber-400/50 bg-gradient-to-b from-amber-400/15 to-transparent hover:shadow-[0_0_18px_rgba(251,191,36,0.35)]" : "opacity-60 grayscale hover:opacity-90")}>
              <span className={cn("grid h-10 w-10 place-items-center rounded-full", a.earned ? "bg-amber-400/25 text-amber-600 dark:text-amber-300 group-hover:animate-[bounce_0.6s_1]" : "bg-muted text-muted-foreground")}><Icon className="h-5 w-5" /></span>
              <span className="mt-2 text-xs font-medium leading-tight">{a.title}</span>
              {!a.earned && <span className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted"><span className="block h-full bg-sky-500" style={{ width: `${pct}%` }} /></span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ContestHistory({ p }: { p: Profile }) {
  if (p.contests.length === 0) return null;
  return (
    <section className="rounded-xl border p-5">
      <h2 className="mb-3 text-sm font-semibold">Contests</h2>
      <ul className="divide-y text-sm">
        {p.contests.map((c) => (
          <li key={c.slug} className="flex items-center gap-3 py-2">
            <span className={cn("w-10 font-semibold tabular-nums", c.rank <= 3 && "text-amber-500")}>#{c.rank}</span>
            <Link href={`/contests/${c.slug}`} className="min-w-0 flex-1 truncate hover:text-primary">{c.title}</Link>
            <span className="text-xs text-muted-foreground">{c.score} pts · of {c.entrants}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RoadmapProgress({ p, editable }: { p: Profile; editable: boolean }) {
  if (!p.roadmap) return null;
  const pct = p.roadmap.total ? Math.round((100 * p.roadmap.done) / p.roadmap.total) : 0;
  return (
    <section className="rounded-xl border p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{p.roadmap.title} roadmap</h2>
        {editable && <Link href="/roadmap" className="text-xs text-sky-600 hover:underline dark:text-sky-400">Continue →</Link>}
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-700" style={{ width: `${pct}%` }} /></div>
      <p className="mt-1.5 text-xs text-muted-foreground">{p.roadmap.done} of {p.roadmap.total} steps · {pct}%</p>
    </section>
  );
}

export function ShareButtons({ p }: { p: Profile }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? `https://sf.bighnesh.space/u/${p.handle}` : `${window.location.origin}/u/${p.handle}`;
  const text = `I've solved ${p.solved} Salesforce problems (${p.score} points) on SFCode`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs hover:bg-accent" target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}><Link2 className="h-3.5 w-3.5" /> Share</a>
      <a className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs hover:bg-accent" target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}><Share2 className="h-3.5 w-3.5" /> Post</a>
      <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs hover:bg-accent" onClick={() => void navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

const TRAILHEAD_ICON = Award;

export function AboutCard({ p, editable, onChange }: { p: Profile; editable: boolean; onChange: (p: Profile) => void }) {
  const { getToken } = useAuthState();
  const a = p.about;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bio: a.bio, company: a.company, location: a.location, trailheadUrl: a.trailheadUrl ?? "", linkedinUrl: a.linkedinUrl ?? "", githubUrl: a.githubUrl ?? "", certifications: a.certifications, openToWork: a.openToWork });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const empty = !a.bio && !a.company && !a.location && !a.trailheadUrl && !a.linkedinUrl && !a.githubUrl && a.certifications.length === 0 && !a.openToWork;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onChange(await updateMyAbout(await getToken(), form));
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    const input = "h-9 w-full rounded-md border bg-background px-2 text-sm";
    return (
      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-sm font-semibold">About you</h2>
        <textarea aria-label="Bio" placeholder="A line about you: what you build, what you're learning." value={form.bio} maxLength={280} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="min-h-20 w-full rounded-md border bg-background p-2 text-sm" />
        <div className="grid gap-2 sm:grid-cols-2">
          <input aria-label="Company" placeholder="Company" maxLength={80} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={input} />
          <input aria-label="Location" placeholder="Location" maxLength={80} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={input} />
        </div>
        <input aria-label="Trailblazer profile URL" placeholder="https://www.salesforce.com/trailblazer/you" value={form.trailheadUrl} onChange={(e) => setForm({ ...form, trailheadUrl: e.target.value })} className={input} />
        <input aria-label="LinkedIn URL" placeholder="https://www.linkedin.com/in/you" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} className={input} />
        <input aria-label="GitHub URL" placeholder="https://github.com/you" value={form.githubUrl} onChange={(e) => setForm({ ...form, githubUrl: e.target.value })} className={input} />
        <fieldset>
          <legend className="mb-1.5 text-xs text-muted-foreground">Certifications</legend>
          <div className="flex flex-wrap gap-1.5">
            {CERTIFICATIONS.map((c) => {
              const on = form.certifications.includes(c);
              return <button key={c} type="button" aria-pressed={on} onClick={() => setForm({ ...form, certifications: on ? form.certifications.filter((x) => x !== c) : [...form.certifications, c] })} className={cn("rounded-full border px-2.5 py-1 text-xs", on && "border-sky-500 bg-sky-500/10")}>{c}</button>;
            })}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.openToWork} onChange={(e) => setForm({ ...form, openToWork: e.target.checked })} /> Open to work</label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => void save()}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">About</h2>
        {editable && <button type="button" onClick={() => setEditing(true)} className="text-xs text-sky-600 hover:underline dark:text-sky-400">{empty ? "Add details" : "Edit"}</button>}
      </div>
      {empty ? (
        <p className="mt-3 text-sm text-muted-foreground">{editable ? "Add a bio, your certifications and links so others can find you." : "Nothing here yet."}</p>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          {a.openToWork && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"><Briefcase className="h-3 w-3" /> Open to work</span>}
          {a.bio && <p className="whitespace-pre-line">{a.bio}</p>}
          {(a.company || a.location) && (
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              {a.company && <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{a.company}</span>}
              {a.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{a.location}</span>}
            </p>
          )}
          {a.certifications.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {a.certifications.map((c) => <span key={c} className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-xs"><Award className="h-3 w-3 text-sky-500" />{c}</span>)}
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-xs">
            {a.trailheadUrl && <a href={a.trailheadUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 hover:text-primary"><TRAILHEAD_ICON className="h-3.5 w-3.5" /> Trailblazer</a>}
            {a.linkedinUrl && <a href={a.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 hover:text-primary"><Link2 className="h-3.5 w-3.5" /> LinkedIn</a>}
            {a.githubUrl && <a href={a.githubUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 hover:text-primary"><Code2 className="h-3.5 w-3.5" /> GitHub</a>}
          </div>
        </div>
      )}
    </section>
  );
}
