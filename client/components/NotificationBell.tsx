"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { ago, getNotifications, getUnread, markRead, type NotificationItem } from "@/lib/socialApi";
import { trackInfo } from "@/lib/tracks";
import type { Track } from "@/lib/challengesApi";
import { cn } from "@/lib/utils";

function describe(n: NotificationItem): { text: string; href: string } {
  if (n.kind === "follow") return { text: `${n.data.displayName ?? n.data.handle} followed you`, href: `/u/${n.data.handle ?? ""}` };
  if (n.kind === "mentor") return { text: `${n.data.displayName ?? n.data.handle} asked for help: "${n.data.message ?? ""}"`, href: `/u/${n.data.handle ?? ""}` };
  if (n.kind === "team") return { text: `@${n.data.handle} joined ${n.data.team}`, href: `/teams/${n.data.slug ?? ""}` };
  if (n.kind === "buddy") return { text: n.data.approved === "yes" ? "You're a Buddy now! Start writing problems." : `Your Buddy application wasn't accepted${n.data.note ? `: ${n.data.note}` : "."}`, href: "/contribute" };
  if (n.data.cert === "yes") {
    const q = `"${n.data.prompt ?? "your question"}…"`;
    if (n.data.action === "approved") return { text: `Your question ${q} is live in practice 🎉`, href: `/certification/${n.data.exam ?? ""}` };
    if (n.data.action === "changes_requested") return { text: `A reviewer asked for changes to ${q}`, href: "/contribute/questions" };
    return { text: `Your question ${q} was not accepted`, href: "/contribute/questions" };
  }
  const title = n.data.title ?? "your problem";
  if (n.data.action === "approved") return { text: `"${title}" was approved and is live 🎉`, href: n.data.slug && n.data.track ? `${trackInfo(n.data.track as Track).base}/${n.data.slug}` : "/contribute" };
  if (n.data.action === "changes") return { text: `A reviewer asked for changes to "${title}"`, href: `/contribute/drafts/${n.data.draftId ?? ""}` };
  return { text: `"${title}" was not accepted`, href: `/contribute/drafts/${n.data.draftId ?? ""}` };
}

/** Navbar bell: unread count (polled each minute), a dropdown list, mark-all-read on open. */
export function NotificationBell() {
  const { isSignedIn, getToken } = useAuthState();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const poll = useCallback(() => {
    getToken()
      .then((t) => getUnread(t))
      .then((r) => setUnread(r.unread))
      .catch(() => {});
  }, [getToken]);

  useEffect(() => {
    if (!isSignedIn) return;
    const first = setTimeout(poll, 0);
    const t = setInterval(poll, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [isSignedIn, poll]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    const t = await getToken();
    const res = await getNotifications(t).catch(() => null);
    setItems(res?.items ?? []);
    if (res && res.unread > 0) {
      await markRead(t).catch(() => undefined);
      setUnread(0);
    }
  }

  if (!isSignedIn) return null;
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => void toggle()} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} aria-expanded={open} className="relative grid h-8 w-8 place-items-center rounded-md hover:bg-accent">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-xl border bg-background shadow-xl animate-in fade-in zoom-in-95">
          <p className="border-b px-4 py-2.5 text-sm font-semibold">Notifications</p>
          <ul className="max-h-96 overflow-y-auto">
            {items === null && <li className="p-4"><div className="h-6 animate-pulse rounded bg-muted" /></li>}
            {items?.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nothing yet.</li>}
            {items?.map((n) => {
              const d = describe(n);
              return (
                <li key={n.id}>
                  <Link href={d.href} onClick={() => setOpen(false)} className={cn("flex gap-2 px-4 py-2.5 text-sm hover:bg-accent/60", !n.read && "bg-sky-500/5")}>
                    {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />}
                    <span className="min-w-0 flex-1">{d.text}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{ago(n.at)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
