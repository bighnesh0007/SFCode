"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Pencil, Search, Trash2 } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { PhasePill } from "@/components/PhasePill";
import { ContestForm, type ContestDraft } from "@/components/admin/ContestForm";
import { useLoad } from "@/components/admin/AdminTools";
import { getAdminStore, getModeration, getProblemStats, setCommentHidden, setStoreItem, type AdminStoreItem, type ProblemStatRow } from "@/lib/adminApi";
import { hidePost } from "@/lib/blogApi";
import { deleteContest, getContest, listContests } from "@/lib/contestApi";
import { trackInfo } from "@/lib/tracks";
import type { Track } from "@/lib/challengesApi";
import { cn } from "@/lib/utils";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

// ── Contests ─────────────────────────────────────────────────────────────────

export function ContestsTab() {
  const { getToken } = useAuthState();
  const { data, error, reload } = useLoad(() => listContests());
  const [editing, setEditing] = useState<ContestDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function edit(slug: string) {
    setMessage(null);
    try {
      const c = await getContest(await getToken(), slug);
      setEditing({ slug: c.slug, title: c.title, startsAt: c.startsAt, endsAt: c.endsAt, problems: c.problems.map((p) => ({ slug: p.slug, points: p.points })) });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load the contest.");
    }
  }

  async function remove(slug: string, title: string) {
    if (!window.confirm(`Delete "${title}"? It hasn't started, so nobody loses progress, but this can't be undone.`)) return;
    setMessage(null);
    try {
      await deleteContest(await getToken(), slug);
      setMessage(`Deleted "${title}".`);
      reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not delete.");
    }
  }

  return (
    <section className="mt-5 space-y-4">
      <p className="text-xs text-muted-foreground">Schedule contests, and edit or delete ones that haven&apos;t started. Live and finished contests can&apos;t change, so results stay fair.</p>
      {editing ? (
        <div>
          <p className="text-sm font-medium">Editing &ldquo;{editing.title}&rdquo;</p>
          <ContestForm
            key={editing.slug}
            editing={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              setMessage("Saved.");
              reload();
            }}
          />
        </div>
      ) : (
        <ContestForm onSaved={reload} />
      )}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2.5 pl-4 font-normal">Contest</th>
              <th className="py-2.5 font-normal">When</th>
              <th className="py-2.5 text-right font-normal">Problems</th>
              <th className="py-2.5 text-right font-normal">Entrants</th>
              <th className="py-2.5 pr-4 text-right font-normal">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.slug} className="border-t">
                <td className="py-2 pl-4">
                  <Link href={`/contests/${c.slug}`} className="font-medium hover:text-primary hover:underline">
                    {c.title}
                  </Link>{" "}
                  <PhasePill phase={c.phase} />
                </td>
                <td className="whitespace-nowrap py-2 text-xs text-muted-foreground">
                  {when(c.startsAt)} – {when(c.endsAt)}
                </td>
                <td className="py-2 text-right tabular-nums">{c.problemCount}</td>
                <td className="py-2 text-right tabular-nums">{c.entrants}</td>
                <td className="space-x-1 whitespace-nowrap py-2 pr-4 text-right">
                  {c.phase === "upcoming" && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => void edit(c.slug)} aria-label={`Edit ${c.title}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void remove(c.slug, c.title)} aria-label={`Delete ${c.title}`}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr className="border-t">
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No contests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Store ────────────────────────────────────────────────────────────────────

export function StoreTab() {
  const { data, error, reload } = useLoad(getAdminStore);
  return (
    <section className="mt-5">
      <p className="text-xs text-muted-foreground">Change prices or take items off sale. People who already bought an item keep it and can still wear it. New item designs need code.</p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <ul className="mt-3 space-y-2">
        {data?.map((i) => <StoreRow key={i.id} item={i} onSaved={reload} />)}
      </ul>
    </section>
  );
}

function StoreRow({ item, onSaved }: { item: AdminStoreItem; onSaved: () => void }) {
  const { getToken } = useAuthState();
  const [price, setPrice] = useState(String(item.price));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const priceNum = Number(price);
  const valid = Number.isInteger(priceNum) && priceNum >= 0 && priceNum <= 100_000;

  async function save(change: { price: number; retired: boolean }) {
    setBusy(true);
    setMessage(null);
    try {
      await setStoreItem(await getToken(), item.id, change);
      setMessage("Saved.");
      onSaved();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={cn("flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3", item.retired && "opacity-70")}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {item.name} <span className="text-xs font-normal text-muted-foreground">· {item.slot}</span>
          {item.retired && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">Retired</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {item.owners} {item.owners === 1 ? "owner" : "owners"}
          {item.price !== item.basePrice && ` · default price ${item.basePrice}`}
        </p>
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">Price</span>
        <input type="number" min={0} max={100000} value={price} onChange={(e) => setPrice(e.target.value)} className="h-8 w-24 rounded-md border bg-background px-2 text-right tabular-nums" aria-label={`Price of ${item.name}`} />
      </label>
      <Button size="sm" variant="outline" disabled={busy || !valid || priceNum === item.price} onClick={() => void save({ price: priceNum, retired: item.retired })}>
        Save price
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void save({ price: item.price, retired: !item.retired })}>
        {item.retired ? "Put back on sale" : "Retire"}
      </Button>
      {message && <p className="w-full text-xs text-muted-foreground">{message}</p>}
    </li>
  );
}

// ── Problems ─────────────────────────────────────────────────────────────────

type SortKey = "title" | "attempters" | "solvers" | "solveRate" | "submissions";

export function ProblemsTab() {
  const { data, error } = useLoad(getProblemStats);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("attempters");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data ?? []).filter((p) => !q || p.title.toLowerCase().includes(q) || p.slug.includes(q) || p.track.includes(q));
    const val = (p: ProblemStatRow) => (sort === "title" ? p.title : sort === "solveRate" ? (p.solveRate ?? -1) : p[sort]);
    // Lowest solve rate first (where people struggle); everything else biggest first.
    return [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (typeof x === "string" && typeof y === "string") return x.localeCompare(y);
      return sort === "solveRate" ? Number(x) - Number(y) : Number(y) - Number(x);
    });
  }, [data, query, sort]);

  return (
    <section className="mt-5">
      <p className="text-xs text-muted-foreground">Every problem, built-in and community. Solve rate is people who solved it out of people who tried, so one learner retrying doesn&apos;t skew it.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <label className="relative min-w-[12rem] flex-1">
          <span className="sr-only">Search problems</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title, slug or track" className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm" />
        </label>
        <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="attempters">Most tried</option>
          <option value="solvers">Most solved</option>
          <option value="solveRate">Lowest solve rate</option>
          <option value="submissions">Most submissions</option>
          <option value="title">Title</option>
        </select>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-3 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2.5 pl-4 font-normal">Problem</th>
              <th className="py-2.5 text-right font-normal">Tried</th>
              <th className="py-2.5 text-right font-normal">Solved</th>
              <th className="py-2.5 text-right font-normal">Solve rate</th>
              <th className="py-2.5 pr-4 text-right font-normal">Submissions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.slug} className="border-t">
                <td className="max-w-72 py-2 pl-4">
                  <Link href={`${trackInfo(p.track as Track).base}/${p.slug}`} className="block truncate font-medium hover:text-primary hover:underline">
                    {p.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {trackInfo(p.track as Track).label} · {p.difficulty}
                    {p.community && " · community"}
                  </span>
                </td>
                <td className="py-2 text-right tabular-nums">{p.attempters}</td>
                <td className="py-2 text-right tabular-nums">{p.solvers}</td>
                <td className={cn("py-2 text-right tabular-nums", p.solveRate !== null && p.solveRate < 30 && "font-medium text-amber-700 dark:text-amber-400")}>{p.solveRate === null ? "—" : `${p.solveRate}%`}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{p.submissions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Community problems can be unpublished from the Community problems tab.</p>
    </section>
  );
}

// ── Moderation ───────────────────────────────────────────────────────────────

export function ModerationTab() {
  const { getToken } = useAuthState();
  const { data, error, reload } = useLoad(getModeration);
  const [show, setShow] = useState<"all" | "hidden">("all");
  const [message, setMessage] = useState<string | null>(null);

  async function act(fn: (token: string | null) => Promise<void>) {
    setMessage(null);
    try {
      await fn(await getToken());
      reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not update.");
    }
  }

  const posts = (data?.posts ?? []).filter((p) => show === "all" || p.hidden);
  const comments = (data?.comments ?? []).filter((c) => show === "all" || c.hidden);
  return (
    <section className="mt-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">The newest blog posts and comments, hidden ones included. Hiding keeps the content but takes it out of view; restore any time.</p>
        <select aria-label="Show" value={show} onChange={(e) => setShow(e.target.value as "all" | "hidden")} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="all">Everything recent</option>
          <option value="hidden">Hidden only</option>
        </select>
      </div>
      {message && <p className="text-sm text-destructive">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <h3 className="text-sm font-semibold">Posts</h3>
        <ul className="mt-2 divide-y rounded-lg border">
          {posts.map((p) => (
            <li key={p.slug} className={cn("flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm", p.hidden && "bg-muted/40")}>
              <div className="min-w-0 flex-1">
                <Link href={`/blog/${p.slug}`} className="font-medium hover:text-primary hover:underline">
                  {p.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  @{p.author.handle} · {when(p.createdAt)} · score {p.score} · {p.comments} comments{p.hidden && " · hidden"}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => void act((t) => hidePost(t, p.slug, !p.hidden))}>
                {p.hidden ? <Eye className="mr-1 h-3.5 w-3.5" /> : <EyeOff className="mr-1 h-3.5 w-3.5" />}
                {p.hidden ? "Restore" : "Hide"}
              </Button>
            </li>
          ))}
          {posts.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing here.</li>}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Comments</h3>
        <ul className="mt-2 divide-y rounded-lg border">
          {comments.map((c) => (
            <li key={c.id} className={cn("flex flex-wrap items-start gap-3 px-4 py-2.5 text-sm", c.hidden && "bg-muted/40")}>
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words">{c.body}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  @{c.author.handle} on{" "}
                  <Link href={`/blog/${c.post.slug}`} className="hover:underline">
                    {c.post.title}
                  </Link>{" "}
                  · {when(c.createdAt)}
                  {c.hidden && " · hidden"}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => void act((t) => setCommentHidden(t, c.id, !c.hidden))}>
                {c.hidden ? <Eye className="mr-1 h-3.5 w-3.5" /> : <EyeOff className="mr-1 h-3.5 w-3.5" />}
                {c.hidden ? "Restore" : "Hide"}
              </Button>
            </li>
          ))}
          {comments.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing here.</li>}
        </ul>
      </div>
    </section>
  );
}
