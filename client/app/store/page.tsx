"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Coins, Eye, Snowflake, Sparkles } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { usePoints } from "@/components/usePoints";
import { useAuthState } from "@/components/auth";
import { Banner, Flair, RARITY, accentClass, frameClass, type Rarity } from "@/components/Cosmetics";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { buyItem, equipItem, getStore, type StoreItem, type StoreView } from "@/lib/contestApi";
import { cn } from "@/lib/utils";

type Slot = StoreItem["slot"];
const SLOTS: { id: Slot; title: string }[] = [
  { id: "banner", title: "Profile banners" },
  { id: "frame", title: "Avatar frames" },
  { id: "accent", title: "Name effects" },
  { id: "badge", title: "Badges" },
  { id: "editor", title: "Editor themes" },
];
const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];
const rarityOf = (i: StoreItem): Rarity => i.rarity ?? "common";

/** A few highlighted lines, so editor themes can be compared before buying. */
const EDITOR_PREVIEW: Record<string, { bg: string; kw: string; str: string; com: string; fg: string }> = {
  midnight: { bg: "#1a1033", kw: "#c792ea", str: "#c3e88d", com: "#676e95", fg: "#e2e2f0" },
  paper: { bg: "#fbf6ec", kw: "#8f3f71", str: "#4f7a28", com: "#9c8f7a", fg: "#3b3a36" },
};

/** What a single item looks like on its card. */
function ItemPreview({ item }: { item: StoreItem }) {
  const ed = item.slot === "editor" ? EDITOR_PREVIEW[item.style] : undefined;
  if (ed)
    return (
      <pre className="h-20 overflow-hidden rounded-md p-2 font-mono text-[11px] leading-4" style={{ background: ed.bg, color: ed.fg }}>
        <span style={{ color: ed.com }}>{"// bulk-safe!"}</span>
        {"\n"}
        <span style={{ color: ed.kw }}>for</span> (Account a : accts) {"{"}
        {"\n"}  a.Rating = <span style={{ color: ed.str }}>{"'Hot'"}</span>; {"}"}
      </pre>
    );
  if (item.slot === "banner") return <Banner banner={item.style} className="h-20 rounded-md" />;
  return (
    <div className="flex h-20 items-center justify-center gap-2 rounded-md bg-muted/40">
      <Avatar src={null} name="You" size={36} className={item.slot === "frame" ? frameClass(item.style) : undefined} />
      <span className={cn("font-semibold", item.slot === "accent" ? accentClass(item.style) : undefined)}>Your Name</span>
      {item.slot === "badge" && <Flair badge={item.style} />}
    </div>
  );
}

/** Your profile header as it would look with `look` applied. */
function TryOn({ look, previewing, onReset }: { look: Partial<Record<Slot, string>>; previewing: StoreItem | null; onReset: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Banner banner={look.banner} className="h-24" />
      {!look.banner && <div className="h-24 bg-gradient-to-br from-muted to-muted/30" aria-hidden="true" />}
      <div className="-mt-8 px-4 pb-4">
        <Avatar src={null} name="You" size={56} className={cn(frameClass(look.frame), "border-4 border-card")} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={cn("text-lg font-semibold", accentClass(look.accent))}>Your Name</span>
          <Flair badge={look.badge} />
        </div>
        <p className="text-xs text-muted-foreground">@you · Salesforce developer</p>
      </div>
      <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
        {previewing ? (
          <>
            <span className="truncate">
              Trying on <b className="text-foreground">{previewing.name}</b>
            </span>
            <button type="button" className="shrink-0 underline hover:text-foreground" onClick={onReset}>
              Reset
            </button>
          </>
        ) : (
          <span>Your current look. Click Preview on any item to try it on.</span>
        )}
      </div>
    </div>
  );
}

