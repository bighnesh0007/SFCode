import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Welcome", description: "Signed-in area of SFCode.", path: "/welcome", noindex: true });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
