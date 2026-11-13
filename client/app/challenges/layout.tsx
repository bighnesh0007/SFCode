import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";
import { TRACK_SEO } from "@/lib/trackSeo";

export const metadata = pageMeta({ title: TRACK_SEO.apex.title, description: TRACK_SEO.apex.description, path: "/challenges" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
