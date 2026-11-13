"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Coins, Lightbulb, Loader2, Lock } from "lucide-react";
import { SignInButton, useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import { ApiError } from "@/lib/apiClient";
import { getLearning, revealHint, type LearningView } from "@/lib/challengesApi";
import { SOLVED_EVENT } from "@/lib/communityApi";

/**
 * Hints (bought in order with coins) and the editorial (unlocked by solving).
 * Rendered under the statement; nothing is shown for problems that have neither.
 */
export function LearningPanel({ slug, hintCount, hasEditorial }: { slug: string; hintCount: number; hasEditorial: boolean }) {
  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const [view, setView] = useState<LearningView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditorial, setShowEditorial] = useState(false);
  const [tick, setTick] = useState(0);

  // An accepted submission unlocks everything: fetch again when one lands.
  useEffect(() => {
    const onSolved = () => setTick((t) => t + 1);
    window.addEventListener(SOLVED_EVENT, onSolved);
    return () => window.removeEventListener(SOLVED_EVENT, onSolved);
  }, []);

  useEffect(() => {
    if (!isLoaded || (hintCount === 0 && !hasEditorial)) return;
    let cancelled = false;
    getToken()
      .then((t) => getLearning(t, slug))
      .then((v) => !cancelled && setView(v))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, slug, hintCount, hasEditorial, tick]);

  if (hintCount === 0 && !hasEditorial) return null;

  const revealed = view?.hints ?? [];
  const next = revealed.length + 1;
  const nextPrice = view?.prices[next - 1];

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      setView(await revealHint(await getToken(), slug, next));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reveal the hint.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      {hintCount > 0 && (
        <section className="rounded-lg border">
          <header className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            Hints
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {revealed.length}/{hintCount} revealed
            </span>
          </header>
          <ol className="divide-y">
            {revealed.map((h, i) => (
              <li key={i} className="flex gap-2 px-3 py-2.5 text-sm">
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{i + 1}.</span>
                <Markdown source={h} className="markdown flex-1 [&_p]:m-0" />
              </li>
            ))}
          </ol>
          {revealed.length < hintCount && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              {isLoaded && !isSignedIn ? (
                <SignInButton>
                  <Button size="sm" variant="outline">
                    Sign in to use hints
                  </Button>
                </SignInButton>
              ) : (
                <Button size="sm" variant="outline" disabled={busy || !view} onClick={() => void buy()}>
                  {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Coins className="mr-1 h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />}
                  Reveal hint {next}
                  {nextPrice !== undefined && ` · ${nextPrice} coins`}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">Each hint gets closer to the answer. Solving unlocks them all for free.</span>
              {error && <p className="w-full text-xs text-destructive">{error}</p>}
            </div>
          )}
        </section>
      )}

      {hasEditorial && (
        <section className="rounded-lg border">
          <header className="flex items-center gap-2 px-3 py-2 text-sm font-medium">
            <BookOpen className="h-4 w-4 text-sky-700 dark:text-sky-400" aria-hidden="true" />
            Editorial
            {view?.editorial ? (
              <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => setShowEditorial((s) => !s)} aria-expanded={showEditorial}>
                {showEditorial ? "Hide" : "Read the write-up"}
              </Button>
            ) : (
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden="true" /> Unlocks when you solve it
              </span>
            )}
          </header>
          {view?.editorial && showEditorial && (
            <div className="border-t px-3 py-3">
              <Markdown source={view.editorial} className="markdown text-sm" />
            </div>
          )}
          {!isSignedIn && isLoaded && (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              <Link href="/store" className="underline">
                Coins
              </Link>{" "}
              come from solving problems and the daily challenge.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
