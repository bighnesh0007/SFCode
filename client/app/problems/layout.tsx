import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Salesforce Practice Problems: Apex, SOQL, LWC & Flow", description: "Over 40 Salesforce practice problems from Easy to Hard: Apex triggers, SOQL queries, LWC components, Flows and debugging, graded against your own org.", path: "/problems" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
