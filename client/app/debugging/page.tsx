"use client";

import { ChallengeList } from "@/components/ChallengeList";

export default function DebuggingPage() {
  return (
    <ChallengeList
      track="debug"
      basePath="/debugging"
      title="Debugging Arena"
      intro="Each problem starts with broken Apex — governor-limit failures, null pointers, recursion, logic slips. Find the bug, fix it, and the hidden tests in your connected org decide."
    />
  );
}
