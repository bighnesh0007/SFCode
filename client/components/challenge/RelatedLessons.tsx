import Link from "next/link";
import { GraduationCap } from "lucide-react";

export interface Lesson {
  href: string;
  title: string;
  roadmap: string;
}

/** Roadmap steps that teach what this problem practises. */
export function RelatedLessons({ lessons }: { lessons?: Lesson[] }) {
  if (!lessons?.length) return null;
  return (
    <section className="mt-6 rounded-lg border px-3 py-3 text-sm">
      <h2 className="flex items-center gap-2 font-medium">
        <GraduationCap className="h-4 w-4 text-violet-700 dark:text-violet-400" aria-hidden="true" />
        Learn this on the roadmap
      </h2>
      <ul className="mt-2 space-y-1">
        {lessons.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-primary hover:underline">
              {l.title}
            </Link>{" "}
            <span className="text-xs text-muted-foreground">({l.roadmap})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
