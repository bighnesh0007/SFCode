import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DailyCard } from "@/components/DailyCard";
import { Globe } from "@/components/Globe";
import { LiveStats } from "@/components/LiveStats";
import { buttonVariants } from "@/components/ui/button";
import { TRACK_INFO } from "@/lib/tracks";

const SECTIONS = [
  { href: "/roadmap", title: "Your roadmap", body: "A step-by-step path for developers or admins, linked to real problems and quizzes." },
  { href: "/contests", title: "Contests", body: "Timed rounds with live standings. The top three win coins." },
  ...TRACK_INFO.map((t) => ({ href: `/problems?track=${t.id}`, title: `${t.label} problems`, body: t.blurb })),
  { href: "/playground/apex", title: "Apex Playground", body: "Run anonymous Apex in your org and read the debug log." },
  { href: "/certification", title: "Certification Prep", body: "Platform Developer I and II questions, each explained." },
  {
    href: "https://github.com/bighnesh0007/SFCode/blob/main/docs/adding-a-problem.md",
    title: "Contribute a problem",
    body: "SFCode is open source. Problems are plain files, no account needed.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <section className="relative grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:py-20">
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-sky-600 backdrop-blur dark:text-sky-400">
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
      </section>

      <section className="mb-8">
        <DailyCard />
      </section>

      <section className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="group bg-background p-5 transition-colors hover:bg-accent/60">
            <h2 className="flex items-center justify-between text-sm font-semibold">
              {s.title}
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
          </Link>
        ))}
      </section>

      <section className="py-16 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">How grading works</h2>
        <ol className="mt-3 grid gap-4 sm:grid-cols-3">
          <li><span className="font-medium text-foreground">1. Connect an org.</span> A free Developer Edition is ideal.</li>
          <li><span className="font-medium text-foreground">2. Write your solution.</span> In the browser, with the problem beside it.</li>
          <li><span className="font-medium text-foreground">3. Submit.</span> A check-only deploy runs the hidden tests and rolls back.</li>
        </ol>
      </section>
    </div>
  );
}
