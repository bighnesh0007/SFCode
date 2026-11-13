import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/JsonLd";
import { clip, pageMeta } from "@/lib/seo";
import { serverApi } from "@/lib/serverApi";
import { absoluteUrl } from "@/lib/site";

interface Post { slug: string; title: string; excerpt: string; body: string; status: string; createdAt: string; updatedAt: string; author: { handle: string; displayName: string } }

type Props = { params: Promise<{ slug: string }>; children: ReactNode };

const load = (slug: string) => serverApi<Post>(`/api/v1/blog/${encodeURIComponent(slug)}`, 300);

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const p = await load((await params).slug);
  if (!p) return { title: "Blog", robots: { index: false, follow: true } };
  const meta = pageMeta({ title: p.title, description: clip(p.excerpt || p.body), path: `/blog/${p.slug}`, noindex: p.status !== "published" });
  return { ...meta, openGraph: { ...meta.openGraph, type: "article", publishedTime: p.createdAt, modifiedTime: p.updatedAt, authors: [absoluteUrl(`/u/${p.author.handle}`)] } };
}

export default async function Layout({ params, children }: Props) {
  const p = await load((await params).slug);
  return (
    <>
      {p?.status === "published" && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: p.title,
            description: clip(p.excerpt || p.body),
            datePublished: p.createdAt,
            dateModified: p.updatedAt,
            url: absoluteUrl(`/blog/${p.slug}`),
            mainEntityOfPage: absoluteUrl(`/blog/${p.slug}`),
            author: { "@type": "Person", name: p.author.displayName, url: absoluteUrl(`/u/${p.author.handle}`) },
            publisher: { "@type": "Organization", name: "SFCode", logo: absoluteUrl("/icon.svg") },
          }}
        />
      )}
      {children}
    </>
  );
}
