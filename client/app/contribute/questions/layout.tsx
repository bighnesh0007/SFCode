import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Write certification questions", description: "Signed-in area of SFCode.", path: "/contribute/questions", noindex: true });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
