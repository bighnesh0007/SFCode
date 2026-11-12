"use client";

import { ChallengeList } from "@/components/ChallengeList";

export default function ChallengesPage() {
  return (
    <ChallengeList
      track="apex"
      basePath="/challenges"
      title="Apex Challenge Arena"
      intro="Triggers, classes, Batch and async Apex — graded by hidden Apex tests in your connected org. Grading is a check-only deploy, so nothing is left behind in the org."
    />
  );
}
