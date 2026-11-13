"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, ExternalLink, MapPin } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { getStanding } from "@/lib/adminApi";
import { ApiError } from "@/lib/apiClient";
import { deleteJob, getJobs, postJob, type JobsView } from "@/lib/hubApi";

export default function JobsPage() {
  const { isSignedIn, getToken } = useAuthState();
  const [view, setView] = useState<JobsView | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    getJobs().then(setView).catch(() => setView({ jobs: [], openToWork: [] }));
  }, []);
  useEffect(() => {
    if (!isSignedIn) return;
    getToken().then(getStanding).then((s) => setIsAdmin(s === "owner" || s === "admin")).catch(() => {});
  }, [isSignedIn, getToken]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Briefcase className="h-6 w-6 text-sky-500" /> Job corner</h1>
      <p className="mt-1 text-sm text-muted-foreground">Salesforce roles shared with the community, and learners who are open to work.</p>
      {isAdmin && <PostJob onPosted={setView} />}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Open roles</h2>
        <ul className="mt-3 space-y-3">
          {view === null && <li className="h-20 animate-pulse rounded-xl border bg-muted/40" />}
          {view?.jobs.length === 0 && <li className="rounded-xl border p-6 text-center text-sm text-muted-foreground">No roles posted right now.</li>}
          {view?.jobs.map((j) => (
            <li key={j.id} className="flex flex-wrap items-start gap-3 rounded-xl border p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{j.title}</p>
                <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground"><span>{j.company}</span><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{j.location}</span></p>
                <div className="mt-2 flex flex-wrap gap-1">{j.tags.map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{t}</span>)}</div>
              </div>
              <a href={j.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">Apply <ExternalLink className="h-3.5 w-3.5" /></a>
              {isAdmin && <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={async () => setView(await deleteJob(await getToken(), j.id))}>Remove</button>}
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Open to work</h2>
        <p className="mt-1 text-xs text-muted-foreground">Learners who switched on &ldquo;Open to work&rdquo; in their profile&apos;s About section.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {view?.openToWork.length === 0 && <p className="text-sm text-muted-foreground">Nobody yet.</p>}
          {view?.openToWork.map((p) => (
            <Link key={p.handle} href={`/u/${p.handle}`} className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm hover:bg-accent">
              <Avatar src={p.imageUrl} name={p.displayName} size={24} /> {p.displayName}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function PostJob({ onPosted }: { onPosted: (v: JobsView) => void }) {
  const { getToken } = useAuthState();
  const [f, setF] = useState({ title: "", company: "", location: "Remote", url: "https://", tags: "", days: 30 });
  const [error, setError] = useState<string | null>(null);
  const input = "h-9 w-full rounded-md border bg-background px-2 text-sm";
  async function submit() {
    setError(null);
    try {
      onPosted(await postJob(await getToken(), { ...f, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6) }));
      setF({ title: "", company: "", location: "Remote", url: "https://", tags: "", days: 30 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not post.");
    }
  }
  return (
    <details className="mt-6 rounded-xl border p-4">
      <summary className="cursor-pointer text-sm font-semibold">Post a role (admins)</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input aria-label="Title" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={input} />
        <input aria-label="Company" placeholder="Company" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} className={input} />
        <input aria-label="Location" placeholder="Location" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} className={input} />
        <input aria-label="Apply URL (https)" placeholder="https://…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} className={input} />
        <input aria-label="Tags" placeholder="Tags, comma-separated" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} className={input} />
        <label className="flex items-center gap-2 text-sm">Show for <input type="number" min={1} max={90} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} className="h-9 w-20 rounded-md border bg-background px-2" /> days</label>
      </div>
      <Button size="sm" className="mt-3" onClick={() => void submit()}>Post</Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </details>
  );
}
