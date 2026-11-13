import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Settings", description: "Signed-in area of SFCode.", path: "/settings", noindex: true });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
