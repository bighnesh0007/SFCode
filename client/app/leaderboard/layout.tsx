import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Leaderboard", description: "Top SFCode learners by points, contest rating, team and country.", path: "/leaderboard" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
