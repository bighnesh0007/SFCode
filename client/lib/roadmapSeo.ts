import "server-only";
import { cache } from "react";
import type { RoadmapView } from "./roadmapApi";
import { serverApi, serverFetch } from "./serverApi";

/** One roadmap, anonymous view, fetched once per request. */
export const loadRoadmap = cache((id: string) => serverFetch<RoadmapView>(`/api/v1/roadmaps/${encodeURIComponent(id)}`));

/** Search titles: what people type ("salesforce developer roadmap"), not the tab label. */
// The year people put in the search ("salesforce developer roadmap 2026"); pages revalidate, so it rolls over.
const YEAR = new Date().getFullYear();

export const ROADMAP_SEO: Record<string, { title: string; h1: string }> = {
  developer: { title: `Salesforce Developer Roadmap ${YEAR}: Apex, SOQL, LWC to PD II`, h1: "Salesforce developer roadmap" },
  admin: { title: `Salesforce Admin Roadmap ${YEAR}: From Basics to Certified Admin`, h1: "Salesforce admin roadmap" },
  lwc: { title: "Lightning Web Components (LWC) Learning Roadmap", h1: "LWC learning roadmap" },
  integration: { title: "Salesforce Integration Roadmap: REST, Events and Callouts", h1: "Salesforce integration roadmap" },
};

export interface RelatedLesson {
  href: string;
  title: string;
  roadmap: string;
}

/** Roadmap steps that list this problem as practice, so the problem page can link back to the lesson. */
export const lessonsFor = cache(async (slug: string): Promise<RelatedLesson[]> => {
  const list = (await serverApi<{ id: string }[]>("/api/v1/roadmaps")) ?? [];
  const maps = await Promise.all(list.map((r) => loadRoadmap(r.id)));
  return maps.flatMap(({ data }) =>
    data ? data.nodes.filter((n) => [...n.problems, ...(n.practice ?? [])].some((p) => p.slug === slug)).map((n) => ({ href: `/roadmap/${data.id}/${n.id}`, title: n.title, roadmap: data.title })) : [],
  );
});
