import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { buttonVariants } from "@/components/ui/button";
import type { ChallengeSummary, Track } from "@/lib/challengesApi";
import { serverApiOrKeepStale } from "@/lib/serverApi";
import { absoluteUrl } from "@/lib/site";
import { TRACK_SEO } from "@/lib/trackSeo";
import { trackInfo } from "@/lib/tracks";

const ORDER = ["Easy", "Medium", "Hard"];

/** A crawlable landing page for one track, rendered on the server. The interactive list is the Problems hub. */
export async function TrackLanding({ track }: { track: Track }) {
  const seo = TRACK_SEO[track];
  const info = trackInfo(track);
  const data = await serverApiOrKeepStale<{ challenges: ChallengeSummary[] }>(`/api/v1/challenges?track=${track}`);
  const problems = (data?.challenges ?? []).filter((c) => !c.community);
  const groups = ORDER.map((d) => ({ difficulty: d, items: problems.filter((p) => p.difficulty === d) })).filter((g) => g.items.length > 0);
  const hub = `/problems?track=${track}`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: seo.h1,
      numberOfItems: problems.length,
      itemListElement: problems.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`${info.base}/${p.slug}`), name: p.title })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Problems", item: absoluteUrl("/problems") },
        { "@type": "ListItem", position: 2, name: info.label, item: absoluteUrl(info.base) },
      ],
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <JsonLd data={ld} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/problems" className="hover:text-foreground">Problems</Link> <span aria-hidden="true">/</span> <span>{info.label}</span>
      </nav>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{seo.h1}</h1>
      {seo.intro.map((p) => (
        <p key={p.slice(0, 20)} className="mt-3 max-w-3xl text-muted-foreground">{p}</p>
      ))}
      <Link href={hub} className={buttonVariants({ className: "mt-6" })}>
        Open in the problem list <ArrowRight className="ml-1 h-4 w-4" />
      </Link>
      {groups.length === 0 && <p className="mt-10 text-sm text-muted-foreground">The problem list is loading. <Link href={hub} className="underline">Open the problems</Link>.</p>}
      {groups.map((g) => (
        <section key={g.difficulty} className="mt-10">
          <h2 className="text-xl font-semibold">
            {g.difficulty} {info.label} problems <span className="text-sm font-normal text-muted-foreground">({g.items.length})</span>
          </h2>
          <ul className="mt-3 divide-y rounded-lg border">
            {g.items.map((p) => (
              <li key={p.slug}>
                <Link href={`${info.base}/${p.slug}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 hover:bg-accent/50">
                  <span className="font-medium">{p.title}</span>
                  <span className="text-xs text-muted-foreground">{p.category}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{p.tags.join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
