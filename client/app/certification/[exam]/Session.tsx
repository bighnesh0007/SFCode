"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PracticeSession } from "./PracticeSession";

function Inner({ exam }: { exam: string }) {
  const section = useSearchParams().get("section");
  // Keyed so changing section or exam starts a fresh session.
  return <PracticeSession key={`${exam}:${section ?? ""}`} exam={exam} section={section} />;
}

export function Session({ exam }: { exam: string }) {
  return (
    <Suspense>
      <Inner exam={exam} />
    </Suspense>
  );
}
