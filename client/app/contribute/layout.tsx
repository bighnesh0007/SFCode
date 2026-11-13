import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Contribute", description: "Help build SFCode: write problems, review questions and improve this open-source Salesforce practice site.", path: "/contribute" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
