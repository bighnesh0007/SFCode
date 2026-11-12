/**
 * Learning roadmaps: a DAG of topic nodes, each linking existing problems,
 * a short lesson, and certification questions. Content lives in
 * server/roadmaps/*.json so contributors can extend it by PR.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export const ROLES = ["developer", "admin", "consultant", "student", "architect"] as const;
export const LEVELS = ["new", "basics", "production", "lead"] as const;
export const GOALS = ["pd1", "admin-cert", "first-job", "level-up", "interviews"] as const;
export const HOURS = ["1-2", "3-5", "5+"] as const;
export type Level = (typeof LEVELS)[number];

/** A node at or below this level is assumed known for someone who picked `level`. */
export const ASSUMED_BELOW: Record<Level, number> = { new: 0, basics: 1, production: 2, lead: 3 };

const nodeSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  summary: z.string().min(1),
  lesson: z.string().optional(),
  level: z.number().int().min(1).max(4),
  col: z.number().int().min(0).max(2),
  requires: z.array(z.string()),
  problems: z.array(z.string()),
  cert: z.strictObject({ exam: z.string(), section: z.string().optional() }).optional(),
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
export function loadRoadmaps(dir: string, problemExists: (slug: string) => boolean): Map<string, Roadmap> {
  const out = new Map<string, Roadmap>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const where = `roadmaps/${file}`;
    const raw = roadmapSchema.parse(JSON.parse(readFileSync(join(dir, file), "utf8")));
    const ids = new Set<string>();
    for (const n of raw.nodes) {
      if (ids.has(n.id)) throw new Error(`${where}: duplicate node "${n.id}"`);
      ids.add(n.id);
    }
    for (const n of raw.nodes) {
      for (const r of n.requires) if (!ids.has(r)) throw new Error(`${where}: "${n.id}" requires unknown node "${r}"`);
      for (const p of n.problems) if (!problemExists(p)) throw new Error(`${where}: "${n.id}" links unknown problem "${p}"`);
      if (n.problems.length === 0 && !n.lesson && !n.cert) throw new Error(`${where}: "${n.id}" has nothing to do`);
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
