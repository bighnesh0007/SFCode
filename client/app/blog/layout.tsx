import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";
import { serverApi } from "@/lib/serverApi";

export async function generateMetadata(): Promise<Metadata> {
  // An empty blog is a thin page; keep it out of search until there's something to read.
  const posts = await serverApi<unknown[]>("/api/v1/blog", 3600);
  return pageMeta({ title: "Salesforce Developer Blog", description: "Posts from the SFCode community about Apex, SOQL, LWC, Flow, certifications and Salesforce careers.", path: "/blog", noindex: !posts?.length });
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
