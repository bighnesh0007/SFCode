import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Salesforce Developer, Admin, LWC & Integration Roadmaps", description: "Step-by-step Salesforce learning roadmaps for Developer, Admin, LWC and Integration, with lessons, diagrams, quizzes, pitfalls and official resources at every step.", path: "/roadmap" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
