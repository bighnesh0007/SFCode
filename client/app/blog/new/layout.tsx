import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "New post", description: "Signed-in area of SFCode.", path: "/blog/new", noindex: true });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
