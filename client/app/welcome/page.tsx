"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Briefcase, Code2, Compass, GraduationCap, Rocket, Settings2, Sparkles, Sprout, Trophy, Users } from "lucide-react";
import { useAuthState, SignUpButton } from "@/components/auth";
import { LogoMark } from "@/components/Logo";
import { SKIP_KEY } from "@/components/OnboardingGate";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { saveOnboarding, type Answers, type Goal, type Hours, type Level, type Role } from "@/lib/roadmapApi";
import { cn } from "@/lib/utils";

type Option<T> = { value: T; title: string; hint: string; icon: typeof Code2 };

const ROLES: Option<Role>[] = [
  { value: "developer", title: "Developer", hint: "Apex, SOQL, LWC", icon: Code2 },
  { value: "admin", title: "Admin", hint: "Setup, security, Flows", icon: Settings2 },
  { value: "consultant", title: "Consultant", hint: "Design and deliver solutions", icon: Briefcase },
  { value: "student", title: "Student / switching careers", hint: "Getting into Salesforce", icon: GraduationCap },
  { value: "architect", title: "Architect / lead", hint: "Patterns, scale, teams", icon: Users },
];
const LEVELS: Option<Level>[] = [
  { value: "new", title: "New to Salesforce", hint: "Start from the very beginning", icon: Sprout },
  { value: "basics", title: "I know the basics", hint: "Objects, simple queries, a bit of setup", icon: Compass },
  { value: "production", title: "I build in production", hint: "Triggers and Flows are routine", icon: Rocket },
  { value: "lead", title: "I lead or architect", hint: "Limits, async and design trade-offs", icon: Trophy },
];
const GOALS: Option<Goal>[] = [
  { value: "pd1", title: "Pass Platform Developer I", hint: "Cert-focused path", icon: GraduationCap },
  { value: "admin-cert", title: "Pass the Admin cert", hint: "Config-first path", icon: Settings2 },
  { value: "first-job", title: "Land my first Salesforce job", hint: "Fundamentals plus projects", icon: Briefcase },
  { value: "level-up", title: "Level up at work", hint: "Practise what I use daily", icon: Rocket },
  { value: "interviews", title: "Prepare for interviews", hint: "Timed problems and drills", icon: Trophy },
];
const HOURS: { value: Hours; title: string }[] = [
  { value: "1-2", title: "1–2 h / week" },
  { value: "3-5", title: "3–5 h / week" },
  { value: "5+", title: "5+ h / week" },
];

