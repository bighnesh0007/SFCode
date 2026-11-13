"use client";

import { use } from "react";
import { MockExamSession } from "./MockExamSession";

export default function Page({ params }: { params: Promise<{ exam: string }> }) {
  const { exam } = use(params);
  return <MockExamSession exam={exam} />;
}
