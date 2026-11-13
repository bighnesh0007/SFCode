import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "SOQL Playground: Run SOQL Queries Online", description: "Write and run SOQL queries against your own Salesforce org from the browser, with results in a table.", path: "/playground/soql" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
