import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Salesforce Mentors", description: "Experienced SFCode learners who offer to help with Apex, SOQL, LWC, Flow, certifications and careers.", path: "/mentors" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
