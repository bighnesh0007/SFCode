"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleDashed, ExternalLink, Loader2, Timer, XCircle } from "lucide-react";
import { SignInButton, useAuthState } from "@/components/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ApiError, apiRequest } from "@/lib/apiClient";
import { trackInfo } from "@/lib/tracks";
import type { Track } from "@/lib/challengesApi";
import { cn } from "@/lib/utils";

type ITrack = "apex" | "soql" | "debug" | "lwc";
interface IProblem {
  slug: string;
  title: string;
  track: Track;
  difficulty: string;
}
interface Session {
  problems: IProblem[];
  startedAt: string;
  endsAt: string;
}
interface Scorecard {
  problems: (IProblem & { points: number; solved: boolean; solvedAfterMinutes: number | null; wrongAttempts: number })[];
  solved: number;
  total: number;
  score: number;
  maxScore: number;
  wrongAttempts: number;
  verdict: string;
}

const KEY = "sfcode.interview";
const TRACKS: { id: ITrack; label: string }[] = [
  { id: "apex", label: "Apex" },
  { id: "soql", label: "SOQL" },
  { id: "debug", label: "Debugging" },
  { id: "lwc", label: "LWC" },
];

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function InterviewPage() {
  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const [session, setSession] = useState<Session | null>(null);
  const [card, setCard] = useState<Scorecard | null>(null);
  const [count, setCount] = useState(3);
  const [minutes, setMinutes] = useState(60);
  const [tracks, setTracks] = useState<ITrack[]>(["apex", "soql", "debug"]);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pick up an interview in progress after a reload. Read once on mount.
  useEffect(() => {
    const s = readSession();
    // localStorage isn't available during server rendering, so this can't be the initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s) setSession(s);
  }, []);

  const finish = useCallback(
    async (s: Session) => {
      setBusy(true);
      setError(null);
      try {
        // A finished interview ends now, not at the time limit.
        const endsAt = new Date(Math.min(Date.now(), new Date(s.endsAt).getTime())).toISOString();
        const c = await apiRequest<Scorecard>("/api/v1/interview/score", { method: "POST", token: await getToken(), body: { slugs: s.problems.map((p) => p.slug), startedAt: s.startedAt, endsAt } });
        setCard(c);
        setSession(null);
        try {
          localStorage.removeItem(KEY);
        } catch {
          /* ignore */
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not build the scorecard.");
      } finally {
        setBusy(false);
      }
    },
    [getToken],
  );

  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= new Date(session.endsAt).getTime()) void finish(session);
    }, 1000);
    return () => clearInterval(t);
  }, [session, finish]);

  async function start() {
    setBusy(true);
    setError(null);
    setCard(null);
    try {
      const problems = await apiRequest<IProblem[]>("/api/v1/interview/start", { method: "POST", token: await getToken(), body: { count, tracks } });
      const startedAt = Date.now();
      const s = { problems, startedAt: new Date(startedAt).toISOString(), endsAt: new Date(startedAt + minutes * 60_000).toISOString() };
      setSession(s);
      setNow(startedAt);
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch {
        /* the interview still works; it just won't survive a reload */
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not start the interview.");
    } finally {
      setBusy(false);
    }
  }

  const header = <PageHeader icon={Timer} title="Interview mode" description="A random set of problems against the clock, like a technical screen. Solve them in the normal workspace; your graded submissions build the scorecard." />;

  if (isLoaded && !isSignedIn)
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        {header}
        <SignInButton>
          <Button className="mt-6">Sign in to start</Button>
        </SignInButton>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      {header}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {session ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <p className="text-sm text-muted-foreground">Time left</p>
              <p className={cn("font-mono text-3xl font-semibold tabular-nums", new Date(session.endsAt).getTime() - now < 5 * 60_000 && "text-destructive")} role="timer">
                {clock(new Date(session.endsAt).getTime() - now)}
              </p>
            </div>
            <Button variant="outline" disabled={busy} onClick={() => window.confirm("Finish now and see your scorecard?") && void finish(session)}>
              {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Finish interview
            </Button>
          </div>
          <ol className="space-y-2">
            {session.problems.map((p, i) => (
              <li key={p.slug}>
                <a href={`${trackInfo(p.track).base}/${p.slug}`} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-accent/50">
                  <span className="font-mono text-sm text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {trackInfo(p.track).label} · {p.difficulty}
                    </span>
                  </span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">Problems open in a new tab so this timer keeps running. Submit as usual; only submissions made before time runs out count. Hints are off-limits if you want an honest score.</p>
        </section>
      ) : (
        <section className="space-y-5 rounded-xl border p-5">
          <div>
            <p className="text-sm font-medium">Problems</p>
            <div className="mt-2 flex gap-2">
              {[2, 3, 4].map((n) => (
                <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={cn("rounded-md border px-4 py-1.5 text-sm", count === n && "border-primary bg-primary/10 font-medium")}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Time limit</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[30, 45, 60, 90].map((m) => (
                <button key={m} type="button" aria-pressed={minutes === m} onClick={() => setMinutes(m)} className={cn("rounded-md border px-4 py-1.5 text-sm", minutes === m && "border-primary bg-primary/10 font-medium")}>
                  {m} min
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Tracks</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TRACKS.map((t) => {
                const on = tracks.includes(t.id);
                return (
                  <button key={t.id} type="button" aria-pressed={on} onClick={() => setTracks((cur) => (on ? cur.filter((x) => x !== t.id) : [...cur, t.id]))} className={cn("rounded-full border px-4 py-1.5 text-sm", on && "border-primary bg-primary/10 font-medium")}>
                    {t.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Problems you haven&apos;t solved come first, with at most one Hard. Flow problems aren&apos;t included: they&apos;re built in your org, which doesn&apos;t suit a timed round. Apex, SOQL and debugging problems need your org connected.</p>
          </div>
          <Button disabled={busy || tracks.length === 0} onClick={() => void start()}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Start the interview
          </Button>
        </section>
      )}

      {card && <ScorecardView card={card} />}
    </div>
  );
}

function ScorecardView({ card }: { card: Scorecard }) {
  const good = card.solved === card.total;
  return (
    <section className="space-y-4 rounded-xl border p-5">
      <div className="text-center">
        <p className={cn("text-sm font-semibold uppercase tracking-wide", good ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>{card.verdict}</p>
        <p className="mt-1 text-4xl font-bold tabular-nums">
          {card.solved}/{card.total}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {card.score} of {card.maxScore} points · {card.wrongAttempts} wrong {card.wrongAttempts === 1 ? "attempt" : "attempts"}
        </p>
      </div>
      <ul className="divide-y rounded-lg border">
        {card.problems.map((p) => (
          <li key={p.slug} className="flex items-center gap-3 px-4 py-3 text-sm">
            {p.solved ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Solved" /> : p.wrongAttempts > 0 ? <XCircle className="h-4 w-4 text-destructive" aria-label="Not solved" /> : <CircleDashed className="h-4 w-4 text-muted-foreground" aria-label="Not attempted" />}
            <Link href={`${trackInfo(p.track).base}/${p.slug}`} className="min-w-0 flex-1 truncate hover:text-primary hover:underline">
              {p.title}
            </Link>
            <span className="text-xs text-muted-foreground">
              {p.solved ? `solved after ${p.solvedAfterMinutes} min` : p.wrongAttempts > 0 ? "not solved" : "not attempted"}
              {p.wrongAttempts > 0 && ` · ${p.wrongAttempts} wrong`}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Unsolved problems keep their hints and editorials for you to learn from afterwards.</p>
    </section>
  );
}
