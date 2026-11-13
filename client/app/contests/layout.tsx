import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Salesforce Coding Contests", description: "Timed Salesforce coding contests with a live leaderboard and contest ratings. Solve Apex, SOQL and LWC problems against the clock.", path: "/contests" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
