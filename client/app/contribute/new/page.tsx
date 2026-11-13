"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bug, Code2, Database } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { ApiError } from "@/lib/apiClient";
import { blankContent, createDraft, type DraftTrack } from "@/lib/draftsApi";

const TRACKS: { id: DraftTrack; title: string; body: string; icon: typeof Code2 }[] = [
  { id: "apex", title: "Apex", body: "Learners write classes or triggers; your hidden tests grade them.", icon: Code2 },
  { id: "debug", title: "Debugging", body: "Learners start from broken code (your starter) and fix it.", icon: Bug },
  { id: "soql", title: "SOQL", body: "Learners write one query; rows are compared with your reference query.", icon: Database },
];

export default function NewDraftPage() {
  const { getToken } = useAuthState();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(track: DraftTrack) {
    setBusy(true);
    setError(null);
    try {
      const d = await createDraft(await getToken(), { ...blankContent(track), title: `New ${track === "debug" ? "debugging" : track.toUpperCase() === "SOQL" ? "SOQL" : "Apex"} problem` });
      router.push(`/contribute/drafts/${d.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the draft.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">New problem</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pick a track. You&apos;ll get a working template to edit. Flow and LWC problems come later.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {TRACKS.map((t) => (
          <button key={t.id} type="button" disabled={busy} onClick={() => void start(t.id)} className="rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-sky-500/60 hover:shadow-md disabled:opacity-50">
            <t.icon className="h-5 w-5 text-sky-700 dark:text-sky-400" />
            <h2 className="mt-2 font-semibold">{t.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
          </button>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </div>
  );
}
