"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, CircleDashed, ExternalLink, GraduationCap, Library, Lightbulb, Lock, SkipForward, TriangleAlert, X } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { WeeklyPlan } from "@/components/WeeklyPlan";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import type { Track } from "@/lib/challengesApi";
import { diagramUrl, getOnboarding, getRoadmap, listRoadmaps, markRead, submitQuiz, type Hours, type NodeState, type QuizResult, type RoadmapNode, type RoadmapView } from "@/lib/roadmapApi";
import { trackInfo } from "@/lib/tracks";
import { cn } from "@/lib/utils";

const COL_W = 236;
const ROW_H = 150;
const BOX_W = 208;
const BOX_H = 116;

const STATE_STYLE: Record<NodeState, string> = {
  done: "border-emerald-500/70 bg-emerald-500/10",
  assumed: "border-dashed border-muted-foreground/40 bg-muted/40 text-muted-foreground",
  in_progress: "border-sky-500 bg-sky-500/10",
  available: "border-foreground/30 bg-card hover:border-sky-500/70",
  locked: "border-border bg-muted/30 text-muted-foreground/70",
};
const STATE_LABEL: Record<NodeState, string> = { done: "Done", assumed: "You know this", in_progress: "In progress", available: "Ready", locked: "Locked" };

function StateIcon({ state, className }: { state: NodeState; className?: string }) {
  const c = cn("h-4 w-4 shrink-0", className);
  if (state === "done") return <Check className={cn(c, "text-emerald-700 dark:text-emerald-400")} />;
  if (state === "assumed") return <SkipForward className={c} />;
  if (state === "locked") return <Lock className={c} />;
  return <CircleDashed className={cn(c, state === "in_progress" ? "text-sky-700 dark:text-sky-400" : "")} />;
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total ? done / total : 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-label={`${Math.round(pct * 100)}% complete`}>
      <circle cx="32" cy="32" r={r} className="fill-none stroke-muted" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} className="fill-none stroke-sky-500 transition-[stroke-dashoffset] duration-700" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      <text x="32" y="36" textAnchor="middle" className="rotate-90 fill-foreground text-[13px] font-semibold" style={{ transformOrigin: "32px 32px" }}>{Math.round(pct * 100)}%</text>
    </svg>
  );
}

