"use client";

import { ChallengeList } from "@/components/ChallengeList";

export default function SoqlPage() {
  return (
    <ChallengeList
      track="soql"
      basePath="/soql"
      title="SOQL Practice"
      intro="Write one query per problem. It runs in your connected org against records a hidden test creates, and its rows are compared with the expected answer."
    />
  );
}
