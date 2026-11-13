"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Search, ShieldCheck, X } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import {
  CAN_GRANT,
  MAX_ADMINS,
  decideApplication,
  getApplications,
  getOverview,
  getPoints,
  getStanding,
  getUsers,
  isStaff,
  savePoints,
  setRole,
  type AdminOverview,
  type AdminUser,
  type BuddyApplicationRow,
  type PointsSettings,
  type Standing,
  type StaffRole,
} from "@/lib/adminApi";
import { communityProblems, reviewQueue, setProblemActive, type CommunityProblemRow, type DraftRow } from "@/lib/draftsApi";
import { cn } from "@/lib/utils";
import { getEmailUsage, sendTestDigest } from "@/lib/emailApi";
import { AnnouncementTab, AuditTab, DashboardTab, UserDrawer } from "@/components/admin/AdminTools";
import { STATUS_LABEL } from "@/lib/verdicts";

type Tab = "dashboard" | "review" | "people" | "applications" | "problems" | "points" | "email" | "announcement" | "audit";
const ROLE_LABEL: Record<StaffRole, string> = { admin: "Admin", reviewer: "Reviewer", buddy: "Buddy" };

export default function AdminPage() {
  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const [standing, setStanding] = useState<Standing | "none" | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const s = await getStanding(token);
        if (!isStaff(s)) {
          if (!cancelled) setStanding(s);
          return;
        }
        const o = await getOverview(token);
        if (!cancelled) {
          setStanding(s);
          setOverview(o);
        }
      } catch {
        if (!cancelled) setStanding("none");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  const view = isLoaded && !isSignedIn ? "none" : standing;
  if (view === null)
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (view === "none" || !isStaff(view))
    return (
      <div className="py-24 text-center text-muted-foreground">
        <p>The admin area is for reviewers and admins.</p>
        {view === "buddy" && <p className="mt-2 text-sm">As a Buddy, your tools are on the <Link href="/contribute" className="underline">Contribute</Link> page.</p>}
      </div>
    );

  const tiles: [string, number][] = overview
    ? [["Learners", overview.learners], ["Connected orgs", overview.connectedOrgs], ["Submissions", overview.submissions], ["Last 24 hours", overview.submissions24h]]
    : [];
  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "dashboard", label: "Dashboard", show: true },
    { id: "review", label: "Review queue", show: true },
    { id: "people", label: "People", show: true },
    { id: "applications", label: "Buddy applications", show: true },
    { id: "problems", label: "Community problems", show: true },
    { id: "points", label: "Points", show: view === "owner" || view === "admin" },
    { id: "email", label: "Email", show: view === "owner" || view === "admin" },
    { id: "announcement", label: "Announcement", show: view === "owner" || view === "admin" },
    { id: "audit", label: "Audit log", show: view === "owner" || view === "admin" },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-muted-foreground">{view}</span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(([label, n]) => (
          <div key={label} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{n}</p>
          </div>
        ))}
      </div>
      {overview && Object.keys(overview.byStatus).length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Verdicts:{" "}
          {Object.entries(overview.byStatus)
            .map(([s, n]) => `${STATUS_LABEL[s as keyof typeof STATUS_LABEL] ?? s} ${n}`)
            .join(" · ")}
        </p>
      )}

      <div role="tablist" className="mt-8 flex gap-1 overflow-x-auto border-b text-sm">
        {tabs.filter((t) => t.show).map((t) => (
          <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2", tab === t.id ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "review" && <ReviewQueue />}
      {tab === "problems" && <CommunityProblems canToggle={view === "owner" || view === "admin"} />}
      {tab === "people" && <People view={view} />}
      {tab === "applications" && <Applications />}
      {tab === "points" && <Points />}
      {tab === "email" && <EmailTab />}
      {tab === "dashboard" && <DashboardTab />}
      {tab === "announcement" && <AnnouncementTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}

function ReviewQueue() {
  const { getToken } = useAuthState();
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  useEffect(() => {
    getToken()
      .then((t) => reviewQueue(t))
      .then(setRows)
      .catch(() => setRows([]));
  }, [getToken]);
  return (
    <section className="mt-5">
      <p className="text-xs text-muted-foreground">Open a draft, run it in your own org (it must pass), then approve, request changes or reject. You can&apos;t review your own problems.</p>
      {rows === null && <div className="mt-3 h-20 animate-pulse rounded-lg bg-muted/50" />}
      {rows?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nothing waiting for review.</p>}
      {rows && rows.length > 0 && (
        <ul className="mt-3 divide-y rounded-lg border text-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/contribute/drafts/${r.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/60">
                <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
                <span className="text-xs text-muted-foreground">{r.track} · {r.difficulty}</span>
                <span className="text-xs text-muted-foreground">@{r.author ?? "?"} · {new Date(r.updatedAt).toLocaleDateString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CommunityProblems({ canToggle }: { canToggle: boolean }) {
  const { getToken } = useAuthState();
  const [rows, setRows] = useState<CommunityProblemRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    getToken()
      .then((t) => communityProblems(t))
      .then(setRows)
      .catch(() => setRows([]));
  }, [getToken]);
  useEffect(load, [load]);
  async function toggle(r: CommunityProblemRow) {
    setError(null);
    try {
      await setProblemActive(await getToken(), r.slug, !r.active);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change it.");
    }
  }
  return (
    <section className="mt-5">
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      {rows?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No community problems published yet.</p>}
      {rows && rows.length > 0 && (
        <ul className="divide-y rounded-lg border text-sm">
          {rows.map((r) => (
            <li key={r.slug} className="flex items-center gap-3 px-4 py-2.5">
              <span className={cn("min-w-0 flex-1 truncate font-medium", !r.active && "text-muted-foreground line-through")}>{r.title}</span>
              <span className="text-xs text-muted-foreground">{r.track} · {r.difficulty} · @{r.author ?? "?"}</span>
              {canToggle && <Button size="sm" variant="ghost" onClick={() => void toggle(r)}>{r.active ? "Unpublish" : "Republish"}</Button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function People({ view }: { view: Standing }) {
  const { getToken } = useAuthState();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(
    (q: string) => {
      getToken()
        .then((t) => getUsers(t, q))
        .then(setUsers)
        .catch(() => setMessage("Could not load users."));
    },
    [getToken],
  );
  useEffect(() => load(""), [load]);

  async function change(user: AdminUser, role: StaffRole, grant: boolean) {
    setMessage(null);
    try {
      await setRole(await getToken(), user.userId, role, grant);
      setMessage(`${grant ? "Made" : "Removed"} @${user.handle} ${grant ? "a" : "as"} ${ROLE_LABEL[role].toLowerCase()}.`);
      load(query);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not change the role.");
    }
  }

  const admins = users.filter((u) => u.roles.includes("admin")).length;
  return (
    <section className="mt-5">
      <p className="text-xs text-muted-foreground">
        Owner &gt; Admin (at most {MAX_ADMINS}; owner grants) &gt; Reviewer (admins grant) &gt; Buddy (reviewers grant).
        {view === "owner" && ` Admins in this list: ${admins}/${MAX_ADMINS}.`}
      </p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load(query);
        }}
      >
        <label className="relative flex-1">
          <span className="sr-only">Search users</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Handle, name or user id" className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm" />
        </label>
        <Button type="submit" size="sm" variant="outline">Search</Button>
      </form>
      {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
      {open && <UserDrawer userId={open} view={view} onClose={() => setOpen(null)} />}

      <div className="mt-3 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2.5 pl-4">Learner</th>
              <th className="py-2.5">Role</th>
              <th className="py-2.5 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId} className="border-t">
                <td className="py-2.5 pl-4">
                  <button type="button" onClick={() => setOpen(u.userId)} className="font-medium hover:text-primary hover:underline">{u.displayName}</button>
                  <span className="ml-2 text-xs text-muted-foreground">@{u.handle}</span>
                </td>
                <td className="py-2.5 text-xs text-muted-foreground">{u.owner ? "Owner" : u.roles.map((r) => ROLE_LABEL[r]).join(", ") || "—"}</td>
                <td className="space-x-1 whitespace-nowrap py-2.5 pr-4 text-right">
                  {!u.owner &&
                    (["buddy", "reviewer", "admin"] as const)
                      .filter((r) => CAN_GRANT[r].includes(view))
                      .map((r) => {
                        const has = u.roles.includes(r);
                        return (
                          <Button key={r} size="sm" variant={has ? "outline" : "ghost"} onClick={() => void change(u, r, !has)}>
                            {has ? `Remove ${ROLE_LABEL[r].toLowerCase()}` : `Make ${ROLE_LABEL[r].toLowerCase()}`}
                          </Button>
                        );
                      })}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr className="border-t">
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">No users match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Applications() {
  const { getToken } = useAuthState();
  const [apps, setApps] = useState<BuddyApplicationRow[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getToken()
      .then((t) => getApplications(t))
      .then(setApps)
      .catch(() => setError("Could not load applications."));
  }, [getToken]);
  useEffect(load, [load]);

  async function decide(id: string, approve: boolean) {
    setError(null);
    try {
      await decideApplication(await getToken(), id, approve, notes[id] ?? "");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the decision.");
    }
  }

  return (
    <section className="mt-5 space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {apps === null && <div className="h-24 animate-pulse rounded-lg bg-muted/50" />}
      {apps?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No applications waiting.</p>}
      {apps?.map((a) => (
        <div key={a.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium">{a.displayName}</span>
            {a.handle && <Link href={`/u/${a.handle}`} className="text-xs text-muted-foreground hover:text-primary">@{a.handle}</Link>}
            <span className="ml-auto text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm">{a.motivation}</p>
          {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-block text-xs text-sky-700 hover:underline dark:text-sky-400">{a.link}</a>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input aria-label="Note to the applicant" placeholder="Optional note to the applicant" maxLength={500} value={notes[a.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))} className="h-8 min-w-[14rem] flex-1 rounded-md border bg-background px-2 text-sm" />
            <Button size="sm" onClick={() => void decide(a.id, true)}><Check className="mr-1 h-3.5 w-3.5" /> Approve</Button>
            <Button size="sm" variant="outline" onClick={() => void decide(a.id, false)}><X className="mr-1 h-3.5 w-3.5" /> Reject</Button>
          </div>
        </div>
      ))}
    </section>
  );
}

const TRACK_ROWS = [
  ["lwc", "LWC"],
  ["apex", "Apex"],
  ["debug", "Debugging"],
  ["flow", "Flow"],
  ["soql", "SOQL"],
] as const;
const DIFFS = ["Easy", "Medium", "Hard"] as const;

function Points() {
  const { getToken } = useAuthState();
  const [settings, setSettings] = useState<PointsSettings | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getPoints()
      .then(setSettings)
      .catch(() => setMessage("Could not load the points table."));
  }, []);

  async function save() {
    if (!settings) return;
    setMessage(null);
    try {
      setSettings(await savePoints(await getToken(), settings));
      setMessage("Saved. The leaderboard uses the new values right away.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save.");
    }
  }

  if (!settings) return <div className="mt-5 h-40 animate-pulse rounded-lg bg-muted/50" />;
  const set = (track: (typeof TRACK_ROWS)[number][0], d: (typeof DIFFS)[number], v: number) =>
    setSettings({ ...settings, matrix: { ...settings.matrix, [track]: { ...settings.matrix[track], [d]: v } } });

  return (
    <section className="mt-5">
      <p className="text-sm text-muted-foreground">
        Points for a first solve, by track and difficulty. The leaderboard always uses this table. Coins are points × the multiplier below,
        for solves after the switch to this table; earlier solves keep the coins they earned.
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2.5 pl-4">Track</th>
              {DIFFS.map((d) => <th key={d} className="py-2.5 text-center">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {TRACK_ROWS.map(([id, label]) => (
              <tr key={id} className="border-t">
                <td className="py-2 pl-4 font-medium">{label}</td>
                {DIFFS.map((d) => (
                  <td key={d} className="py-2 text-center">
                    <input type="number" min={0} max={100} aria-label={`${label} ${d}`} value={settings.matrix[id][d]} onChange={(e) => set(id, d, Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))} className="h-8 w-16 rounded-md border bg-background text-center tabular-nums" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        Coins per point
        <input type="number" min={0} max={100} value={settings.coinsPerPoint} onChange={(e) => setSettings({ ...settings, coinsPerPoint: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })} className="h-8 w-16 rounded-md border bg-background text-center" />
      </label>
      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" onClick={() => void save()}>Save points</Button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </section>
  );
}

function EmailTab() {
  const { getToken } = useAuthState();
  const [usage, setUsage] = useState<{ sentThisMonth: number; cap: number; perUser: number; enabled: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const load = useCallback(() => {
    getToken()
      .then((t) => getEmailUsage(t))
      .then(setUsage)
      .catch(() => setMessage("Could not load email usage."));
  }, [getToken]);
  useEffect(load, [load]);
  async function test() {
    setMessage(null);
    setSending(true);
    try {
      const r = await sendTestDigest(await getToken());
      setMessage(r.result === "sent" ? `Sent at ${new Date().toLocaleTimeString()}: check your inbox.` : `Not sent: ${r.result.replace(/_/g, " ")}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setSending(false);
      load();
    }
  }
  if (!usage) return <div className="mt-5 h-24 animate-pulse rounded-lg bg-muted/50" />;
  const pct = usage.cap ? Math.min(100, Math.round((100 * usage.sentThisMonth) / usage.cap)) : 0;
  return (
    <section className="mt-5 space-y-4">
      <p className="text-sm text-muted-foreground">
        Weekly digest via EmailJS: opt-in, Mondays 09:00 UTC, at most {usage.perUser} per user and {usage.cap} in total per month.
        {!usage.enabled && " Email is off: set the four EMAILJS_* values in server/.env and restart."}
      </p>
      <div>
        <div className="flex justify-between text-sm"><span>This month</span><span className="tabular-nums">{usage.sentThisMonth} / {usage.cap}</span></div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", pct > 85 ? "bg-rose-500" : "bg-sky-500")} style={{ width: `${pct}%` }} /></div>
      </div>
      <Button size="sm" disabled={!usage.enabled || sending} onClick={() => void test()}>{sending ? "Sending…" : "Send me a test digest"}</Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </section>
  );
}
