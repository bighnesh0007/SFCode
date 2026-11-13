import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMeta } from "@/lib/seo";
import { serverApi } from "@/lib/serverApi";

interface Profile { handle: string; displayName: string; solved: number; score: number; about?: { bio?: string; certifications?: string[] } }

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const p = await serverApi<Profile>(`/api/v1/profile/${encodeURIComponent(handle)}`, 3600);
  if (!p) return { title: "Profile", robots: { index: false, follow: true } };
  const certs = p.about?.certifications ?? [];
  return pageMeta({
    title: `${p.displayName} (@${p.handle}): Salesforce practice profile`,
    description: `${p.displayName} has solved ${p.solved} Salesforce practice problems on SFCode (${p.score} points)${certs.length ? `. Certified: ${certs.slice(0, 3).join(", ")}` : ""}.`,
    path: `/u/${p.handle}`,
    // An empty profile is a thin page; it becomes indexable once its owner has solved something.
    noindex: p.solved === 0,
  });
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
