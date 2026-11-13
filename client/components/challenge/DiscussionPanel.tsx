"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EyeOff, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { SignInButton, useAuthState } from "@/components/auth";
import { Avatar } from "@/components/Avatar";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { deleteComment, getDiscussion, hideComment, postComment, type DiscussionComment } from "@/lib/discussionApi";
import { cn } from "@/lib/utils";

const MAX = 4000;

/** The discussion under a problem: read by anyone, written by signed-in learners. */
export function DiscussionPanel({ slug }: { slug: string }) {
  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const [comments, setComments] = useState<DiscussionComment[] | null>(null);
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setComments(await getDiscussion(await getToken(), slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the discussion.");
    }
  }, [getToken, slug]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    getToken()
      .then((t) => getDiscussion(t, slug))
      .then((c) => !cancelled && setComments(c))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Could not load the discussion."));
    return () => {
      cancelled = true;
    };
  }, [isLoaded, getToken, slug]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      setComments(await postComment(await getToken(), slug, body, spoiler));
      setBody("");
      setSpoiler(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post.");
    } finally {
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update.");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Ask questions, share approaches, help others. Posting a full solution? Mark it as a spoiler.</p>

      {isSignedIn ? (
        <div className="space-y-2 rounded-lg border p-3">
          <label className="sr-only" htmlFor="discussion-body">Your comment</label>
          <textarea id="discussion-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={MAX} rows={4} placeholder="Markdown and code blocks work." className="w-full resize-y rounded-md border bg-background p-2 text-sm" />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} /> Contains a solution (spoiler)
            </label>
            <span className="text-xs text-muted-foreground">{body.length}/{MAX}</span>
            <Button size="sm" className="ml-auto" disabled={busy || body.trim().length < 2} onClick={() => void submit()}>
              {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Post
            </Button>
          </div>
        </div>
      ) : (
        isLoaded && (
          <SignInButton>
            <Button size="sm" variant="outline">Sign in to join the discussion</Button>
          </SignInButton>
        )
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {comments === null && !error && <div className="h-20 animate-pulse rounded-lg bg-muted/50" />}
      {comments?.length === 0 && (
        <div className="flex flex-col items-center py-8 text-center text-sm text-muted-foreground">
          <MessageSquare className="h-6 w-6" aria-hidden="true" />
          <p className="mt-2">No comments yet. Start the conversation.</p>
        </div>
      )}
      <ol className="space-y-3">
        {comments?.map((c) => (
          <li key={c.id} className={cn("rounded-lg border p-3", c.hidden && "border-dashed opacity-70")}>
            <div className="flex items-center gap-2 text-xs">
              <Avatar src={c.author.imageUrl} name={c.author.displayName} size={20} />
              <Link href={`/u/${c.author.handle}`} className="font-medium hover:text-primary">{c.author.displayName}</Link>
              <span className="text-muted-foreground">{new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
              {c.hidden && <span className="rounded bg-muted px-1.5 text-[10px] uppercase">Hidden</span>}
              <span className="ml-auto flex gap-1">
                {c.canHide && (
                  <button type="button" onClick={() => void act(async () => hideComment(await getToken(), c.id, !c.hidden))} className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label={c.hidden ? "Restore comment" : "Hide comment"} title={c.hidden ? "Restore" : "Hide"}>
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                )}
                {c.canDelete && (
                  <button type="button" onClick={() => window.confirm("Delete your comment?") && void act(async () => deleteComment(await getToken(), c.id))} className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label="Delete comment" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </div>
            {c.spoiler ? <Spoiler body={c.body} /> : <Markdown source={c.body} className="markdown mt-2 text-sm" />}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Blurred until the reader chooses to see it. */
function Spoiler({ body }: { body: string }) {
  const [shown, setShown] = useState(false);
  if (shown) return <Markdown source={body} className="markdown mt-2 text-sm" />;
  return (
    <button type="button" onClick={() => setShown(true)} className="mt-2 block w-full rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground hover:bg-accent/50">
      Contains a solution. Show it anyway?
    </button>
  );
}
