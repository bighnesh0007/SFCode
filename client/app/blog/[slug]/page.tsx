"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, EyeOff, Pencil, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { SignInButton, useAuthState } from "@/components/auth";
import { Markdown } from "@/components/Markdown";
import { PostEditor } from "@/components/PostEditor";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { commentOn, deleteComment, deletePost, getPost, hidePost, updatePost, votePost, type PostView } from "@/lib/blogApi";
import { cn } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui/skeleton";

export default function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const router = useRouter();
  const [post, setPost] = useState<PostView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => setPost(await getPost(await getToken(), slug)), [getToken, slug]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    getToken()
      .then((t) => getPost(t, slug))
      .then((p) => !cancelled && setPost(p))
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not load this post."));
    return () => {
      cancelled = true;
    };
  }, [isLoaded, getToken, slug]);

  async function act(fn: () => Promise<unknown>) {
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (error) return <p className="py-24 text-center text-muted-foreground">{error}</p>;
  if (!post)
    return (
      <PageSkeleton blocks={3} className="max-w-3xl" />
    );

  const vote = (value: -1 | 1) =>
    act(async () => {
      const r = await votePost(await getToken(), post.slug, post.myVote === value ? 0 : value);
      setPost({ ...post, score: r.score, myVote: r.myVote });
    });

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground">← Blog</Link>
      {post.status === "hidden" && <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">Hidden by a moderator: only staff can see this post.</p>}

      {editing ? (
        <div className="mt-6">
          <PostEditor
            initial={{ title: post.title, body: post.body }}
            submitLabel="Save changes"
            onSubmit={async (title, body) => {
              setPost(await updatePost(await getToken(), post.slug, { title, body }));
              setEditing(false);
            }}
          />
        </div>
      ) : (
        <>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{post.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <Link href={`/u/${post.author.handle}`} className="flex items-center gap-2 hover:text-foreground">
              <Avatar src={post.author.imageUrl} name={post.author.displayName} size={24} /> {post.author.displayName}
            </Link>
            <span>{new Date(post.createdAt).toLocaleDateString()}</span>
            {post.updatedAt !== post.createdAt && <span>(edited)</span>}
            <span className="ml-auto flex gap-1">
              {post.canEdit && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
              )}
              {post.canEdit && (
                <Button size="sm" variant="ghost" onClick={() => void act(async () => { if (window.confirm("Delete this post permanently?")) { await deletePost(await getToken(), post.slug); router.push("/blog"); } })}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              )}
              {post.canModerate && !post.canEdit && (
                <Button size="sm" variant="ghost" onClick={() => void act(async () => { await hidePost(await getToken(), post.slug, post.status !== "hidden"); await load(); })}>
                  <EyeOff className="mr-1 h-3.5 w-3.5" /> {post.status === "hidden" ? "Unhide" : "Hide"}
                </Button>
              )}
            </span>
          </div>
          <Markdown source={post.body} className="markdown mt-8" />
        </>
      )}

      <div className="mt-8 flex items-center gap-1 border-t pt-4">
        {isSignedIn && !post.canEdit ? (
          <>
            <Button size="sm" variant={post.myVote === 1 ? "default" : "outline"} onClick={() => void vote(1)} aria-label="Upvote" aria-pressed={post.myVote === 1}><ArrowUp className="h-4 w-4" /></Button>
            <span className="w-8 text-center text-sm font-medium tabular-nums">{post.score}</span>
            <Button size="sm" variant={post.myVote === -1 ? "default" : "outline"} onClick={() => void vote(-1)} aria-label="Downvote" aria-pressed={post.myVote === -1}><ArrowDown className="h-4 w-4" /></Button>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">{post.score} point{Math.abs(post.score) === 1 ? "" : "s"}</span>
        )}
      </div>
      {notice && <p className="mt-2 text-sm text-destructive">{notice}</p>}

      <section className="mt-8">
        <h2 className="text-sm font-semibold">{post.comments.length} comment{post.comments.length === 1 ? "" : "s"}</h2>
        <ul className="mt-3 space-y-3">
          {post.comments.map((c) => (
            <li key={c.id} className={cn("rounded-lg border p-3", c.hidden && "opacity-60")}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Link href={`/u/${c.author.handle}`} className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary">
                  <Avatar src={c.author.imageUrl} name={c.author.displayName} size={18} /> {c.author.displayName}
                </Link>
                <span>{new Date(c.createdAt).toLocaleString()}</span>
                {c.hidden && <span>(hidden)</span>}
                {c.canDelete && !c.hidden && (
                  <button type="button" className="ml-auto hover:text-destructive" onClick={() => void act(async () => { await deleteComment(await getToken(), c.id); await load(); })}>Remove</button>
                )}
              </div>
              <Markdown source={c.body} className="markdown mt-1.5 text-sm" />
            </li>
          ))}
        </ul>
        {isSignedIn ? (
          <form
            className="mt-4 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                setPost(await commentOn(await getToken(), post.slug, comment));
                setComment("");
              });
            }}
          >
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Add a comment (Markdown supported)" aria-label="Comment" className="w-full rounded-md border bg-background p-3 text-sm" />
            <Button type="submit" size="sm" disabled={!comment.trim()}>Comment</Button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            <SignInButton><button type="button" className="text-primary hover:underline">Sign in</button></SignInButton> to vote and comment.
          </p>
        )}
      </section>
    </article>
  );
}
