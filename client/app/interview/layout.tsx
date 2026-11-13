import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Salesforce Developer Interview Practice", description: "A timed mock technical interview for Salesforce developers: a random set of Apex, SOQL, debugging and LWC problems with a scorecard at the end.", path: "/interview" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
