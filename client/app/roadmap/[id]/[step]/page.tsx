import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { Markdown } from "@/components/Markdown";
import { buttonVariants } from "@/components/ui/button";
import type { Track } from "@/lib/challengesApi";
import { STAGE, diagramUrl } from "@/lib/roadmapApi";
import { ROADMAP_SEO, loadRoadmap } from "@/lib/roadmapSeo";
import { clip, pageMeta } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { trackInfo } from "@/lib/tracks";

type Props = { params: Promise<{ id: string; step: string }> };

async function find(id: string, step: string) {
  const { data: r, missing } = await loadRoadmap(id);
  return { r, n: r?.nodes.find((x) => x.id === step), missing: missing || (r !== null && !r.nodes.some((x) => x.id === step)) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, step } = await params;
  const { r, n } = await find(id, step);
  if (!r || !n) return { title: "Roadmap step", robots: { index: false, follow: true } };
  return pageMeta({ title: `${n.title}: ${r.title} Roadmap`, description: clip(`${n.summary} ${n.lesson ?? ""}`), path: `/roadmap/${r.id}/${n.id}`, kicker: `${r.title} roadmap` });
}

/** One roadmap step as a readable lesson page. Quizzes and progress stay in the interactive roadmap. */
export default async function Page({ params }: Props) {
  const { id, step } = await params;
  const { r, n, missing } = await find(id, step);
  if (missing) notFound();
  if (!r || !n) return <p className="px-4 py-20 text-center text-sm text-muted-foreground"><Link href="/roadmap" className="underline">Open the roadmap</Link></p>;
  const ordered = [...r.nodes].sort((a, b) => a.depth - b.depth || a.col - b.col);
  const i = ordered.findIndex((x) => x.id === n.id);
  const prev = ordered[i - 1];
  const next = ordered[i + 1];
  const requires = n.requires.map((rid) => r.nodes.find((x) => x.id === rid)).filter((x) => x !== undefined);
  const url = absoluteUrl(`/roadmap/${r.id}/${n.id}`);
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "LearningResource",
            name: n.title,
            description: n.summary,
            url,
            learningResourceType: "lesson",
            educationalLevel: STAGE[n.level],
            isAccessibleForFree: true,
            teaches: n.concepts ?? [],
            isPartOf: { "@type": "Course", name: ROADMAP_SEO[r.id]?.h1 ?? r.title, url: absoluteUrl(`/roadmap/${r.id}`) },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Roadmaps", item: absoluteUrl("/roadmap") },
              { "@type": "ListItem", position: 2, name: r.title, item: absoluteUrl(`/roadmap/${r.id}`) },
              { "@type": "ListItem", position: 3, name: n.title, item: url },
            ],
          },
        ]}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/roadmap" className="hover:text-foreground">Roadmaps</Link> <span aria-hidden="true">/</span>{" "}
        <Link href={`/roadmap/${r.id}`} className="hover:text-foreground">{r.title}</Link> <span aria-hidden="true">/</span> <span>{n.title}</span>
      </nav>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-sky-700 dark:text-sky-400">
        {STAGE[n.level]}
        {n.optional ? " · optional" : ""}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{n.title}</h1>
      <p className="mt-3 text-lg text-muted-foreground">{n.summary}</p>
      {requires.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Before this:{" "}
          {requires.map((q, k) => (
            <span key={q.id}>
              {k > 0 && ", "}
              <Link href={`/roadmap/${r.id}/${q.id}`} className="underline hover:text-foreground">{q.title}</Link>
            </span>
          ))}
        </p>
      )}
      {n.lesson && <Markdown source={n.lesson} className="markdown mt-6" />}
      {n.diagram && (
        <figure className="mt-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVGs served by the API */}
          <img src={diagramUrl(n.diagram)} alt={n.diagramCaption ?? n.title} className="w-full rounded-lg border bg-white" loading="lazy" />
          {n.diagramCaption && <figcaption className="mt-2 text-sm text-muted-foreground">{n.diagramCaption}</figcaption>}
        </figure>
      )}
      {n.concepts && n.concepts.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Key concepts</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">{n.concepts.map((c) => <li key={c}>{c}</li>)}</ul>
        </section>
      )}
      {n.pitfalls && n.pitfalls.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Common pitfalls</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">{n.pitfalls.map((c) => <li key={c}>{c}</li>)}</ul>
        </section>
      )}
      {n.problems.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Practice problems</h2>
          <ul className="mt-2 divide-y rounded-lg border">
            {n.problems.map((p) => (
              <li key={p.slug}>
                <Link href={`${trackInfo(p.track as Track).base}/${p.slug}`} className="flex items-baseline gap-3 px-4 py-2.5 hover:bg-accent/50">
                  <span className="font-medium">{p.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{p.difficulty}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(n.practice?.length ?? 0) > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">More practice (optional)</h2>
          <ul className="mt-2 divide-y rounded-lg border">
            {(n.practice ?? []).map((p) => (
              <li key={p.slug}>
                <Link href={`${trackInfo(p.track as Track).base}/${p.slug}`} className="flex items-baseline gap-3 px-4 py-2.5 hover:bg-accent/50">
                  <span className="font-medium">{p.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{p.difficulty}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {n.resources && n.resources.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Official resources</h2>
          <ul className="mt-2 space-y-1.5">
            {n.resources.map((x) => (
              <li key={x.url}>
                <a href={x.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 underline hover:text-primary">
                  {x.title} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Link href={`/roadmap?r=${r.id}&step=${n.id}`} className={buttonVariants({ className: "mt-10" })}>
        {n.quiz ? "Take the quiz and track progress" : "Track your progress on the roadmap"}
      </Link>
      <nav aria-label="Steps" className="mt-10 flex justify-between gap-4 border-t pt-6 text-sm">
        {prev ? (
          <Link href={`/roadmap/${r.id}/${prev.id}`} className="inline-flex items-center gap-1 hover:text-primary"><ArrowLeft className="h-4 w-4" /> {prev.title}</Link>
        ) : <span />}
        {next && (
          <Link href={`/roadmap/${r.id}/${next.id}`} className="inline-flex items-center gap-1 text-right hover:text-primary">{next.title} <ArrowRight className="h-4 w-4" /></Link>
        )}
      </nav>
    </article>
  );
}
