"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, ShieldCheck } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { getOverview, getStanding, getUsers, setRole, type AdminOverview, type AdminUser, type Standing, type StaffRole } from "@/lib/adminApi";
import { STATUS_LABEL } from "@/lib/verdicts";

export default function AdminPage() {
  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const [standing, setStanding] = useState<Standing | "none" | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async (q: string) => {
    setUsers(await getUsers(await getToken(), q));
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const s = await getStanding(token);
        const [o, u] = await Promise.all([getOverview(token), getUsers(token, "")]);
        if (!cancelled) {
          setStanding(s);
          setOverview(o);
          setUsers(u);
        }
      } catch {
        if (!cancelled) setStanding("none");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  async function change(user: AdminUser, role: StaffRole, grant: boolean) {
    setMessage(null);
    try {
      await setRole(await getToken(), user.userId, role, grant);
      setMessage(`${grant ? "Granted" : "Removed"} ${role} ${grant ? "to" : "from"} @${user.handle}.`);
      await loadUsers(query);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not change the role.");
    }
  }

  // Signed-out is derived, not stored: no effect needed to keep it in sync.
  const view = isLoaded && !isSignedIn ? "none" : standing;
  if (view === null)
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (view === "none") return <p className="py-24 text-center text-muted-foreground">You don&apos;t have access to the admin area.</p>;

  const canManageModerators = view === "owner" || view === "admin";
  const tiles: [string, number][] = overview
    ? [["Learners", overview.learners], ["Connected orgs", overview.connectedOrgs], ["Submissions", overview.submissions], ["Last 24 hours", overview.submissions24h]]
    : [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-muted-foreground">{view}</span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(([label, n]) => (
          <div key={label} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{n}</p>
          </div>
        ))}
      </div>
      {overview && Object.keys(overview.byStatus).length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Verdicts:{" "}
          {Object.entries(overview.byStatus)
            .map(([s, n]) => `${STATUS_LABEL[s as keyof typeof STATUS_LABEL] ?? s} ${n}`)
            .join(" · ")}
        </p>
      )}

      <h2 className="mt-10 text-sm font-semibold">Users</h2>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void loadUsers(query);
        }}
      >
        <label className="relative flex-1">
          <span className="sr-only">Search users</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Handle, name or user id" className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm" />
        </label>
        <Button type="submit" size="sm" variant="outline">Search</Button>
      </form>
      {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}

      <div className="mt-3 overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2.5 pl-4">Learner</th>
              <th className="py-2.5">Roles</th>
              <th className="py-2.5 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId} className="border-t">
                <td className="py-2.5 pl-4">
                  <Link href={`/u/${u.handle}`} className="font-medium hover:text-primary">{u.displayName}</Link>
                  <span className="ml-2 text-xs text-muted-foreground">@{u.handle}</span>
                </td>
                <td className="py-2.5 text-xs text-muted-foreground">{u.owner ? "owner" : u.roles.join(", ") || "—"}</td>
                <td className="space-x-1 py-2.5 pr-4 text-right">
                  {!u.owner && canManageModerators && (
                    <Button size="sm" variant="ghost" onClick={() => void change(u, "moderator", !u.roles.includes("moderator"))}>
                      {u.roles.includes("moderator") ? "Remove moderator" : "Make moderator"}
                    </Button>
                  )}
                  {!u.owner && view === "owner" && (
                    <Button size="sm" variant="ghost" onClick={() => void change(u, "admin", !u.roles.includes("admin"))}>
                      {u.roles.includes("admin") ? "Remove admin" : "Make admin"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr className="border-t">
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">No users match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
