"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ban, Loader2, Megaphone, RotateCcw, X } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import {
  getAnnouncement,
  getAudit,
  getDashboard,
  getUserDetail,
  saveAnnouncement,
  setSuspended,
  type AdminUserDetail,
  type Announcement,
  type AnnouncementTone,
  type AuditRow,
  type DailyPoint,
  type ProblemRow,
  type Standing,
} from "@/lib/adminApi";
import { STATUS_LABEL } from "@/lib/verdicts";
import { cn } from "@/lib/utils";

const ROLE_LABEL = { admin: "Admin", reviewer: "Reviewer", buddy: "Buddy" } as const;

function useLoad<T>(fetcher: (token: string | null) => Promise<T>, deps: unknown[] = []) {
  const { getToken } = useAuthState();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getToken()
      .then(fetcher)
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Could not load."));
    return () => {
      cancelled = true;
    };
    // `fetcher` is an inline arrow; `deps` names what it really depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken, tick, ...deps]);
  return { data, error, reload: () => setTick((t) => t + 1) };
}

const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

// ── Dashboard ───────────────────────────────────────────────────────────────

const SERIES: { key: keyof Omit<DailyPoint, "day">; label: string }[] = [
  { key: "active", label: "Active learners" },
  { key: "submissions", label: "Submissions" },
  { key: "accepted", label: "Accepted" },
  { key: "signups", label: "Sign-ups" },
];

