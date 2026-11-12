import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DailyCard } from "@/components/DailyCard";
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
      <section className="py-16 sm:py-24">
        <p className="text-sm font-medium text-primary">Open-source practice for Salesforce developers</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Write real Apex. Get graded in a real org.</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Solve Apex, SOQL, Flow, debugging and LWC problems against hidden tests that run in your own connected org,
          follow a roadmap from first steps to certification, and compete in weekly contests.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/problems" className={buttonVariants({ size: "lg" })}>
            Browse problems <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
          <Link href="/roadmap" className={buttonVariants({ size: "lg", variant: "outline" })}>
            See the roadmap
          </Link>
        </div>
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
