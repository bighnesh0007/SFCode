"use client";

import { use } from "react";
import { DraftEditor } from "@/components/DraftEditor";

export default function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DraftEditor id={id} />;
}
