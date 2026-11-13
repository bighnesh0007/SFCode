"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUp, MessageSquare, PenLine, PenSquare } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuthState } from "@/components/auth";
import { buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { listPosts, type PostSummary } from "@/lib/blogApi";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";

export default function BlogPage() {
  const { isSignedIn } = useAuthState();
  const [sort, setSort] = useState<"new" | "top">("new");
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPosts(sort)
      .then((p) => !cancelled && setPosts(p))
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not load posts."));
    return () => {
      cancelled = true;
    };
  }, [sort]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
          <p className="mt-1 text-sm text-muted-foreground">Write-ups, tips and solutions from the community.</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Sort" className="flex rounded-md border p-0.5 text-xs">
            {(["new", "top"] as const).map((s) => (
              <button key={s} role="tab" type="button" aria-selected={sort === s} onClick={() => { setPosts(null); setSort(s); }} className={cn("rounded px-3 py-1 capitalize", sort === s ? "bg-accent font-medium" : "text-muted-foreground")}>
                {s}
              </button>
            ))}
          </div>
          {isSignedIn && (
            <Link href="/blog/new" className={buttonVariants({ size: "sm" })}>
              <PenSquare className="mr-1 h-3.5 w-3.5" /> Write
            </Link>
          )}
        </div>
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <ul className="mt-6 divide-y rounded-lg border">
        {posts === null && !error
          ? Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="p-4"><div className="h-12 animate-pulse rounded bg-muted" /></li>
            ))
          : posts?.map((p) => (
              <li key={p.slug} className="p-4 hover:bg-accent/40">
                <Link href={`/blog/${p.slug}`} className="block">
                  <h2 className="font-medium">{p.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>
                </Link>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <Link href={`/u/${p.author.handle}`} className="flex items-center gap-1.5 hover:text-foreground">
                    <Avatar src={p.author.imageUrl} name={p.author.displayName} size={16} /> {p.author.displayName}
                  </Link>
                  <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /> {p.score}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {p.commentCount}</span>
                </div>
              </li>
            ))}
        {posts?.length === 0 && (
          <li>
            <EmptyState icon={PenLine} title="No posts yet" action={isSignedIn ? { href: "/blog/new", label: "Write the first one" } : undefined}>
              Tips, war stories and study notes from Salesforce developers will show up here.
            </EmptyState>
          </li>
        )}
      </ul>
    </div>
  );
}
