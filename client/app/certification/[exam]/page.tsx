"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { PracticeSession } from "./PracticeSession";

function Session({ exam }: { exam: string }) {
  const section = useSearchParams().get("section");
  // Keyed so changing section or exam starts a fresh session.
  return <PracticeSession key={`${exam}:${section ?? ""}`} exam={exam} section={section} />;
}

export default function Page({ params }: { params: Promise<{ exam: string }> }) {
  const { exam } = use(params);
  return (
    <Suspense>
      <Session exam={exam} />
    </Suspense>
  );
}
