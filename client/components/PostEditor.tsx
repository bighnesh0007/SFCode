"use client";

import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Title + Markdown body with a Write / Preview toggle. */
export function PostEditor({ initial, submitLabel, onSubmit }: { initial?: { title: string; body: string }; submitLabel: string; onSubmit: (title: string, body: string) => Promise<void> }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(title, body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={120} aria-label="Title" className="h-11 w-full rounded-md border bg-background px-3 text-lg font-medium" />
      <div className="flex gap-1 text-xs">
        {(["write", "preview"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded-md px-2.5 py-1 capitalize", tab === t ? "bg-accent font-medium" : "text-muted-foreground")}>
            {t}
          </button>
        ))}
        <span className="ml-auto self-center text-muted-foreground">Markdown supported</span>
      </div>
      {tab === "write" ? (
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your post…" aria-label="Post body" rows={16} className="w-full rounded-md border bg-background p-3 font-mono text-sm" />
      ) : (
        <div className="min-h-[16rem] rounded-md border p-4">{body.trim() ? <Markdown source={body} className="markdown" /> : <p className="text-sm text-muted-foreground">Nothing to preview.</p>}</div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button disabled={busy} onClick={() => void submit()}>{submitLabel}</Button>
    </div>
  );
}
