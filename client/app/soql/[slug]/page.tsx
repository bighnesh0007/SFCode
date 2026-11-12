"use client";

import { use } from "react";
import { ChallengePage } from "@/components/challenge/ChallengePage";

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <ChallengePage slug={use(params).slug} backHref="/problems?track=soql" />;
}