function Choice<T extends string>({ options, value, onPick }: { options: Option<T>[]; value: T | undefined; onPick: (v: T) => void }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onPick(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "group flex items-center gap-3 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-sky-500/60 hover:shadow-md",
            value === o.value && "border-sky-500 bg-sky-500/10 ring-1 ring-sky-500",
          )}
        >
          <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted transition-colors group-hover:bg-sky-500/15", value === o.value && "bg-sky-500 text-white group-hover:bg-sky-500")}>
            <o.icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-medium">{o.title}</span>
            <span className="block text-xs text-muted-foreground">{o.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

const START: Record<Level, string> = {
  new: "the data model, then SOQL and your first Flows",
  basics: "Apex basics and advanced SOQL. We've marked the fundamentals as known",
  production: "triggers, testing and LWC. The basics are marked as known",
  lead: "governor limits, async Apex and the PD II checkpoint",
};

const ADMIN_START: Record<Level, string> = {
  new: "orgs and Setup, then objects, fields and users",
  basics: "relationships, validation rules and security. The first steps are marked as known",
  production: "sharing, page design and Flows. The basics are marked as known",
  lead: "reports, data tools and the Admin cert checkpoint",
};

function Welcome() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { isSignedIn, getToken } = useAuthState();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Partial<Answers>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const pick = <K extends keyof Answers>(k: K, v: Answers[K], advance = true) => {
    setA((cur) => ({ ...cur, [k]: v }));
    if (advance) setTimeout(() => setStep((s) => s + 1), 180);
  };

  async function finish() {
    if (!a.role || !a.level || !a.goal || !a.hours) return;
    setSaving(true);
    setError(null);
    try {
      await saveOnboarding(await getToken(), a as Answers);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function skip() {
    try {
      localStorage.setItem(SKIP_KEY, "1");
    } catch {
      // fine: they'll be asked again next time
    }
    router.replace(next?.startsWith("/") ? next : "/problems");
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <LogoMark size={48} />
        <h1 className="mt-4 text-2xl font-semibold">Get a roadmap made for you</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign up, answer three quick questions, and we&apos;ll lay out your path through SFCode.</p>
        <SignUpButton><Button className="mt-6">Sign up free</Button></SignUpButton>
      </div>
    );
  }

  const adminPath = a.role === "admin" || a.role === "consultant" || a.goal === "admin-cert";
  if (saved && a.level) {
    return (
      <div className="relative mx-auto w-full max-w-2xl overflow-hidden px-4 py-12 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" />
        <Sparkles className="mx-auto h-10 w-10 animate-bounce text-sky-700 dark:text-sky-400" />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Your roadmap is ready</h1>
        <p className="mt-3 text-muted-foreground">
          You&apos;re a <b className="text-foreground">{ROLES.find((r) => r.value === a.role)?.title}</b> who&apos;s <b className="text-foreground">{LEVELS.find((l) => l.value === a.level)?.title.toLowerCase()}</b>. You&apos;ll start with {adminPath ? ADMIN_START[a.level] : START[a.level]}.
        </p>
        {(a.role === "student" || a.role === "architect") && a.goal !== "admin-cert" && (
          <p className="mx-auto mt-3 max-w-md rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            A dedicated {a.role} roadmap is on the way. For now you&apos;re on the Developer path; you can switch to the Admin path on the roadmap page.
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/roadmap"><Button size="lg">Open my roadmap <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
          <Link href="/problems"><Button size="lg" variant="outline">Browse problems</Button></Link>
        </div>
      </div>
    );
  }

  const steps = [
    { title: "What describes you best?", body: <Choice options={ROLES} value={a.role} onPick={(v) => pick("role", v)} /> },
    { title: "How much Salesforce do you know?", body: <Choice options={LEVELS} value={a.level} onPick={(v) => pick("level", v)} /> },
    {
      title: "What are you aiming for?",
      body: (
        <div className="space-y-5">
          <Choice options={GOALS} value={a.goal} onPick={(v) => pick("goal", v, false)} />
          <div>
            <p className="mb-2 text-sm font-medium">Time you can give it</p>
            <div className="flex flex-wrap gap-2">
              {HOURS.map((h) => (
                <button key={h.value} type="button" aria-pressed={a.hours === h.value} onClick={() => pick("hours", h.value, false)} className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors hover:border-sky-500/60", a.hours === h.value && "border-sky-500 bg-sky-500/10 font-medium")}>
                  {h.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ];
  const current = steps[Math.min(step, steps.length - 1)];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LogoMark size={20} /> Welcome to SFCode
        <button type="button" onClick={skip} className="ml-auto text-xs hover:text-foreground">Skip for now</button>
      </div>
      <div className="mt-4 flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>
        {steps.map((_, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full bg-muted transition-colors duration-300", i <= step && "bg-sky-500")} />)}
      </div>
      <div key={step} className="mt-8 animate-in fade-in slide-in-from-right-4 duration-300">
        <h1 className="text-2xl font-semibold tracking-tight">{current?.title}</h1>
        <div className="mt-5">{current?.body}</div>
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
        {step === 2 && <Button disabled={!a.goal || !a.hours || saving} onClick={() => void finish()}>{saving ? "Building your roadmap…" : "Build my roadmap"}</Button>}
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}
