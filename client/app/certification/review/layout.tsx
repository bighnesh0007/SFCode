import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Review queue", description: "Signed-in area of SFCode.", path: "/certification/review", noindex: true });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
