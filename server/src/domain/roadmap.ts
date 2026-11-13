/**
 * Learning roadmaps: a DAG of topic nodes, each linking existing problems,
 * a short lesson, and certification questions. Content lives in
 * server/roadmaps/*.json so contributors can extend it by PR.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export const ROLES = ["developer", "admin", "consultant", "student", "architect"] as const;
export const LEVELS = ["new", "basics", "production", "lead"] as const;
export const GOALS = ["pd1", "admin-cert", "first-job", "level-up", "interviews"] as const;
export const HOURS = ["1-2", "3-5", "5+"] as const;
export type Level = (typeof LEVELS)[number];

/** A node at or below this level is assumed known for someone who picked `level`. */
export const ASSUMED_BELOW: Record<Level, number> = { new: 0, basics: 1, production: 2, lead: 3 };

/** Official learning resources only: links are checked against these hosts at load time. */
export const RESOURCE_HOSTS = ["developer.salesforce.com", "help.salesforce.com", "trailhead.salesforce.com", "architect.salesforce.com", "admin.salesforce.com", "www.salesforce.com", "lwc.dev"] as const;
const resourceSchema = z.strictObject({
  title: z.string().min(3).max(120),
  url: z.url({ protocol: /^https$/ }),
  kind: z.enum(["docs", "trailhead", "guide", "video"]),
});
/** A diagram file in roadmaps/diagrams/, by name without ".svg". */
const diagramName = z.string().regex(/^[a-z0-9-]+$/);

const nodeSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  summary: z.string().min(1),
  lesson: z.string().optional(),
  /** Short "you should be able to explain" bullets. */
  concepts: z.array(z.string().min(3).max(200)).max(10).optional(),
  /** Mistakes people make here, with the fix. */
  pitfalls: z.array(z.string().min(3).max(300)).max(8).optional(),
  resources: z.array(resourceSchema).max(8).optional(),
  /** Shown with the lesson; `diagramCaption` describes it for screen readers too. */
  diagram: diagramName.optional(),
  diagramCaption: z.string().min(10).max(300).optional(),
  /** Nice to know, not on the main path: excluded from progress. */
  optional: z.boolean().optional(),
  level: z.number().int().min(1).max(4),
  col: z.number().int().min(0).max(2),
  requires: z.array(z.string()),
  problems: z.array(z.string()),
  cert: z.strictObject({ exam: z.string(), section: z.string().optional() }).optional(),
  /** Passing it (at most one wrong) completes the step. Answers never leave the server. */
  quiz: z
    .array(
      z.strictObject({
        q: z.string().min(1),
        /** A picture question: the diagram the question is about, with alt text. */
        image: diagramName.optional(),
        imageAlt: z.string().min(10).max(300).optional(),
        options: z.array(z.string().min(1)).min(2).max(5),
        answer: z.number().int().min(0),
        why: z.string().min(1),
      }),
    )
    .min(3)
    .optional(),
});
const roadmapSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  description: z.string(),
  nodes: z.array(nodeSchema).min(1),
});
export type RoadmapNode = z.infer<typeof nodeSchema>;
export type Roadmap = z.infer<typeof roadmapSchema> & { depth: Record<string, number> };

/**
 * Loads and validates every roadmap. Throws (and the server refuses to start)
 * on unknown problem slugs, unknown prerequisites, cycles, or a node with
 * neither problems nor a lesson/cert link.
 */
export const DIAGRAM_DIR = "diagrams";

export function loadRoadmaps(dir: string, problemExists: (slug: string) => boolean): Map<string, Roadmap> {
  const diagramExists = (name: string) => existsSync(join(dir, DIAGRAM_DIR, `${name}.svg`));
  const out = new Map<string, Roadmap>();
  // Read marks are stored per user without a roadmap prefix, so node ids must be unique across roadmaps.
  const seen = new Map<string, string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const where = `roadmaps/${file}`;
    const raw = roadmapSchema.parse(JSON.parse(readFileSync(join(dir, file), "utf8")));
    const ids = new Set<string>();
    for (const n of raw.nodes) {
      if (ids.has(n.id)) throw new Error(`${where}: duplicate node "${n.id}"`);
      const other = seen.get(n.id);
      if (other) throw new Error(`${where}: node "${n.id}" is also in ${other}; node ids must be unique across roadmaps`);
      ids.add(n.id);
      seen.set(n.id, where);
      for (const [i, q] of (n.quiz ?? []).entries()) {
        if (q.answer >= q.options.length) throw new Error(`${where}: "${n.id}" quiz question ${i + 1} answer is out of range`);
        if (q.image && (!diagramExists(q.image) || !q.imageAlt)) throw new Error(`${where}: "${n.id}" quiz question ${i + 1} needs an existing image and imageAlt`);
      }
      if (n.diagram && (!diagramExists(n.diagram) || !n.diagramCaption)) throw new Error(`${where}: "${n.id}" needs an existing diagram and a diagramCaption`);
      for (const r of n.resources ?? []) {
        if (!(RESOURCE_HOSTS as readonly string[]).includes(new URL(r.url).hostname)) throw new Error(`${where}: "${n.id}" links ${r.url}, not an official Salesforce resource host`);
      }
    }
    for (const n of raw.nodes) {
      for (const r of n.requires) if (!ids.has(r)) throw new Error(`${where}: "${n.id}" requires unknown node "${r}"`);
      for (const p of n.problems) if (!problemExists(p)) throw new Error(`${where}: "${n.id}" links unknown problem "${p}"`);
      if (n.problems.length === 0 && !n.lesson && !n.cert && !n.quiz) throw new Error(`${where}: "${n.id}" has nothing to do`);
    }
    // Depth = longest prerequisite chain; also detects cycles.
    const byId = new Map(raw.nodes.map((n) => [n.id, n]));
    const depth: Record<string, number> = {};
    const visiting = new Set<string>();
    const walk = (id: string): number => {
      if (depth[id] !== undefined) return depth[id];
      if (visiting.has(id)) throw new Error(`${where}: prerequisite cycle through "${id}"`);
      visiting.add(id);
      const reqs = byId.get(id)?.requires ?? [];
      const d = reqs.length === 0 ? 0 : 1 + Math.max(...reqs.map(walk));
      visiting.delete(id);
      depth[id] = d;
      return d;
    };
    raw.nodes.forEach((n) => walk(n.id));
    out.set(raw.id, { ...raw, depth });
  }
  return out;
}

/** Pass mark for a step quiz: at most one wrong answer. */
export const quizPassed = (correct: number, total: number) => total > 0 && total - correct <= 1;
