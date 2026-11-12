"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { listPosts } from "@/lib/blogApi";
import { listChallenges, type ChallengeSummary } from "@/lib/challengesApi";
import { TRACK_INFO, trackInfo } from "@/lib/tracks";
import { cn } from "@/lib/utils";

interface Item {
  href: string;
  title: string;
  detail: string;
  group: string;
  haystack: string;
}

/** Fixed destinations; problems are loaded on first open. */
const PAGES: Item[] = [
  { href: "/problems", title: "Problems", detail: "All tracks", group: "Pages" },
  { href: "/playground/apex", title: "Apex Playground", detail: "Run anonymous Apex", group: "Pages" },
  { href: "/certification", title: "Certification Prep", detail: "PD I and PD II", group: "Pages" },
  { href: "/certification/pd1", title: "Platform Developer I practice", detail: "Certification", group: "Pages" },
  { href: "/certification/pd2", title: "Platform Developer II practice", detail: "Certification", group: "Pages" },
  { href: "/leaderboard", title: "Leaderboard", detail: "Rankings", group: "Pages" },
  { href: "/profile", title: "My profile", detail: "Progress and activity", group: "Pages" },
  { href: "/settings/org", title: "Salesforce org", detail: "Connect or disconnect", group: "Pages" },
  { href: "/blog", title: "Blog", detail: "Community posts", group: "Pages" },
].map((p) => ({ ...p, haystack: `${p.title} ${p.detail}`.toLowerCase() }));

function problemItem(c: ChallengeSummary): Item {
  const t = trackInfo(c.track);
  return {
    href: `${t.base}/${c.slug}`,
    title: c.title,
    detail: `${t.label} · ${c.difficulty} · ${c.category}`,
    group: "Problems",
    haystack: [c.title, c.category, c.difficulty, t.label, ...c.tags].join(" ").toLowerCase(),
  };
}

/** Every word of the query must appear somewhere (order-free, case-insensitive). */
function matches(item: Item, words: string[]): boolean {
  return words.every((w) => item.haystack.includes(w));
}

/**
 * `shortcut`: whether this instance owns ⌘K. The navbar renders one palette
 * for desktop and one for mobile (CSS hides one, both stay mounted); if both
 * listened, one keypress would open and immediately close the palette.
 */
export function SearchPalette({ shortcut = false }: { shortcut?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [problems, setProblems] = useState<Item[] | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K anywhere; Escape closes.
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    if (problems !== null) return;
    // One request per track; the list endpoint filters by track.
    const posts = listPosts("new")
      .then((ps) => ps.map((p): Item => ({ href: `/blog/${p.slug}`, title: p.title, detail: `Blog · ${p.author.displayName}`, group: "Blog", haystack: `${p.title} ${p.excerpt} blog`.toLowerCase() })))
      .catch(() => [] as Item[]);
    Promise.all([...TRACK_INFO.map((t) => listChallenges(null, t.id).then((d) => d.challenges.map(problemItem)).catch(() => [] as Item[])), posts])
      .then((lists) => setProblems(lists.flat()))
      .catch(() => setProblems([]));
  }, [open, problems]);

  const results = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const all = [...(problems ?? []), ...PAGES];
    return (words.length === 0 ? PAGES : all.filter((i) => matches(i, words))).slice(0, 30);
  }, [query, problems]);

  function go(item: Item | undefined) {
    if (!item) return;
    setOpen(false);
    setQuery("");
    router.push(item.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Search (Ctrl+K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">Search</span>
        <kbd className="hidden rounded border px-1 font-mono text-[10px] lg:inline">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[12vh]" onMouseDown={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="w-full max-w-xl overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={input}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, results.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter") {
                    go(results[active]);
                  } else if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
                placeholder="Search problems, topics, pages…"
                aria-label="Search"
                aria-controls="search-results"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ul id="search-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
              {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{problems === null ? "Loading…" : "No matches."}</li>}
              {results.map((item, i) => (
                <li key={item.href} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item)}
                    className={cn("flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm", i === active && "bg-accent")}
                  >
                    <span className="truncate">{item.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{item.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
