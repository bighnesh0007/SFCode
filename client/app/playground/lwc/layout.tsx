import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "LWC Playground: Try Lightning Web Components Online", description: "Write a Lightning Web Component and preview it live in the browser. No org, no setup.", path: "/playground/lwc" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
