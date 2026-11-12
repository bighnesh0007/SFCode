"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useOrgConnection } from "./useOrgConnection";

/** Navbar pill: which org the user is connected to, or a prompt to connect one. */
export function OrgBadge() {
  const { state } = useOrgConnection();
  if (state.kind === "loading" || state.kind === "signed-out") return null;

  const connected = state.kind === "connected";
  return (
    <Link
      href="/settings/org"
      title={connected ? `${state.connection.username} (${state.connection.orgId})` : "Connect a Salesforce org"}
      className="flex max-w-[14rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", connected ? "bg-green-500" : "bg-muted-foreground/50")} aria-hidden="true" />
      <span className="truncate">{connected ? state.connection.username : "Connect org"}</span>
    </Link>
  );
}
