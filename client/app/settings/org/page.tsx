"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { AlertTriangle, CheckCircle2, Cloud, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrgConnection } from "@/components/useOrgConnection";
import { ApiError } from "@/lib/apiClient";
import { disconnect, startConnect } from "@/lib/salesforceApi";
import { cn } from "@/lib/utils";

const CALLBACK_ERRORS: Record<string, string> = {
  denied: "You declined access in Salesforce.",
  salesforce_error: "Salesforce refused the sign-in. If you just set up the app, wait a few minutes; otherwise check the app exists in the org you logged into.",
  expired: "The sign-in took too long or was already used. Try again.",
  invalid_state: "The sign-in response could not be verified. Try again.",
  exchange: "Salesforce signed you in, but the token exchange failed. Check the External Client App settings.",
};

type Env = "production" | "sandbox" | "custom";

function OrgSettings() {
  const params = useSearchParams();
  const { getToken } = useAuth();
  const { state, refresh } = useOrgConnection();
  const [env, setEnv] = useState<Env>("production");
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sf = params.get("sf");
  const reason = params.get("reason") ?? "";
  const returnTo = params.get("returnTo") ?? "/settings/org";

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const loginUrl = env === "custom" ? domain.trim() : env;
      window.location.assign(await startConnect(await getToken(), loginUrl, returnTo));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the Salesforce sign-in.");
      setBusy(false);
    }
  }

  async function onDisconnect() {
    setBusy(true);
    try {
      await disconnect(await getToken());
      refresh();
    } catch {
      setError("Could not disconnect. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Salesforce org</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        SFCode runs your Apex in an org you connect. Use a Developer Edition or sandbox — never production data you care about.
      </p>

      {sf === "connected" && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" /> Org connected.
        </div>
      )}
      {sf === "error" && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {CALLBACK_ERRORS[reason] ?? "Connecting the org failed."}
        </div>
      )}

      <Card className="mt-6">
        {state.kind === "loading" && (
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your connection…
          </CardContent>
        )}

        {state.kind === "signed-out" && (
          <CardHeader>
            <CardTitle>Sign in first</CardTitle>
            <CardDescription>Your org connection is tied to your SFCode account.</CardDescription>
            <SignInButton mode="modal">
              <Button className="mt-4 w-fit">Sign in</Button>
            </SignInButton>
          </CardHeader>
        )}

        {state.kind === "unavailable" && (
          <CardHeader>
            <CardTitle>Org connection unavailable</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
        )}

        {state.kind === "connected" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-sky-500" /> {state.connection.username}
              </CardTitle>
              <CardDescription>
                Org {state.connection.orgId} · {state.connection.environment} · connected{" "}
                {new Date(state.connection.connectedAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={busy} onClick={onDisconnect}>
                <LogOut className="mr-1 h-4 w-4" /> Disconnect
              </Button>
              <p className="w-full text-xs text-muted-foreground">
                Disconnecting deletes SFCode&apos;s stored tokens. To revoke access on the Salesforce side too, remove
                SFCode under Settings → Connected Apps OAuth Usage in your org.
              </p>
            </CardContent>
          </>
        )}

        {state.kind === "disconnected" && (
          <>
            <CardHeader>
              <CardTitle>Connect an org</CardTitle>
              <CardDescription>You&apos;ll sign in on Salesforce and approve SFCode&apos;s access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(["production", "sandbox", "custom"] as const).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEnv(e)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm capitalize transition-colors",
                      env === e ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-accent",
                    )}
                  >
                    {e === "production" ? "Dev / Prod" : e === "custom" ? "My Domain" : "Sandbox"}
                  </button>
                ))}
              </div>
              {env === "custom" && (
                <div className="space-y-1.5">
                  <Label htmlFor="domain">My Domain URL</Label>
                  <Input id="domain" placeholder="https://yourorg.lightning.force.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button disabled={busy || (env === "custom" && !domain.trim())} onClick={connect}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Cloud className="mr-1 h-4 w-4" />}
                Connect with Salesforce
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

export default function Page() {
  // useSearchParams needs a Suspense boundary for static rendering.
  return (
    <Suspense>
      <OrgSettings />
    </Suspense>
  );
}
