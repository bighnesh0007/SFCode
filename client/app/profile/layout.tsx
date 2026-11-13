import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Your profile", description: "Signed-in area of SFCode.", path: "/profile", noindex: true });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