export default function RoadmapPage() {
  const { isSignedIn, getToken } = useAuthState();
  const [view, setView] = useState<RoadmapView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [roadmaps, setRoadmaps] = useState<{ id: string; title: string }[]>([]);
  /** null until we know: the learner's own roadmap if they did the quiz, else Developer. */
  const [roadmapId, setRoadmapId] = useState<string | null>(null);
  const [hours, setHours] = useState<Hours | null>(null);
  /** The path the learner was given; the weekly plan only shows on that one. */
  const [myRoadmap, setMyRoadmap] = useState<string | null>(null);

  useEffect(() => {
    listRoadmaps().then(setRoadmaps).catch(() => {});
  }, []);
  useEffect(() => {
    let cancelled = false;
    const fallback = () => !cancelled && setRoadmapId((cur) => cur ?? "developer");
    if (!isSignedIn) {
      fallback();
      return;
    }
    getToken()
      .then((t) => getOnboarding(t))
      .then((ob) => {
        if (cancelled) return;
        setHours(ob?.hours ?? null);
        setMyRoadmap(ob?.roadmapId ?? null);
        setRoadmapId((cur) => cur ?? ob?.roadmapId ?? "developer");
      })
      .catch(fallback);
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  const load = useCallback(() => {
    if (!roadmapId) return;
    getToken()
      .then((t) => getRoadmap(t, roadmapId))
      .then(setView)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Could not load the roadmap."));
  }, [getToken, roadmapId]);
  useEffect(load, [load, isSignedIn]);

  const byId = useMemo(() => new Map((view?.nodes ?? []).map((n) => [n.id, n])), [view]);
  const rows = Math.max(0, ...(view?.nodes ?? []).map((n) => n.depth)) + 1;
  const pos = (n: RoadmapNode) => ({ x: n.col * COL_W + (COL_W - BOX_W) / 2, y: n.depth * ROW_H + 8 });
  const selected = open ? byId.get(open) : undefined;

  // On narrow screens the graph scrolls sideways; start it centred on the step to do next.
  const graphRef = useRef<HTMLDivElement>(null);
  const focusId = view?.next ?? view?.nodes[0]?.id;
  useEffect(() => {
    const el = graphRef.current;
    const n = focusId ? byId.get(focusId) : undefined;
    if (!el || !n || el.scrollWidth <= el.clientWidth) return;
    const inner = (el.scrollWidth - COL_W * 3) / 2;
    el.scrollLeft = inner + n.col * COL_W + COL_W / 2 - el.clientWidth / 2;
  }, [focusId, byId]);
  const nextNode = view?.next ? byId.get(view.next) : undefined;

  if (error) return <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-destructive">{error}</div>;
  if (!view) return <div className="mx-auto max-w-3xl px-4 py-8"><div className="h-10 w-72 animate-pulse rounded bg-muted" /><div className="mt-6 h-96 animate-pulse rounded-xl bg-muted/50" /></div>;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-5">
        <ProgressRing done={view.done} total={view.total} />
        {/* min-w forces a wrap on phones instead of squeezing the text to one word per line. */}
        <div className="min-w-[14rem] flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{view.title} roadmap</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{view.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {view.personalised ? `${view.done} of ${view.total} steps on your path done. Steps finish when you solve their problems, not by ticking boxes.` : "Sign in and take the welcome quiz to track progress and skip what you already know."}
          </p>
        </div>
        {nextNode ? (
          <Button className="w-full sm:w-auto" onClick={() => setOpen(nextNode.id)}>Continue: {nextNode.title} <ArrowRight className="ml-1 h-4 w-4" /></Button>
        ) : !view.personalised ? (
          <Link href="/welcome"><Button>Personalise it</Button></Link>
        ) : null}
      </div>

      {roadmaps.length > 1 && (
        <div role="tablist" aria-label="Roadmap" className="mt-5 inline-flex rounded-lg border p-0.5 text-sm">
          {roadmaps.map((r) => (
            <button key={r.id} role="tab" type="button" aria-selected={r.id === view.id} onClick={() => { setOpen(null); setRoadmapId(r.id); }} className={cn("rounded-md px-3 py-1", r.id === view.id ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground")}>
              {r.title}
            </button>
          ))}
        </div>
      )}

      {view.personalised && hours && view.id === myRoadmap && <WeeklyPlan view={view} hours={hours} onOpen={setOpen} />}

      <div className="mt-6 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(Object.keys(STATE_LABEL) as NodeState[]).map((s) => <span key={s} className="inline-flex items-center gap-1"><StateIcon state={s} className="h-3.5 w-3.5" />{STATE_LABEL[s]}</span>)}
        {view.personalised && <Link href="/welcome" className="ml-auto underline-offset-2 hover:underline">Retake the quiz</Link>}
      </div>

      <div ref={graphRef} className="mt-4 overflow-x-auto rounded-xl border bg-[radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] [background-size:20px_20px] p-4">
        <div className="relative mx-auto" style={{ width: COL_W * 3, height: rows * ROW_H }}>
          <svg className="absolute inset-0" width={COL_W * 3} height={rows * ROW_H} aria-hidden>
            {view.nodes.flatMap((n) =>
              n.requires.map((rid) => {
                const p = byId.get(rid);
                if (!p) return null;
                const a = pos(p);
                const b = pos(n);
                const x1 = a.x + BOX_W / 2, y1 = a.y + BOX_H, x2 = b.x + BOX_W / 2, y2 = b.y;
                const lit = p.state === "done" || p.state === "assumed";
                return <path key={`${rid}-${n.id}`} d={`M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`} className={cn("fill-none transition-colors", lit ? "stroke-sky-500/70" : "stroke-border")} strokeWidth={lit ? 2.5 : 1.5} strokeDasharray={lit ? undefined : "5 5"} />;
              }),
            )}
          </svg>
          {view.nodes.map((n) => {
            const { x, y } = pos(n);
            const solved = n.problems.filter((p) => p.status === "solved").length;
            const isNext = n.id === view.next;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setOpen(n.id)}
                style={{ left: x, top: y, width: BOX_W, height: BOX_H }}
                className={cn("absolute flex flex-col rounded-xl border-2 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md", STATE_STYLE[n.state], n.optional && "border-dashed opacity-90", isNext && "ring-4 ring-sky-500/30 animate-[pulse_2.5s_ease-in-out_infinite]", open === n.id && "ring-2 ring-sky-500")}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <StateIcon state={n.state} />
                  <span className="truncate">{n.title}</span>
                  {n.struggling && <TriangleAlert className="ml-auto h-3.5 w-3.5 text-amber-700 dark:text-amber-400" aria-label="Needs a revisit" />}
                </span>
                <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.summary}</span>
                <span className="mt-1 flex gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {STAGE[n.level]}
                  {n.optional && <span className="rounded bg-muted px-1">Optional</span>}
                </span>
                {n.problems.length > 0 && (
                  <span className="mt-auto flex gap-0.5 pt-1" aria-label={`${solved} of ${n.problems.length} solved`}>
                    {n.problems.map((p) => <span key={p.slug} className={cn("h-1 flex-1 rounded-full", p.status === "solved" ? "bg-emerald-500" : p.status === "attempted" ? "bg-amber-500" : "bg-muted-foreground/20")} />)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selected && <NodePanel node={selected} view={view} onClose={() => setOpen(null)} onChange={setView} />}
    </div>
  );
}

function NodePanel({ node, view, onClose, onChange }: { node: RoadmapNode; view: RoadmapView; onClose: () => void; onChange: (v: RoadmapView) => void }) {
  const { isSignedIn, getToken } = useAuthState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = node.requires.filter((r) => !["done", "assumed"].includes(view.nodes.find((n) => n.id === r)?.state ?? "")).map((r) => view.nodes.find((n) => n.id === r)?.title ?? r);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function toggleRead() {
    setBusy(true);
    setError(null);
    try {
      onChange(await markRead(await getToken(), view.id, node.id, !node.read));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 animate-in fade-in" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-label={node.title} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col overflow-y-auto border-l bg-background p-6 shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><StateIcon state={node.state} className="h-3.5 w-3.5" />{STATE_LABEL[node.state]}</span>
            <h2 className="mt-1 text-xl font-semibold">{node.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{node.summary}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>

        {node.state === "locked" && missing.length > 0 && <p className="mt-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Unlocks after: {missing.join(", ")}. You can still peek and practise.</p>}
        {node.struggling && <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">Stuck on one of these? Revisit {node.requires.length ? view.nodes.filter((n) => node.requires.includes(n.id)).map((n) => n.title).join(" and ") : "the lesson below"} first, then come back.</p>}

        {node.lesson && (
          <section className="mt-5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><BookOpen className="h-3.5 w-3.5" /> Lesson</h3>
            <Markdown source={node.lesson} className="mt-2 text-sm" />
          </section>
        )}

        {node.diagram && <Diagram name={node.diagram} caption={node.diagramCaption ?? node.title} />}

        {node.concepts && node.concepts.length > 0 && (
          <section className="mt-5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Lightbulb className="h-3.5 w-3.5" /> Key concepts</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {node.concepts.map((c, i) => (
                <li key={i} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" /><Markdown source={c} className="[&_p]:m-0" /></li>
              ))}
            </ul>
          </section>
        )}

        {node.pitfalls && node.pitfalls.length > 0 && (
          <section className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400"><TriangleAlert className="h-3.5 w-3.5" /> Common mistakes</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
              {node.pitfalls.map((p, i) => (
                <li key={i}><Markdown source={p} className="[&_p]:m-0" /></li>
              ))}
            </ul>
          </section>
        )}

        {node.problems.length > 0 && (
          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Practice</h3>
            <ul className="mt-2 divide-y rounded-lg border">
              {node.problems.map((p) => (
                <li key={p.slug}>
                  <Link href={`${trackInfo(p.track as Track).base}/${p.slug}`} className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent/60">
                    {p.status === "solved" ? <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-400" /> : p.status === "attempted" ? <TriangleAlert className="h-4 w-4 text-amber-700 dark:text-amber-400" /> : <CircleDashed className="h-4 w-4 text-muted-foreground" />}
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    <span className="text-xs text-muted-foreground">{trackInfo(p.track as Track).label} · {p.difficulty}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {node.cert && (
          <Link href={`/certification/${node.cert.exam}${node.cert.section ? `?section=${node.cert.section}` : ""}`} className="mt-5 flex items-center gap-2 rounded-lg border p-3 text-sm hover:bg-accent/60">
            <GraduationCap className="h-4 w-4 text-sky-700 dark:text-sky-400" /> Practise {node.cert.exam.toUpperCase()} questions{node.cert.section ? ` on ${node.cert.section}` : ""} <ArrowRight className="ml-auto h-4 w-4" />
          </Link>
        )}

        {node.resources && node.resources.length > 0 && (
          <section className="mt-5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Library className="h-3.5 w-3.5" /> Learn more (official)</h3>
            <ul className="mt-2 divide-y rounded-lg border text-sm">
              {node.resources.map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2.5 hover:bg-accent/60">
                    <span className="w-16 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{RESOURCE_KIND[r.kind]}</span>
                    <span className="min-w-0 flex-1">{r.title}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {node.quiz && <Quiz node={node} view={view} onChange={onChange} />}

        {node.completeByReading && isSignedIn && view.personalised && (
          <Button className="mt-6" variant={node.read ? "outline" : "default"} disabled={busy} onClick={() => void toggleRead()}>
            {node.read ? "Mark as not done" : node.problems.length ? "I've finished these" : "Mark as done"}
          </Button>
        )}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </aside>
    </>
  );
}

/** Level 1-4 as the roadmap stage it belongs to. */
const STAGE: Record<number, string> = { 1: "Foundations", 2: "Core", 3: "Advanced", 4: "Expert" };

const RESOURCE_KIND: Record<string, string> = { docs: "Docs", trailhead: "Trailhead", guide: "Guide", video: "Video" };

/** A roadmap diagram. Click to open full size; the caption doubles as alt text. */
function Diagram({ name, caption, compact = false }: { name: string; caption: string; compact?: boolean }) {
  return (
    <figure className={cn(compact ? "mt-2" : "mt-5")}>
      <a href={diagramUrl(name)} target="_blank" rel="noopener noreferrer" title="Open full size">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={diagramUrl(name)} alt={caption} loading="lazy" className="w-full rounded-lg border shadow-sm" />
      </a>
      {!compact && <figcaption className="mt-1.5 text-xs text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

function Quiz({ node, view, onChange }: { node: RoadmapNode; view: RoadmapView; onChange: (v: RoadmapView) => void }) {
  const { isSignedIn, getToken } = useAuthState();
  const questions = node.quiz ?? [];
  const [picks, setPicks] = useState<(number | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const r = await submitQuiz(await getToken(), view.id, node.id, picks.map((p) => p ?? -1));
      setResult(r);
      onChange(r.roadmap);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not check your answers.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quiz {node.state === "done" && <span className="ml-1 normal-case text-emerald-700 dark:text-emerald-400">· passed</span>}</h3>
      <ol className="mt-2 space-y-4">
        {questions.map((q, i) => {
          const r = result?.results[i];
          return (
            <li key={i} className="text-sm">
              <p className="font-medium">{i + 1}. {q.q}</p>
              {q.image && <Diagram name={q.image} caption={q.imageAlt ?? q.q} compact />}
              <div className="mt-1.5 space-y-1">
                {q.options.map((o, j) => {
                  const picked = picks[i] === j;
                  const tone = r ? (j === r.answer ? "border-emerald-500 bg-emerald-500/10" : picked ? "border-destructive bg-destructive/10" : "") : picked ? "border-sky-500 bg-sky-500/10" : "";
                  return (
                    <button key={j} type="button" disabled={Boolean(result)} aria-pressed={picked} onClick={() => setPicks((cur) => cur.map((v, k) => (k === i ? j : v)))} className={cn("block w-full rounded-md border px-3 py-1.5 text-left transition-colors hover:bg-accent/60 disabled:hover:bg-transparent", tone)}>
                      {o}
                    </button>
                  );
                })}
              </div>
              {r && <p className={cn("mt-1 text-xs", r.correct ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>{r.correct ? "Correct. " : "Not quite. "}{r.why}</p>}
            </li>
          );
        })}
      </ol>
      {result && (
        <p role="status" className={cn("mt-4 rounded-lg p-3 text-sm font-medium", result.passed ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10")}>
          {result.correct}/{result.total} correct. {result.passed ? "Step complete!" : "You need all but one right. Reread the lesson and try again."}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {!isSignedIn || !view.personalised ? (
        <p className="mt-3 text-xs text-muted-foreground">Sign in and take the welcome quiz to save your progress.</p>
      ) : result ? (
        !result.passed && <Button className="mt-3" variant="outline" onClick={() => { setResult(null); setPicks(questions.map(() => null)); }}>Try again</Button>
      ) : (
        <Button className="mt-3" disabled={busy || picks.some((p) => p === null)} onClick={() => void check()}>Check answers</Button>
      )}
    </section>
  );
}