export function DashboardTab() {
  const { data, error } = useLoad(getDashboard);
  if (error) return <p className="mt-5 text-sm text-destructive">{error}</p>;
  if (!data) return <div className="mt-5 h-64 animate-pulse rounded-lg bg-muted/50" />;
  return (
    <section className="mt-5 space-y-6">
      <p className="text-xs text-muted-foreground">Last {data.days.length} days, UTC. Hover a bar for the day.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {SERIES.map((s) => (
          <DailyBars key={s.key} label={s.label} days={data.days} field={s.key} />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ProblemTable title="Most attempted" rows={data.top} empty="No graded submissions yet." />
        <ProblemTable title="Hardest (lowest acceptance)" rows={data.hardest} empty="No problem has 5+ graded submissions yet." />
      </div>
    </section>
  );
}

/** One measure per chart: a single hue, no legend needed, the title names it. */
function DailyBars({ label, days, field }: { label: string; days: DailyPoint[]; field: keyof Omit<DailyPoint, "day"> }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = days.map((d) => d[field]);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const shown = hover === null ? null : days[hover];
  return (
    <figure className="rounded-lg border p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {shown ? `${shortDate(shown.day)}: ${shown[field]}` : `${field === "active" ? "peak" : "total"} ${field === "active" ? Math.max(0, ...values) : total}`}
        </span>
      </figcaption>
      <div className="mt-3 flex h-28 items-end gap-[2px]" onMouseLeave={() => setHover(null)} role="img" aria-label={`${label} per day, ${field === "active" ? "peak" : "total"} ${field === "active" ? Math.max(0, ...values) : total}`}>
        {days.map((d, i) => {
          const v = d[field];
          return (
            // The hit target is the full column height, wider than the bar itself.
            <div key={d.day} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
              <div
                className={cn("w-full rounded-t-[3px] transition-colors", v === 0 ? "bg-muted" : hover === i ? "bg-primary" : "bg-primary/70")}
                style={{ height: v === 0 ? 2 : `${Math.max(4, (v / max) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{days[0] ? shortDate(days[0].day) : ""}</span>
        <span>{days.at(-1) ? shortDate(days.at(-1)?.day ?? "") : ""}</span>
      </div>
    </figure>
  );
}

function ProblemTable({ title, rows, empty }: { title: string; rows: ProblemRow[]; empty: string }) {
  return (
    <div className="rounded-lg border">
      <p className="border-b px-4 py-2.5 text-sm font-medium">{title}</p>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pl-4 font-normal">Problem</th>
              <th className="py-2 text-right font-normal">Tries</th>
              <th className="py-2 text-right font-normal">Solvers</th>
              <th className="py-2 pr-4 text-right font-normal">Accepted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="border-t">
                <td className="max-w-48 truncate py-2 pl-4">
                  <Link href={`/problems/${r.slug}`} className="hover:text-primary hover:underline">
                    {r.title}
                  </Link>
                </td>
                <td className="py-2 text-right tabular-nums">{r.submissions}</td>
                <td className="py-2 text-right tabular-nums">{r.solvers}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{r.rate === null ? "—" : `${r.rate}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── User detail drawer ───────────────────────────────────────────────────────

export function UserDrawer({ userId, view, onClose }: { userId: string; view: Standing; onClose: () => void }) {
  const { getToken } = useAuthState();
  const { data: u, error, reload } = useLoad((t) => getUserDetail(t, userId), [userId]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canSuspend = (view === "owner" || view === "admin") && u && !u.owner && !(view === "admin" && u.roles.includes("admin"));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function toggle(user: AdminUserDetail) {
    const next = !user.suspended;
    let reason = "";
    if (next) {
      const r = window.prompt(`Suspend @${user.handle}? They are signed out everywhere and can't sign in until restored.\n\nReason (kept in the audit log):`);
      if (r === null) return;
      reason = r;
    }
    setBusy(true);
    setMessage(null);
    try {
      await setSuspended(await getToken(), user.userId, next, reason);
      setMessage(next ? "Suspended." : "Restored.");
      reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not change the suspension.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label="Learner details" className="h-full w-full max-w-md overflow-y-auto border-l bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">Learner</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-md p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {!u && !error && <Loader2 className="mt-8 h-5 w-5 animate-spin text-muted-foreground" />}
        {u && (
          <div className="mt-4 space-y-5">
            <div className="flex items-center gap-3">
              {u.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.imageUrl} alt="" className="h-12 w-12 rounded-full" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-muted" />
              )}
              <div className="min-w-0">
                <Link href={`/u/${u.handle}`} className="block truncate font-medium hover:text-primary">
                  {u.displayName}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  @{u.handle} · {u.owner ? "Owner" : u.roles.map((r) => ROLE_LABEL[r]).join(", ") || "Learner"}
                </p>
              </div>
              {u.suspended && <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Suspended</span>}
            </div>

            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Solved", u.solved],
                ["Submissions", u.submissions],
                ["Cert answers", u.certAnswers],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-muted/50 p-2">
                  <dt className="text-[11px] text-muted-foreground">{k}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>

            <dl className="space-y-1.5 text-sm">
              <Row k="Joined" v={new Date(u.joined).toLocaleDateString()} />
              <Row k="Last active" v={u.lastActive ? new Date(u.lastActive).toLocaleString() : "Never"} />
              <Row k="Salesforce org" v={u.org ? `${u.org.username} (since ${new Date(u.org.connectedAt).toLocaleDateString()})` : "Not connected"} />
              <Row k="User id" v={<code className="text-xs">{u.userId}</code>} />
            </dl>

            <div>
              <p className="mb-2 text-sm font-medium">Recent submissions</p>
              {u.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">None yet.</p>
              ) : (
                <ul className="divide-y rounded-lg border text-sm">
                  {u.recent.map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="truncate">{r.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {STATUS_LABEL[r.status as keyof typeof STATUS_LABEL] ?? r.status} · {new Date(r.at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canSuspend && (
              <div className="rounded-lg border border-destructive/30 p-3">
                <p className="text-sm font-medium">Account</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {u.suspended === null
                    ? "Couldn't reach Clerk to check whether this account is suspended."
                    : u.suspended
                      ? "Suspended: signed out and blocked from signing in."
                      : "Suspending signs them out everywhere and blocks sign-in until restored. Their profile and history stay."}
                </p>
                {u.suspended !== null && (
                  <Button size="sm" variant={u.suspended ? "outline" : "destructive"} className="mt-3" disabled={busy} onClick={() => void toggle(u)}>
                    {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : u.suspended ? <RotateCcw className="mr-1 h-3.5 w-3.5" /> : <Ban className="mr-1 h-3.5 w-3.5" />}
                    {u.suspended ? "Restore account" : "Suspend account"}
                  </Button>
                )}
                {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{k}</dt>
      <dd className="min-w-0 truncate text-right">{v}</dd>
    </div>
  );
}

// ── Audit log ────────────────────────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  "role.grant": "granted a role",
  "role.revoke": "removed a role",
  "user.suspend": "suspended",
  "user.restore": "restored",
  "points.update": "changed the points table",
  "announcement.set": "posted an announcement",
  "announcement.clear": "cleared the announcement",
};

export function AuditTab() {
  const { data, error } = useLoad(getAudit);
  if (error) return <p className="mt-5 text-sm text-destructive">{error}</p>;
  if (!data) return <div className="mt-5 h-40 animate-pulse rounded-lg bg-muted/50" />;
  return (
    <section className="mt-5">
      <p className="text-xs text-muted-foreground">The latest 200 admin actions. Actors and targets are user ids; search them in People.</p>
      <div className="mt-3 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2.5 pl-4 font-normal">When</th>
              <th className="py-2.5 font-normal">Who</th>
              <th className="py-2.5 font-normal">Did</th>
              <th className="py-2.5 pr-4 font-normal">Details</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r: AuditRow) => (
              <tr key={r.id} className="border-t align-top">
                <td className="whitespace-nowrap py-2 pl-4 text-xs text-muted-foreground">{new Date(r.at).toLocaleString()}</td>
                <td className="py-2 font-mono text-xs">{r.actorId}</td>
                <td className="py-2">
                  {ACTION_LABEL[r.action] ?? r.action}
                  {r.targetId && <span className="ml-1 font-mono text-xs text-muted-foreground">{r.targetId}</span>}
                </td>
                <td className="max-w-64 py-2 pr-4 text-xs text-muted-foreground">
                  {Object.entries(r.detail)
                    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
                    .join(" · ")}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr className="border-t">
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Nothing yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Announcement ─────────────────────────────────────────────────────────────

export function AnnouncementTab() {
  const { getToken } = useAuthState();
  const [current, setCurrent] = useState<Announcement | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [tone, setTone] = useState<AnnouncementTone>("info");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getAnnouncement()
      .then((a) => {
        setCurrent(a);
        if (a) {
          setText(a.text);
          setTone(a.tone);
        }
      })
      .catch(() => setCurrent(null));
  }, []);

  async function save(value: { text: string; tone: AnnouncementTone } | null) {
    setBusy(true);
    setMessage(null);
    try {
      const a = await saveAnnouncement(await getToken(), value);
      setCurrent(a);
      if (!a) setText("");
      setMessage(a ? "Posted. Everyone sees it on their next page load." : "Cleared.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">A short message shown at the top of every page. Learners can dismiss it; posting new text shows it to them again.</p>
      <label className="block">
        <span className="text-sm font-medium">Message</span>
        <textarea value={text} maxLength={280} rows={3} onChange={(e) => setText(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" placeholder="e.g. Weekly contest starts Friday 18:00 UTC." />
        <span className="text-xs text-muted-foreground">{text.length}/280 · Markdown links aren&apos;t supported; keep it to one line.</span>
      </label>
      <fieldset className="flex gap-4 text-sm">
        <legend className="sr-only">Tone</legend>
        {(["info", "success", "warning"] as const).map((t) => (
          <label key={t} className="flex items-center gap-1.5 capitalize">
            <input type="radio" name="tone" checked={tone === t} onChange={() => setTone(t)} /> {t}
          </label>
        ))}
      </fieldset>
      {text.trim() && <BannerView a={{ text: text.trim(), tone, id: "preview", updatedAt: "" }} />}
      <div className="flex gap-2">
        <Button disabled={busy || !text.trim()} onClick={() => void save({ text, tone })}>
          <Megaphone className="mr-1 h-4 w-4" /> {current ? "Update" : "Post"}
        </Button>
        {current && (
          <Button variant="outline" disabled={busy} onClick={() => void save(null)}>
            Clear
          </Button>
        )}
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </section>
  );
}

const TONE: Record<AnnouncementTone, string> = {
  info: "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
};

export function BannerView({ a, onDismiss }: { a: Announcement; onDismiss?: () => void }) {
  return (
    <div role="status" className={cn("flex items-center gap-2 border-b px-4 py-2 text-sm", TONE[a.tone])}>
      <Megaphone className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="mx-auto min-w-0 text-center">{a.text}</p>
      {onDismiss && (
        <button type="button" aria-label="Dismiss announcement" onClick={onDismiss} className="shrink-0 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
