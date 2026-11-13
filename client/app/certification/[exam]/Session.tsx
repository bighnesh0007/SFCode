"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PracticeSession } from "./PracticeSession";

function Inner({ exam, title }: { exam: string; title?: string }) {
  const section = useSearchParams().get("section");
  // Keyed so changing section or exam starts a fresh session.
  return <PracticeSession key={`${exam}:${section ?? ""}`} exam={exam} section={section} title={title} />;
}

export function Session({ exam, title }: { exam: string; title?: string }) {
  return (
    <Suspense>
      <Inner exam={exam} title={title} />
    </Suspense>
  );
}
