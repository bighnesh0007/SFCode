"use client";

import Link from "next/link";
import { Cloud, CloudOff } from "lucide-react";
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
      className={cn(
        "flex max-w-[14rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        connected
          ? "border-sky-500/30 bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 dark:text-sky-400"
          : "border-border text-foreground/60 hover:bg-accent hover:text-foreground",
      )}
    >
      {connected ? <Cloud className="h-3.5 w-3.5 shrink-0" /> : <CloudOff className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{connected ? state.connection.username : "Connect org"}</span>
    </Link>
  );
}
