import Link from "next/link";
import { ArrowRight, Bug, Code2, Database, GraduationCap, Map as MapIcon, PenLine, Swords, Terminal, Trophy, Workflow, Zap } from "lucide-react";
import { ActivityFeed } from "@/components/ActivityFeed";
import { DailyCard } from "@/components/DailyCard";
import { Globe } from "@/components/Globe";
import { LiveStats } from "@/components/LiveStats";
import { DotBackground } from "@/components/home/DotBackground";
import { ProblemMarquee } from "@/components/home/ProblemMarquee";
import { SpotlightCard } from "@/components/home/SpotlightCard";
import { TerminalDemo } from "@/components/home/TerminalDemo";
import { buttonVariants } from "@/components/ui/button";

const TRACKS = [
  { icon: Code2, label: "Apex", href: "/problems?track=apex", tone: "text-sky-700 dark:text-sky-400" },
  { icon: Database, label: "SOQL", href: "/problems?track=soql", tone: "text-emerald-700 dark:text-emerald-400" },
  { icon: Bug, label: "Debugging", href: "/problems?track=debug", tone: "text-rose-500" },
  { icon: Workflow, label: "Flows", href: "/problems?track=flow", tone: "text-amber-700 dark:text-amber-400" },
  { icon: Zap, label: "LWC", href: "/problems?track=lwc", tone: "text-violet-500" },
];

const STEPS = [
  { title: "Connect your org", body: "A free Developer Edition is ideal. Tokens are encrypted; you can disconnect any time." },
  { title: "Write in the browser", body: "A full editor beside the problem. LWC previews live; Flows you build in your own Flow Builder." },
  { title: "Submit to hidden tests", body: "A check-only deploy runs our tests in your org and rolls everything back. LWC is graded in a locked-down sandbox." },
  { title: "Earn points and rank up", body: "First solves score by track and difficulty. Climb from Novice to Legend, win contests, spend coins." },
];