export default function StorePage() {
  const points = usePoints();
  const { isSignedIn, getToken } = useAuthState();
  const [view, setView] = useState<StoreView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | "all">("all");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [previewing, setPreviewing] = useState<StoreItem | null>(null);

  // Signed-out visitors don't need a token, so they don't wait for the auth script:
  // if Clerk is slow or blocked, the store still shows.
  const load = useCallback(() => {
    (isSignedIn ? getToken() : Promise.resolve(null))
      .then((t) => getStore(t))
      .then(setView)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Could not load the store."));
  }, [getToken, isSignedIn]);
  useEffect(load, [load]);

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

  // What you wear now, with the item being previewed swapped in.
  const look = useMemo(() => {
    const out: Partial<Record<Slot, string>> = {};
    for (const i of view?.items ?? []) if (i.equipped) out[i.slot] = i.style;
    if (previewing && previewing.slot !== "editor") out[previewing.slot] = previewing.style;
    return out;
  }, [view, previewing]);

  const items = (view?.items ?? []).filter((i) => (slot === "all" || i.slot === slot) && (rarity === "all" || rarityOf(i) === rarity));
  const wallet = view?.wallet;
  const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-xs", on ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground hover:text-foreground");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" /> Store
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Earn coins by solving problems (each problem&apos;s points × {points?.coinsPerPoint ?? "…"}, once each), placing top three in contests, and solving the Daily Challenge on the day. Spend them on cosmetics; nothing here affects grading.
          </p>
        </div>
        {wallet && (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2" title={`${wallet.earnedFromSolves} from solves + ${wallet.earnedFromContests} from contests + ${wallet.earnedFromDaily} from Daily Challenges − ${wallet.spent} spent`}>
            <Coins className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            <span className="text-lg font-semibold tabular-nums">{wallet.balance}</span>
            <span className="text-xs text-muted-foreground">coins</span>
          </div>
        )}
      </div>
      {!isSignedIn && <p className="mt-4 text-sm text-muted-foreground">Sign in to see your coins and buy items. You can preview everything without signing in.</p>}
      {error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {view && <FreezeCard view={view} busy={busy} signedIn={isSignedIn} onBuy={() => void act("freeze", (t) => buyItem(t, view.freeze.id))} />}
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Item type">
            <button type="button" aria-pressed={slot === "all"} className={chip(slot === "all")} onClick={() => setSlot("all")}>
              All
            </button>
            {SLOTS.map((s) => (
              <button key={s.id} type="button" aria-pressed={slot === s.id} className={chip(slot === s.id)} onClick={() => setSlot(s.id)}>
                {s.title}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Rarity">
            <button type="button" aria-pressed={rarity === "all"} className={chip(rarity === "all")} onClick={() => setRarity("all")}>
              Any rarity
            </button>
            {RARITIES.map((r) => (
              <button key={r} type="button" aria-pressed={rarity === r} className={cn(chip(rarity === r), RARITY[r].className)} onClick={() => setRarity(r)}>
                {RARITY[r].label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {view === null && Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-52 animate-pulse rounded-xl border bg-muted/40" />)}
            {view && items.length === 0 && <p className="text-sm text-muted-foreground">Nothing matches those filters.</p>}
            {items.map((item) => {
              const r = RARITY[rarityOf(item)];
              return (
                <div key={item.id} className={cn("flex flex-col rounded-xl border p-3", r.card, item.equipped && "ring-2 ring-primary")}>
                  <ItemPreview item={item} />
                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <span className="font-medium">{item.name}</span>
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wide", r.className)}>{r.label}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                  <div className="mt-auto flex items-center gap-2 pt-3">
                    <span className="inline-flex items-center gap-1 text-sm font-medium tabular-nums">
                      <Coins className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
                      {item.price}
                    </span>
                    {item.slot !== "editor" && (
                      <Button size="sm" variant="ghost" className="ml-auto" aria-pressed={previewing?.id === item.id} onClick={() => setPreviewing(previewing?.id === item.id ? null : item)}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> {previewing?.id === item.id ? "Previewing" : "Preview"}
                      </Button>
                    )}
                    {isSignedIn &&
                      (item.owned ? (
                        <Button size="sm" variant={item.equipped ? "secondary" : "outline"} className={item.slot === "editor" ? "ml-auto" : undefined} disabled={busy === item.id} onClick={() => void act(item.id, (t) => equipItem(t, item.id, !item.equipped))}>
                          {item.equipped ? "Unequip" : "Equip"}
                        </Button>
                      ) : (
                        <Button size="sm" className={item.slot === "editor" ? "ml-auto" : undefined} disabled={busy === item.id || (wallet ? wallet.balance < item.price : true)} onClick={() => void act(item.id, (t) => buyItem(t, item.id))}>
                          Buy
                        </Button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="order-first lg:order-none">
          <div className="lg:sticky lg:top-20">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Try it on</h2>
            <TryOn look={look} previewing={previewing} onReset={() => setPreviewing(null)} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function FreezeCard({ view, busy, signedIn, onBuy }: { view: StoreView; busy: string | null; signedIn: boolean; onBuy: () => void }) {
  const f = view.freeze;
  const full = f.available >= f.max;
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-cyan-500/5 to-transparent p-5">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-300">
        <Snowflake className="h-6 w-6" />
      </span>
      <div className="min-w-[14rem] flex-1">
        <h2 className="font-semibold">{f.name}</h2>
        <p className="text-sm text-muted-foreground">
          {f.description} Hold up to {f.max}.
        </p>
        {signedIn && (
          <p className="mt-1 text-xs text-muted-foreground">
            You have <b>{f.available}</b> ready{f.owned > f.available ? ` (${f.owned - f.available} already saved your streak)` : ""}.
          </p>
        )}
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-medium tabular-nums">
        <Coins className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
        {f.price}
      </span>
      {signedIn && (
        <Button size="sm" disabled={busy !== null || full || (view.wallet ? view.wallet.balance < f.price : true)} onClick={onBuy}>
          {full ? "Fully stocked" : "Buy freeze"}
        </Button>
      )}
    </section>
  );
}
