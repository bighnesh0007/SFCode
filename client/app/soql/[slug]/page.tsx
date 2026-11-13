import type { Metadata } from "next";
import { ProblemRoute, problemMetadata } from "@/components/challenge/problemRoute";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return problemMetadata((await params).slug);
}

export default async function Page({ params }: Props) {
  return <ProblemRoute slug={(await params).slug} track="soql" />;
}
