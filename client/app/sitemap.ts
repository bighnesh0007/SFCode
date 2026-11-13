import type { MetadataRoute } from "next";
import type { ChallengeSummary } from "@/lib/challengesApi";
import { serverApi, serverApiOrKeepStale } from "@/lib/serverApi";
import { absoluteUrl } from "@/lib/site";
import { trackInfo } from "@/lib/tracks";

// Rebuilt hourly from the live catalogue, so a new problem or post is listed without a deploy.
export const revalidate = 3600;

const SECTIONS: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/problems", priority: 0.9, changeFrequency: "weekly" },
  { path: "/challenges", priority: 0.9, changeFrequency: "weekly" },
  { path: "/soql", priority: 0.9, changeFrequency: "weekly" },
  { path: "/lwc", priority: 0.9, changeFrequency: "weekly" },
  { path: "/debugging", priority: 0.8, changeFrequency: "weekly" },
  { path: "/flows", priority: 0.8, changeFrequency: "weekly" },
  { path: "/certification", priority: 0.9, changeFrequency: "weekly" },
  { path: "/roadmap", priority: 0.9, changeFrequency: "weekly" },
  { path: "/interview", priority: 0.7, changeFrequency: "monthly" },
  { path: "/playground/apex", priority: 0.6, changeFrequency: "monthly" },
  { path: "/playground/soql", priority: 0.6, changeFrequency: "monthly" },
  { path: "/playground/lwc", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contests", priority: 0.6, changeFrequency: "daily" },
  { path: "/blog", priority: 0.6, changeFrequency: "daily" },
  { path: "/leaderboard", priority: 0.4, changeFrequency: "daily" },
  { path: "/jobs", priority: 0.4, changeFrequency: "daily" },
  { path: "/mentors", priority: 0.3, changeFrequency: "weekly" },
  { path: "/contribute", priority: 0.3, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.1, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.1, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalog, exams, posts, contests, roadmaps] = await Promise.all([
    serverApiOrKeepStale<{ challenges: ChallengeSummary[] }>("/api/v1/challenges"),
    serverApi<{ exam: string }[]>("/api/v1/certification"),
    serverApi<{ slug: string; updatedAt?: string; createdAt: string }[]>("/api/v1/blog"),
    serverApi<{ slug: string }[]>("/api/v1/contests"),
    serverApi<{ id: string }[]>("/api/v1/roadmaps").then((list) => Promise.all((list ?? []).map((r) => serverApi<{ id: string; nodes: { id: string }[] }>(`/api/v1/roadmaps/${r.id}`)))),
  ]);
  const entry = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"], lastModified?: string) => ({
    url: absoluteUrl(path),
    priority,
    changeFrequency,
    ...(lastModified ? { lastModified } : {}),
  });
  return [
    ...SECTIONS.map((s) => entry(s.path, s.priority, s.changeFrequency)),
    // Community problems live under their track too, but only built-in ones are vetted content.
    ...(catalog?.challenges ?? []).filter((c) => !c.community).map((c) => entry(`${trackInfo(c.track).base}/${c.slug}`, 0.8, "monthly")),
    ...(exams ?? []).flatMap((e) => [entry(`/certification/${e.exam}`, 0.8, "weekly"), entry(`/certification/${e.exam}/mock`, 0.6, "monthly")]),
    ...roadmaps.flatMap((r) => (r ? [entry(`/roadmap/${r.id}`, 0.9, "weekly"), ...r.nodes.map((n) => entry(`/roadmap/${r.id}/${n.id}`, 0.7, "monthly"))] : [])),
    ...(posts ?? []).map((p) => entry(`/blog/${p.slug}`, 0.5, "weekly", p.updatedAt ?? p.createdAt)),
    ...(contests ?? []).map((c) => entry(`/contests/${c.slug}`, 0.4, "weekly")),
  ];
}
