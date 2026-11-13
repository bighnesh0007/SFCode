"use client";

import { useEffect, useState } from "react";
import { useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { listChallenges, type ChallengeSummary } from "@/lib/challengesApi";
import { createContest, updateContest } from "@/lib/contestApi";

function nextHour(offsetHours: number): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + offsetHours);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A contest being edited: the slug it keeps, and its current settings. */
export interface ContestDraft {
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  problems: { slug: string; points: number }[];
}

/** For <input type="datetime-local">: the local wall-clock time, without seconds. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Schedules a new contest, or edits one that hasn't started (`editing`). */
export function ContestForm({ onSaved, editing, onCancel }: { onSaved: () => void; editing?: ContestDraft; onCancel?: () => void }) {
  const { getToken } = useAuthState();
  const [open, setOpen] = useState(editing !== undefined);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [startsAt, setStartsAt] = useState(() => (editing ? toLocalInput(editing.startsAt) : nextHour(1)));
  const [endsAt, setEndsAt] = useState(() => (editing ? toLocalInput(editing.endsAt) : nextHour(3)));
  const [catalog, setCatalog] = useState<ChallengeSummary[]>([]);
  const [picked, setPicked] = useState<Record<string, number>>(() => Object.fromEntries((editing?.problems ?? []).map((p) => [p.slug, p.points])));
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
      const body = {
        title,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        problems: Object.entries(picked).map(([slug, points]) => ({ slug, points })),
      };
      const token = await getToken();
      if (editing) await updateContest(token, editing.slug, body);
      else await createContest(token, body);
      if (!editing) {
        setOpen(false);
        setTitle("");
        setPicked({});
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the contest.");
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
        <Button size="sm" disabled={busy} onClick={() => void submit()}>{editing ? "Save changes" : "Schedule"}</Button>
        <Button size="sm" variant="ghost" onClick={() => (onCancel ? onCancel() : setOpen(false))}>Cancel</Button>
      </div>
    </div>
  );
}
