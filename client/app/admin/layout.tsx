import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Admin", description: "Signed-in area of SFCode.", path: "/admin", noindex: true });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
