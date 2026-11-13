import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Store", description: "Signed-in area of SFCode.", path: "/store", noindex: true });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
