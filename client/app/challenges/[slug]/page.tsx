import type { Metadata } from "next";
import { ProblemRoute, problemMetadata, problemParams } from "@/components/challenge/problemRoute";

type Props = { params: Promise<{ slug: string }> };

// Prerendered at build, refreshed every 10 minutes: these pages change only on deploy.
export const revalidate = 600;
export const generateStaticParams = () => problemParams("apex");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return problemMetadata((await params).slug);
}

export default async function Page({ params }: Props) {
  return <ProblemRoute slug={(await params).slug} track="apex" />;
}
