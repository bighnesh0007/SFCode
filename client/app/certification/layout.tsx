import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Salesforce Certification Practice Questions", description: "Free practice questions and timed mock exams for Salesforce Administrator, Platform Developer I and II, Platform App Builder and JavaScript Developer I, with explanations.", path: "/certification" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
