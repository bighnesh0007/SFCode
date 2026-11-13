import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Salesforce Jobs", description: "Salesforce developer and admin roles shared with the SFCode community, and learners who are open to work.", path: "/jobs" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