function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-sky-700 dark:text-sky-400">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-3 text-muted-foreground">{body}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <DotBackground />
        <div aria-hidden className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-sky-700 backdrop-blur dark:text-sky-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Open-source practice for the Salesforce community
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Write real Apex.{" "}
              <span className="bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent">Get graded in a real org.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Apex, SOQL, Flow, debugging and LWC problems checked by hidden tests, a roadmap from first steps to certification, and weekly
              contests with Trailblazers everywhere.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/problems" className={buttonVariants({ size: "lg" })}>
                Start solving <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
              <Link href="/roadmap" className={buttonVariants({ size: "lg", variant: "outline" })}>
                See the roadmap
              </Link>
            </div>
            <LiveStats />
          </div>
          <Globe className="mx-auto w-full max-w-[340px] sm:max-w-[460px] lg:max-w-[560px]" />
        </div>
      </section>

      {/* ── Problems drifting by ─────────────────────────────────────────── */}
      <section className="border-y bg-muted/30 py-6">
        <ProblemMarquee />
      </section>

      <div className="mx-auto w-full max-w-6xl px-4">
        {/* ── Today ──────────────────────────────────────────────────────── */}
        <section className="grid gap-6 py-16 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">Today on SFCode</h2>
            <p className="text-muted-foreground">One problem for everyone each day, worth bonus coins if you solve it before midnight UTC. Keep the streak going.</p>
            <DailyCard />
          </div>
          <ActivityFeed />
        </section>

        {/* ── Bento: everything in one place ─────────────────────────────── */}
        <section className="py-12">
          <SectionTitle eyebrow="Everything in one place" title="From your first query to Legend" body="Practice, learn, compete and give back, all graded against real Salesforce." />
          <div className="mt-10 grid gap-4 md:grid-cols-6">
            <SpotlightCard href="/problems" className="md:col-span-4 md:row-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Problems</p>
              <h3 className="mt-2 text-2xl font-semibold">Five tracks, one grader you can trust</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">Every solution runs against hidden tests in a real org (or our LWC sandbox). No regex matching, no multiple choice.</p>
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {TRACKS.map((t) => (
                  <span key={t.label} className="flex flex-col items-center gap-2 rounded-xl border bg-background/60 p-4 text-sm font-medium transition-transform group-hover:-translate-y-0.5">
                    <t.icon className={`h-6 w-6 ${t.tone}`} />
                    {t.label}
                  </span>
                ))}
              </div>
              <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-sky-700 dark:text-sky-400">Browse problems <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
            </SpotlightCard>
            <SpotlightCard href="/roadmap" className="md:col-span-2">
              <MapIcon className="h-6 w-6 text-indigo-500" />
              <h3 className="mt-3 font-semibold">A roadmap that fits you</h3>
              <p className="mt-1 text-sm text-muted-foreground">Developer or Admin paths with lessons, quizzes and a weekly plan.</p>
            </SpotlightCard>
            <SpotlightCard href="/contests" className="md:col-span-2">
              <Swords className="h-6 w-6 text-orange-500" />
              <h3 className="mt-3 font-semibold">Weekly contests</h3>
              <p className="mt-1 text-sm text-muted-foreground">Timed rounds, live standings, coins for the podium.</p>
            </SpotlightCard>
            <SpotlightCard href="/certification" className="md:col-span-2">
              <GraduationCap className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
              <h3 className="mt-3 font-semibold">Certification prep</h3>
              <p className="mt-1 text-sm text-muted-foreground">PD I and PD II questions with explanations and a readiness meter.</p>
            </SpotlightCard>
            <SpotlightCard href="/playground/apex" className="md:col-span-2">
              <Terminal className="h-6 w-6 text-sky-700 dark:text-sky-400" />
              <h3 className="mt-3 font-semibold">Apex playground</h3>
              <p className="mt-1 text-sm text-muted-foreground">Run anonymous Apex in your org and read the debug log.</p>
            </SpotlightCard>
            <SpotlightCard href="/leaderboard" className="md:col-span-2">
              <Trophy className="h-6 w-6 text-amber-700 dark:text-amber-400" />
              <h3 className="mt-3 font-semibold">Ranks and leaderboard</h3>
              <p className="mt-1 text-sm text-muted-foreground">Novice to Legend, achievements, streaks and a profile worth sharing.</p>
            </SpotlightCard>
          </div>
        </section>

        {/* ── How grading works: timeline + terminal ─────────────────────── */}
        <section className="grid items-center gap-10 py-16 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-700 dark:text-sky-400">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Graded the way production is</h2>
            <ol className="relative mt-8 space-y-8 border-l border-border pl-8">
              <span aria-hidden className="absolute -left-px top-0 h-full w-px bg-gradient-to-b from-sky-500 via-indigo-500 to-transparent" />
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative">
                  <span className="absolute -left-[45px] grid h-7 w-7 place-items-center rounded-full border bg-background text-xs font-semibold text-sky-700 shadow-sm dark:text-sky-400">{i + 1}</span>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <TerminalDemo />
            <p className="mt-2 text-center text-xs text-muted-foreground">Illustration of a real submission&apos;s output.</p>
          </div>
        </section>

        {/* ── Call to action ─────────────────────────────────────────────── */}
        <section className="relative my-16 overflow-hidden rounded-3xl border bg-gradient-to-br from-sky-500/10 via-indigo-500/10 to-violet-500/10 px-6 py-14 text-center">
          <DotBackground className="opacity-60" />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your next Salesforce skill is one problem away</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Free, open source, and built by the community. Practise today, or help others by writing problems as a Buddy.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/problems" className={buttonVariants({ size: "lg" })}>Start solving <ArrowRight className="ml-1 h-4 w-4" /></Link>
              <Link href="/contribute" className={buttonVariants({ size: "lg", variant: "outline" })}><PenLine className="mr-1 h-4 w-4" /> Become a Buddy</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
