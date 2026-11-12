import Link from "next/link";
import { Cloud } from "lucide-react";
import { FEATURES } from "@/lib/features";

export function Footer() {
  const year = new Date().getFullYear();
  const half = Math.ceil(FEATURES.length / 2);

  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="container mx-auto max-w-screen-xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold tracking-tight text-primary">SFCode</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The practice arena for Salesforce developers. Write Apex, SOQL and LWC against your own connected org.
            </p>
          </div>
          {[FEATURES.slice(0, half), FEATURES.slice(half)].map((col, i) => (
            <div key={i}>
              <h3 className="text-sm font-semibold">{i === 0 ? "Practice" : "Prepare"}</h3>
              <ul className="mt-3 space-y-2">
                {col.map((f) => (
                  <li key={f.href}>
                    <Link href={f.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {f.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t pt-6 text-xs text-muted-foreground">
          © {year} SFCode. Not affiliated with or endorsed by Salesforce, Inc.
        </div>
      </div>
    </footer>
  );
}
