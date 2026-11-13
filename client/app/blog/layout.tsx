import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Salesforce Developer Blog", description: "Posts from the SFCode community about Apex, SOQL, LWC, Flow, certifications and Salesforce careers.", path: "/blog" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
