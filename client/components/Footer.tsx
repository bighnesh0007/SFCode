import Link from "next/link";

const LINKS = [
  { href: "https://github.com/bighnesh0007/SFCode", label: "GitHub" },
  { href: "/contribute", label: "Contribute" },
  { href: "https://github.com/bighnesh0007/SFCode/issues/new/choose", label: "Report an issue" },
];

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-muted-foreground">
        <p>SFCode is open source (MIT). Not affiliated with or endorsed by Salesforce, Inc.</p>
        <nav className="flex gap-4">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
