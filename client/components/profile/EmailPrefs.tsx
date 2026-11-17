"use client";

import { useEffect, useState } from "react";
import { Mail, Swords } from "lucide-react";
import { useAuthState } from "@/components/auth";
import { getEmailPrefs, setEmailPrefs, type EmailPrefsView } from "@/lib/emailApi";

type Pref = "weeklyDigest" | "contestReminders";

const OPTIONS: { key: Pref; icon: typeof Mail; title: string; body: string }[] = [
  { key: "weeklyDigest", icon: Mail, title: "Weekly digest email", body: "One email on Mondays: your rank, streak, the Daily Challenge and upcoming contests." },
  { key: "contestReminders", icon: Swords, title: "Contest reminder emails", body: "An email an hour before each Weekly and Biweekly contest starts." },
];

/** Opt-in emails (your own profile only). Both are off unless you turn them on. */
export function EmailPrefs() {
  const { getToken } = useAuthState();
  const [prefs, setPrefs] = useState<EmailPrefsView | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getToken().then(getEmailPrefs).then(setPrefs).catch(() => {});
  }, [getToken]);
  if (!prefs) return null;
  return (
    <section className="space-y-4 rounded-xl border p-5">
      {OPTIONS.map(({ key, icon: Icon, title, body }) => (
        <label key={key} className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={prefs[key]}
            disabled={busy}
            onChange={async (e) => {
              setBusy(true);
              try {
                setPrefs(await setEmailPrefs(await getToken(), { [key]: e.target.checked }));
              } finally {
                setBusy(false);
              }
            }}
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-semibold"><Icon className="h-4 w-4 text-sky-700 dark:text-sky-400" /> {title}</span>
            <span className="block text-xs text-muted-foreground">{body} Off unless you turn it on.</span>
          </span>
        </label>
      ))}
      {!prefs.available && <p className="text-xs text-muted-foreground">Email isn&apos;t switched on for this site yet; your choices are saved.</p>}
      <p className="text-xs text-muted-foreground">Contests you join also remind you in the bell 🔔, and you&apos;ll get your placing and rating change there once results are final.</p>
    </section>
  );
}
