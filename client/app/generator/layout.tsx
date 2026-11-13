import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Generator", description: "Signed-in area of SFCode.", path: "/generator", noindex: true });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
