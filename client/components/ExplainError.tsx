"use client";

import { Lightbulb } from "lucide-react";
import { explainError } from "@/lib/explainError";

/** A short plain-English note for a recognised error; renders nothing for unknown ones. */
export function ExplainError({ message }: { message: string | null | undefined }) {
  const e = explainError(message);
  if (!e) return null;
  return (
    <details className="mt-2 rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs">
      <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-sky-700 dark:text-sky-400">
        <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" /> What this means: {e.title}
      </summary>
      <p className="mt-1.5 text-foreground">{e.meaning}</p>
      <p className="mt-1 text-muted-foreground">
        <span className="font-medium text-foreground">Try: </span>
        {e.fix}
      </p>
    </details>
  );
}
