import { Suspense } from "react";
import { ProblemsHub } from "@/components/ProblemsHub";

export default function ProblemsPage() {
  // useSearchParams needs a Suspense boundary for static rendering.
  return (
    <Suspense>
      <ProblemsHub />
    </Suspense>
  );
}
