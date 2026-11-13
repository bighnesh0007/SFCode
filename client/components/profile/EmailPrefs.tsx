"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { getEmailPrefs, setEmailPrefs } from "@/lib/emailApi";

/** Opt-in to the weekly digest (your own profile only). */
export function EmailPrefs() {
  const { getToken } = useAuthState();
  const [prefs, setPrefs] = useState<{ weeklyDigest: boolean; available: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getToken().then(getEmailPrefs).then(setPrefs).catch(() => {});
  }, [getToken]);
  if (!prefs) return null;
  return (
    <section className="rounded-xl border p-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={prefs.weeklyDigest}
          disabled={busy}
          onChange={async (e) => {
            setBusy(true);
            try {
              setPrefs(await setEmailPrefs(await getToken(), e.target.checked));
            } finally {
              setBusy(false);
            }
          }}
        />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-semibold"><Mail className="h-4 w-4 text-sky-700 dark:text-sky-400" /> Weekly digest email</span>
          <span className="block text-xs text-muted-foreground">
            One email on Mondays: your rank, streak, the Daily Challenge and upcoming contests. Off unless you turn it on.
            {!prefs.available && " (Email isn't switched on for this site yet; your choice is saved.)"}
          </span>
        </span>
      </label>
    </section>
  );
}
