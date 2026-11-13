import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Apex Playground: Run Anonymous Apex Online", description: "Run anonymous Apex in your own org from the browser and read the debug log, with samples for collections, SOQL, DML and limits.", path: "/playground/apex" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
