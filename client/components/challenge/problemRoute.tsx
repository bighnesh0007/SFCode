import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { JsonLd } from "@/components/JsonLd";
import type { ChallengeView, Track } from "@/lib/challengesApi";
import { clip, pageMeta } from "@/lib/seo";
import { serverFetch } from "@/lib/serverApi";
import { absoluteUrl } from "@/lib/site";
import { trackInfo } from "@/lib/tracks";
import { ChallengePage } from "./ChallengePage";

// One fetch per request, shared by generateMetadata and the page.
const load = cache((slug: string) => serverFetch<ChallengeView>(`/api/v1/challenges/${encodeURIComponent(slug)}`));

const TRACK_WORDS: Record<Track, string> = { apex: "Apex", soql: "SOQL", debug: "Apex debugging", flow: "Salesforce Flow", lwc: "LWC" };

export async function problemMetadata(slug: string): Promise<Metadata> {
  const { data: c } = await load(slug);
  if (!c) return { title: "Problem", robots: { index: false, follow: true } };
  const base = trackInfo(c.track).base;
  return pageMeta({
    title: `${c.title}: ${c.difficulty} ${TRACK_WORDS[c.track]} practice problem`,
    description: clip(`${c.difficulty} ${TRACK_WORDS[c.track]} problem on ${c.category.toLowerCase()}. ${c.statement}`),
    path: `${base}/${c.slug}`,
    kicker: `${c.difficulty} ${TRACK_WORDS[c.track]} problem`,
    // Community problems are learner-written and unreviewed by us: listed, but not offered to search.
    noindex: c.author !== undefined,
  });
}

/** Server-rendered problem page: the statement is in the HTML, the workspace hydrates on top. */
export async function ProblemRoute({ slug, track }: { slug: string; track: Track }) {
  const { data: c, missing } = await load(slug);
  if (missing) notFound();
  // A problem reached under another track's URL moves to its own, so each has one address.
  if (c && c.track !== track) permanentRedirect(`${trackInfo(c.track).base}/${c.slug}`);
  const backHref = `/problems?track=${track}`;
  const info = trackInfo(track);
  return (
    <>
      {c && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Problems", item: absoluteUrl("/problems") },
              { "@type": "ListItem", position: 2, name: info.label, item: absoluteUrl(info.base) },
              { "@type": "ListItem", position: 3, name: c.title, item: absoluteUrl(`${info.base}/${c.slug}`) },
            ],
          }}
        />
      )}
      <ChallengePage slug={slug} backHref={backHref} initial={c ?? undefined} />
    </>
  );
}
