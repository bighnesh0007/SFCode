/**
 * Loads every problem under server/problems at startup and validates it.
 *
 * A malformed problem throws, which stops the server: shipping a problem whose
 * starter and hidden tests disagree would make it unpassable, and that is worse
 * than a failed deploy.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Challenge } from "../../domain/challenge.ts";
import { DIFFICULTY_IDS } from "../../domain/difficulty.ts";

// Apex identifiers; the `Sfc` prefix keeps them clear of names already in a learner's org.
const apexName = z.string().regex(/^Sfc[A-Za-z0-9_]{1,37}$/, "must be an Apex name starting with Sfc");

const problemJson = z.strictObject({
  title: z.string().min(3).max(120),
  difficulty: z.enum(DIFFICULTY_IDS),
  category: z.string().min(2).max(40),
  order: z.number().int().positive(),
  tags: z.array(z.string().min(1).max(40)).max(8).default([]),
  files: z
    .array(z.strictObject({ name: apexName, type: z.enum(["class", "trigger"]) }))
    .min(1)
    .max(5),
  testClass: apexName,
});

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const extensionFor = (type: "class" | "trigger"): string => (type === "class" ? "cls" : "trigger");

function readSources(dir: string, files: { name: string; type: "class" | "trigger" }[], what: string): Record<string, string> {
  const expected = new Set(files.map((f) => `${f.name}.${extensionFor(f.type)}`));
  const present = existsSync(dir) ? readdirSync(dir) : [];
  const extra = present.filter((f) => !expected.has(f));
  if (extra.length) throw new Error(`${what} has unexpected files: ${extra.join(", ")}`);
  const out: Record<string, string> = {};
  for (const f of files) {
    const path = join(dir, `${f.name}.${extensionFor(f.type)}`);
    if (!existsSync(path)) throw new Error(`${what} is missing ${f.name}.${extensionFor(f.type)}`);
    out[f.name] = readFileSync(path, "utf8");
  }
  return out;
}

export function loadChallenge(root: string, slug: string): Challenge {
  if (!SLUG.test(slug)) throw new Error(`problem folder "${slug}" is not a kebab-case slug`);
  const dir = join(root, slug);
  const where = `problems/${slug}`;
  const parsed = problemJson.safeParse(JSON.parse(readFileSync(join(dir, "problem.json"), "utf8")));
  if (!parsed.success) throw new Error(`${where}/problem.json: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const meta = parsed.data;

  const names = [...meta.files.map((f) => f.name), meta.testClass];
  if (new Set(names).size !== names.length) throw new Error(`${where}: file and test class names must be unique`);

  const testPath = join(dir, "tests", `${meta.testClass}.cls`);
  if (!existsSync(testPath)) throw new Error(`${where}: missing tests/${meta.testClass}.cls`);
  const testSource = readFileSync(testPath, "utf8");
  if (!/@isTest/i.test(testSource)) throw new Error(`${where}: hidden test class has no @isTest`);
  if (/SeeAllData\s*=\s*true/i.test(testSource)) throw new Error(`${where}: hidden tests must not use SeeAllData=true`);

  const starter = readSources(join(dir, "starter"), meta.files, `${where}/starter`);
  const reference = readSources(join(dir, "reference"), meta.files, `${where}/reference`);
  // Each file must declare the type and name problem.json promises, or the deploy fails confusingly.
  for (const f of meta.files) {
    const decl = f.type === "class" ? new RegExp(`\\bclass\\s+${f.name}\\b`, "i") : new RegExp(`^\\s*trigger\\s+${f.name}\\s+on\\b`, "im");
    for (const [label, src] of [["starter", starter], ["reference", reference]] as const) {
      if (!decl.test(src[f.name] ?? "")) throw new Error(`${where}/${label}/${f.name}: does not declare ${f.type} ${f.name}`);
    }
  }

  return {
    slug,
    title: meta.title,
    difficulty: meta.difficulty,
    category: meta.category,
    order: meta.order,
    tags: meta.tags,
    statement: readFileSync(join(dir, "statement.md"), "utf8"),
    files: meta.files,
    starter,
    reference,
    testClass: { name: meta.testClass, source: testSource },
  };
}

export class ChallengeCatalog {
  private readonly bySlug: Map<string, Challenge>;

  constructor(challenges: Challenge[]) {
    const orders = new Set<number>();
    const apexNames = new Map<string, string>();
    for (const c of challenges) {
      if (orders.has(c.order)) throw new Error(`problems/${c.slug}: duplicate order ${c.order}`);
      orders.add(c.order);
      // Apex names are org-global; two problems sharing one would grade against each other's code.
      for (const n of [...c.files.map((f) => f.name), c.testClass.name]) {
        const other = apexNames.get(n.toLowerCase());
        if (other) throw new Error(`problems/${c.slug}: Apex name ${n} is also used by ${other}`);
        apexNames.set(n.toLowerCase(), c.slug);
      }
    }
    this.bySlug = new Map([...challenges].sort((a, b) => a.order - b.order).map((c) => [c.slug, c]));
  }

  static load(root: string): ChallengeCatalog {
    const slugs = readdirSync(root).filter((e) => statSync(join(root, e)).isDirectory());
    return new ChallengeCatalog(slugs.map((s) => loadChallenge(root, s)));
  }

  all(): Challenge[] {
    return [...this.bySlug.values()];
  }

  get(slug: string): Challenge | undefined {
    return this.bySlug.get(slug);
  }
}
