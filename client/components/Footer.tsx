import Link from "next/link";
import { LogoMark } from "@/components/Logo";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  { title: "Practice", links: [{ href: "/problems", label: "Problems" }, { href: "/playground/apex", label: "Apex playground" }, { href: "/contests", label: "Contests" }, { href: "/certification", label: "Certification prep" }] },
  { title: "Learn", links: [{ href: "/roadmap", label: "Roadmaps" }, { href: "/welcome", label: "Find your path" }, { href: "/blog", label: "Blog" }] },
  { title: "Community", links: [{ href: "/leaderboard", label: "Leaderboard" }, { href: "/teams", label: "Teams" }, { href: "/mentors", label: "Mentors" }, { href: "/jobs", label: "Job corner" }, { href: "/contribute", label: "Contribute" }, { href: "/store", label: "Store" }] },
  {
    title: "Project",
    links: [
      { href: "https://github.com/bighnesh0007/SFCode", label: "GitHub" },
      { href: "https://github.com/bighnesh0007/SFCode/blob/main/CONTRIBUTING.md", label: "Contributing guide" },
      { href: "https://github.com/bighnesh0007/SFCode/issues/new/choose", label: "Report an issue" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-muted/20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <LogoMark size={28} /> <span>SF<span className="text-sky-700 dark:text-sky-400">Code</span></span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">Open-source, LeetCode-style practice for Salesforce developers and admins, graded in real orgs.</p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-sm font-semibold">{c.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground transition-colors hover:text-foreground">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} SFCode · MIT licensed</p>
          <p>
            <Link href="/privacy" className="hover:text-foreground hover:underline">Privacy</Link> ·{" "}
            <Link href="/terms" className="hover:text-foreground hover:underline">Terms</Link> · Not affiliated with or endorsed by Salesforce, Inc.
          </p>
        </div>
      </div>
    </footer>
  );
}
