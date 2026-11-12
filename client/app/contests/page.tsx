"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { getStanding } from "@/lib/adminApi";
import { ApiError } from "@/lib/apiClient";
import { listChallenges, type ChallengeSummary } from "@/lib/challengesApi";
import { createContest, listContests, type ContestPhase, type ContestSummary } from "@/lib/contestApi";
import { PhasePill } from "@/components/PhasePill";

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function ContestsPage() {
  const { isSignedIn, getToken } = useAuthState();
  const [contests, setContests] = useState<ContestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listContests()
      .then((c) => !cancelled && setContests(c))
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not load contests."));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  // Convenience only: the server re-checks admin standing on create.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    getToken()
      .then((t) => getStanding(t))
      .then((s) => !cancelled && setIsAdmin(s === "owner" || s === "admin"))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  const order: ContestPhase[] = ["live", "upcoming", "ended"];
  const sorted = [...(contests ?? [])].sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase) || (a.phase === "ended" ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Contests</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Timed rounds graded in your own org. Join, solve as many as you can before the clock runs out. Ties break on penalty: minutes to each solve plus 5 per wrong attempt. The top three win 100 / 50 / 25 coins for the <Link href="/store" className="underline underline-offset-2">store</Link>.
      </p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {isAdmin && isSignedIn && <CreateContest onCreated={() => setReload((n) => n + 1)} />}
      <ul className="mt-6 divide-y overflow-hidden rounded-lg border">
        {contests === null && !error && Array.from({ length: 3 }).map((_, i) => <li key={i} className="p-4"><div className="h-5 animate-pulse rounded bg-muted" /></li>)}
        {sorted.map((c) => (
          <li key={c.slug}>
            <Link href={`/contests/${c.slug}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-accent/60">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
              <PhasePill phase={c.phase} />
              <span className="w-full text-xs text-muted-foreground sm:w-auto">{fmt(c.startsAt)} · {c.problemCount} problems · {c.entrants} joined</span>
            </Link>
          </li>
        ))}
        {contests?.length === 0 && <li className="p-10 text-center text-sm text-muted-foreground">No contests scheduled yet. Check back soon.</li>}
      </ul>
    </div>
  );
}

/** Local datetime-local value, an hour from now on the hour. */
function nextHour(offsetHours: number): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + offsetHours);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CreateContest({ onCreated }: { onCreated: () => void }) {
  const { getToken } = useAuthState();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState(() => nextHour(1));
  const [endsAt, setEndsAt] = useState(() => nextHour(3));
  const [catalog, setCatalog] = useState<ChallengeSummary[]>([]);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || catalog.length > 0) return;
    // Contests score only org-graded tracks; LWC runs in the browser and can't be timed fairly.
    void getToken().then((t) =>
      Promise.all((["apex", "soql", "debug", "flow"] as const).map((track) => listChallenges(t, track)))
        .then((lists) => setCatalog(lists.flatMap((l) => l.challenges)))
        .catch(() => setError("Could not load problems.")),
    );
  }, [open, catalog.length, getToken]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await createContest(await getToken(), {
        title,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        problems: Object.entries(picked).map(([slug, points]) => ({ slug, points })),
      });
      setOpen(false);
      setTitle("");
      setPicked({});
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the contest.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <Button size="sm" variant="outline" className="mt-4" onClick={() => setOpen(true)}>New contest</Button>;
  const defaultPoints: Record<string, number> = { Easy: 100, Medium: 200, Hard: 400 };
  return (
    <div className="mt-4 space-y-3 rounded-lg border p-4">
      <input aria-label="Title" placeholder="Weekly Round #1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="h-9 w-full rounded-md border bg-background px-2 text-sm" />
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">Starts <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="h-9 rounded-md border bg-background px-2" /></label>
        <label className="flex items-center gap-2">Ends <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="h-9 rounded-md border bg-background px-2" /></label>
      </div>
      <p className="text-xs text-muted-foreground">Pick 1–6 problems ({Object.keys(picked).length} picked). Points are editable.</p>
      <ul className="max-h-64 divide-y overflow-y-auto rounded-md border text-sm">
        {catalog.map((p) => {
          const on = p.slug in picked;
          return (
            <li key={p.slug} className="flex items-center gap-2 px-3 py-1.5">
              <input type="checkbox" checked={on} aria-label={`Include ${p.title}`} onChange={() => setPicked((cur) => {
                if (on) return Object.fromEntries(Object.entries(cur).filter(([k]) => k !== p.slug));
                return { ...cur, [p.slug]: defaultPoints[p.difficulty] ?? 100 };
              })} />
              <span className="min-w-0 flex-1 truncate">{p.title}</span>
              <span className="text-xs text-muted-foreground">{p.track} · {p.difficulty}</span>
              {on && <input type="number" min={1} max={1000} aria-label={`Points for ${p.title}`} value={picked[p.slug]} onChange={(e) => setPicked((cur) => ({ ...cur, [p.slug]: Number(e.target.value) }))} className="h-7 w-20 rounded border bg-background px-1 text-right" />}
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void submit()}>Schedule</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
