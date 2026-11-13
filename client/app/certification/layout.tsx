import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Salesforce Certification Practice Questions", description: "Free Salesforce certification practice questions and mock exams: Admin, Platform Developer I and II, App Builder, JavaScript Developer, Sales and Service Consultant, Agentforce.", path: "/certification" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
