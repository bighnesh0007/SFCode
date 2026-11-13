"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Crown, Hammer, HeartHandshake, ShieldCheck } from "lucide-react";
import { SignInButton, useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { pointsSummary, usePoints } from "@/components/usePoints";
import { ApiError } from "@/lib/apiClient";
import { applyForBuddy, getMyContributorStatus, type MyContributorStatus } from "@/lib/contributeApi";
import { cn } from "@/lib/utils";

const ROLES = [
  { icon: Crown, title: "Admins", body: "Run SFCode: roles, points, publishing. One or two people.", tone: "text-amber-500" },
  { icon: ShieldCheck, title: "Reviewers", body: "Review submitted problems (approve, request changes, reject) and keep the community friendly.", tone: "text-sky-500" },
  { icon: HeartHandshake, title: "Buddies", body: "Write problems for everyone to practise, help people out, and flag spam. Anyone can apply.", tone: "text-emerald-500" },
];

export default function ContributePage() {
  const { isSignedIn, getToken } = useAuthState();
  const points = usePoints();
  const [status, setStatus] = useState<MyContributorStatus | null>(null);
  const [motivation, setMotivation] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    getToken()
      .then((t) => getMyContributorStatus(t))
      .then((s) => !cancelled && setStatus(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      setStatus(await applyForBuddy(await getToken(), motivation, link));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send your application.");
    } finally {
      setBusy(false);
    }
  }

  const role = status?.standing ?? null;
  const app = status?.application ?? null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <p className="text-sm font-medium text-sky-600 dark:text-sky-400">Contribute</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Help build SFCode</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        SFCode grows through its community. Buddies write the problems other Salesforce developers practise on; reviewers make sure every
        one is correct and fair before it goes live. Everything happens here on the site, with no git or code repository needed.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r.title} className="rounded-xl border p-4">
            <r.icon className={cn("h-5 w-5", r.tone)} />
            <h2 className="mt-2 font-semibold">{r.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-xl border p-5">
        <h2 className="flex items-center gap-2 font-semibold"><Hammer className="h-4 w-4" /> How a problem goes live</h2>
        <ol className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
          <li><b>1. Write it.</b> Statement, starter code, a working solution and hidden tests.</li>
          <li><b>2. Prove it.</b> &quot;Test in my org&quot;: your solution must pass and the starter must fail.</li>
          <li><b>3. Review.</b> A reviewer checks it, re-runs it, and approves or asks for changes.</li>
          <li><b>4. Live.</b> It appears for everyone, credited to you, with a contributor badge.</li>
        </ol>
        {points && <p className="mt-3 text-xs text-muted-foreground">Points per solve (Easy/Medium/Hard): {pointsSummary(points)}. LWC problems are worth the most.</p>}
      </section>

      <section className="mt-8 rounded-xl border p-5">
        {!isSignedIn ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">Sign in to apply as a Buddy.</p>
            <SignInButton><Button size="sm">Sign in</Button></SignInButton>
          </div>
        ) : role ? (
          <div className="flex items-start gap-3">
            <BadgeCheck className="h-6 w-6 text-emerald-500" />
            <div>
              <p className="font-semibold">You&apos;re a{role === "admin" || role === "owner" ? "n" : ""} {role === "owner" ? "owner" : role}.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {role === "buddy"
                  ? "The problem builder is on its way: you'll be able to write, test in your org and submit problems right here."
                  : "Review tools live in the Admin area."}
              </p>
              {role !== "buddy" && <Link href="/admin" className="mt-2 inline-block text-sm text-sky-600 hover:underline dark:text-sky-400">Open Admin →</Link>}
            </div>
          </div>
        ) : app?.status === "pending" ? (
          <p className="text-sm">Your Buddy application is <b>waiting for review</b> (sent {new Date(app.createdAt).toLocaleDateString()}). We&apos;ll update this page when it&apos;s decided.</p>
        ) : (
          <div className="space-y-3">
            <h2 className="font-semibold">Apply to be a Buddy</h2>
            {app?.status === "rejected" && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                Your last application wasn&apos;t accepted{app.note ? `: "${app.note}"` : "."} You&apos;re welcome to apply again.
              </p>
            )}
            <textarea aria-label="Why do you want to be a Buddy?" placeholder="Why do you want to be a Buddy? Tell us about your Salesforce experience and what you'd like to write." value={motivation} maxLength={1000} onChange={(e) => setMotivation(e.target.value)} className="min-h-28 w-full rounded-md border bg-background p-3 text-sm" />
            <input aria-label="Profile link" placeholder="Trailblazer, LinkedIn or GitHub profile (optional, https)" value={link} onChange={(e) => setLink(e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm" />
            <div className="flex items-center gap-3">
              <Button disabled={busy || motivation.trim().length < 30} onClick={() => void apply()}>Send application</Button>
              <span className="text-xs text-muted-foreground">{motivation.trim().length < 30 ? `${30 - motivation.trim().length} more characters` : "Looks good"}</span>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
