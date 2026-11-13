"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Snowflake } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { usePoints } from "@/components/usePoints";
import { useAuthState } from "@/components/auth";
import { Flair, accentClass, frameClass } from "@/components/Cosmetics";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { buyItem, equipItem, getStore, type StoreItem, type StoreView } from "@/lib/contestApi";
import { cn } from "@/lib/utils";

const SLOT_TITLE: Record<StoreItem["slot"], string> = { frame: "Avatar frames", badge: "Badges", accent: "Name colours", editor: "Editor themes" };

/** A few highlighted lines, so editor themes can be compared before buying. */
const EDITOR_PREVIEW: Record<string, { bg: string; kw: string; str: string; com: string; fg: string }> = {
  midnight: { bg: "#1a1033", kw: "#c792ea", str: "#c3e88d", com: "#676e95", fg: "#e2e2f0" },
  paper: { bg: "#fbf6ec", kw: "#8f3f71", str: "#4f7a28", com: "#9c8f7a", fg: "#3b3a36" },
};

function Preview({ item }: { item: StoreItem }) {
  const ed = item.slot === "editor" ? EDITOR_PREVIEW[item.style] : undefined;
  if (ed)
    return (
      <pre className="h-14 overflow-hidden rounded-md p-2 font-mono text-[11px] leading-4" style={{ background: ed.bg, color: ed.fg }}>
        <span style={{ color: ed.com }}>{"// bulk-safe!"}</span>
        {"\n"}
        <span style={{ color: ed.kw }}>for</span> (Account a : accts) {"{"}
        {"\n"}  a.Rating = <span style={{ color: ed.str }}>{"'Hot'"}</span>; {"}"}
      </pre>
    );
  return (
    <div className="flex h-14 items-center gap-2">
      <Avatar src={null} name="You" size={32} className={item.slot === "frame" ? frameClass(item.style) : undefined} />
      <span className={cn("font-medium", item.slot === "accent" ? accentClass(item.style) : undefined)}>Your Name</span>
      {item.slot === "badge" && <Flair badge={item.style} />}
    </div>
  );
}

export default function StorePage() {
  const points = usePoints();
  const { isSignedIn, getToken } = useAuthState();
  const [view, setView] = useState<StoreView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    getToken()
      .then((t) => getStore(t))
      .then(setView)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Could not load the store."));
  }, [getToken]);
  useEffect(load, [load, isSignedIn]);

  async function act(id: string, run: (token: string | null) => Promise<StoreView>) {
    setBusy(id);
    setError(null);
    try {
      setView(await run(await getToken()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  const wallet = view?.wallet;
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Store</h1>
          <p className="mt-1 text-sm text-muted-foreground">Earn coins by solving problems (each problem&apos;s points × {points?.coinsPerPoint ?? "…"}, once each) and placing top three in contests, plus a bonus for each Daily Challenge solved on the day. Spend them on cosmetics; nothing here affects grading.</p>
        </div>
        {wallet && (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2" title={`${wallet.earnedFromSolves} from solves + ${wallet.earnedFromContests} from contests + ${wallet.earnedFromDaily} from Daily Challenges − ${wallet.spent} spent`}>
            <Coins className="h-4 w-4 text-amber-500" />
            <span className="text-lg font-semibold tabular-nums">{wallet.balance}</span>
            <span className="text-xs text-muted-foreground">coins</span>
          </div>
        )}
      </div>
      {!isSignedIn && <p className="mt-4 text-sm text-muted-foreground">Sign in to see your coins and buy items.</p>}
      {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}
      {view && <FreezeCard view={view} busy={busy} signedIn={isSignedIn} onBuy={() => void act("freeze", (t) => buyItem(t, view.freeze.id))} />}
      {(["frame", "badge", "accent", "editor"] as const).map((slot) => (
        <section key={slot} className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{SLOT_TITLE[slot]}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {view === null && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-lg border bg-muted/40" />)}
            {view?.items.filter((i) => i.slot === slot).map((item) => (
              <div key={item.id} className={cn("flex flex-col rounded-lg border p-4", item.equipped && "border-primary")}>
                <Preview item={item} />
                <div className="mt-2 font-medium">{item.name}</div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="inline-flex items-center gap-1 text-sm font-medium tabular-nums"><Coins className="h-3.5 w-3.5 text-amber-500" />{item.price}</span>
                  {!isSignedIn ? null : item.owned ? (
                    <Button size="sm" variant={item.equipped ? "secondary" : "outline"} disabled={busy === item.id} onClick={() => void act(item.id, (t) => equipItem(t, item.id, !item.equipped))}>
                      {item.equipped ? "Unequip" : "Equip"}
                    </Button>
                  ) : (
                    <Button size="sm" disabled={busy === item.id || (wallet ? wallet.balance < item.price : true)} onClick={() => void act(item.id, (t) => buyItem(t, item.id))}>Buy</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FreezeCard({ view, busy, signedIn, onBuy }: { view: StoreView; busy: string | null; signedIn: boolean; onBuy: () => void }) {
  const f = view.freeze;
  const full = f.available >= f.max;
  return (
    <section className="mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-cyan-500/5 to-transparent p-5">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300"><Snowflake className="h-6 w-6" /></span>
      <div className="min-w-[14rem] flex-1">
        <h2 className="font-semibold">{f.name}</h2>
        <p className="text-sm text-muted-foreground">{f.description} Hold up to {f.max}.</p>
        {signedIn && <p className="mt-1 text-xs text-muted-foreground">You have <b>{f.available}</b> ready{f.owned > f.available ? ` (${f.owned - f.available} already saved your streak)` : ""}.</p>}
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-medium tabular-nums"><Coins className="h-3.5 w-3.5 text-amber-500" />{f.price}</span>
      {signedIn && (
        <Button size="sm" disabled={busy !== null || full || (view.wallet ? view.wallet.balance < f.price : true)} onClick={onBuy}>
          {full ? "Fully stocked" : "Buy freeze"}
        </Button>
      )}
    </section>
  );
}
