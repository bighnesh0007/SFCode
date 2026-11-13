import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { buttonVariants } from "@/components/ui/button";
import { STAGE } from "@/lib/roadmapApi";
import { ROADMAP_SEO, loadRoadmap } from "@/lib/roadmapSeo";
import { clip, pageMeta } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { data: r } = await loadRoadmap(id);
  if (!r) return { title: "Roadmap", robots: { index: false, follow: true } };
  return pageMeta({ title: ROADMAP_SEO[r.id]?.title ?? `${r.title} Roadmap`, description: clip(`${r.total} steps. ${r.description}`), path: `/roadmap/${r.id}`, kicker: "Learning roadmap" });
}

/** The whole roadmap as a readable, crawlable outline; the interactive graph lives at /roadmap. */
export default async function Page({ params }: Props) {
  const { id } = await params;
  const { data: r, missing } = await loadRoadmap(id);
  if (missing) notFound();
  if (!r) return <p className="px-4 py-20 text-center text-sm text-muted-foreground"><Link href="/roadmap" className="underline">Open the roadmap</Link></p>;
  const levels = [...new Set(r.nodes.map((n) => n.level))].sort((a, b) => a - b);
  const interactive = `/roadmap?r=${r.id}`;
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Course",
            name: ROADMAP_SEO[r.id]?.h1 ?? r.title,
            description: r.description,
            url: absoluteUrl(`/roadmap/${r.id}`),
            provider: { "@type": "Organization", name: "SFCode", sameAs: absoluteUrl("/") },
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: 0, priceCurrency: "USD", category: "Free" },
            syllabusSections: r.nodes.map((n) => ({ "@type": "Syllabus", name: n.title, description: n.summary })),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Roadmaps", item: absoluteUrl("/roadmap") },
              { "@type": "ListItem", position: 2, name: r.title, item: absoluteUrl(`/roadmap/${r.id}`) },
            ],
          },
        ]}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/roadmap" className="hover:text-foreground">Roadmaps</Link> <span aria-hidden="true">/</span> <span>{r.title}</span>
      </nav>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{ROADMAP_SEO[r.id]?.h1 ?? r.title}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{r.description}</p>
      <p className="mt-2 max-w-3xl text-muted-foreground">
        {r.total} steps, each with a short lesson, key concepts, common pitfalls, links to official Salesforce documentation and Trailhead, a quiz, and practice problems graded in your own org.
      </p>
      <Link href={interactive} className={buttonVariants({ className: "mt-6" })}>
        Start the interactive roadmap <ArrowRight className="ml-1 h-4 w-4" />
      </Link>
      {levels.map((lvl) => (
        <section key={lvl} className="mt-10">
          <h2 className="text-xl font-semibold">{STAGE[lvl] ?? `Level ${lvl}`}</h2>
          <ol className="mt-3 divide-y rounded-lg border">
            {r.nodes
              .filter((n) => n.level === lvl)
              .sort((a, b) => a.depth - b.depth || a.col - b.col)
              .map((n) => (
                <li key={n.id}>
                  <Link href={`/roadmap/${r.id}/${n.id}`} className="block px-4 py-3 hover:bg-accent/50">
                    <span className="font-medium">{n.title}</span>
                    {n.optional && <span className="ml-2 text-xs text-muted-foreground">optional</span>}
                    <span className="mt-0.5 block text-sm text-muted-foreground">{n.summary}</span>
                  </Link>
                </li>
              ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
