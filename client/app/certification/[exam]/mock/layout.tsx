import type { Metadata } from "next";
import type { ReactNode } from "react";
import { examInfo } from "@/lib/examSeo";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ exam: string }> }): Promise<Metadata> {
  const { exam } = await params;
  const e = await examInfo(exam);
  if (!e?.mock) return { title: "Mock exam", robots: { index: false, follow: true } };
  return pageMeta({
    title: `Salesforce ${e.title} Mock Exam: ${e.mock.questions} Questions, Timed`,
    description: `A free, timed Salesforce ${e.title} mock exam: ${e.mock.questions} questions in ${e.mock.minutes} minutes, weighted by exam section like the real one, with a ${e.mock.passPercent}% pass mark and explanations.`,
    path: `/certification/${e.exam}/mock`,
    kicker: "Mock exam",
  });
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
