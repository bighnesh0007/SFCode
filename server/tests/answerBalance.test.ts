/**
 * Authors tend to put the right answer in the same slot. A learner who notices
 * can pass without knowing anything, so no slot may hold much more than its share.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (dir: string) =>
  readdirSync(new URL(`../${dir}/`, import.meta.url))
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ name: `${dir}/${f}`, data: JSON.parse(readFileSync(new URL(`../${dir}/${f}`, import.meta.url), "utf8")) as unknown }));

interface Cert { questions: { options: { id: string }[]; answer: string[] }[] }
interface Map_ { nodes: { quiz?: { options: string[]; answer: number; why: string }[] }[] }

/** Position of the answer for each single-answer question. */
const banks = [
  ...read("certification").map(({ name, data }) => ({ name, positions: (data as Cert).questions.filter((q) => q.answer.length === 1).map((q) => q.options.findIndex((o) => o.id === q.answer[0])) })),
  ...read("roadmaps").map(({ name, data }) => ({ name, positions: (data as Map_).nodes.flatMap((n) => n.quiz ?? []).map((q) => q.answer) })),
];

describe("answer positions", () => {
  it.each(banks)("$name: no option slot holds more than 40% of the answers", ({ positions }) => {
    expect(positions.length).toBeGreaterThan(20);
    const counts = [0, 1, 2, 3].map((i) => positions.filter((p) => p === i).length);
    expect(Math.max(...counts) / positions.length).toBeLessThanOrEqual(0.4);
  });

  it("every roadmap quiz explains its answer", () => {
    const thin = read("roadmaps").flatMap(({ data }) => (data as Map_).nodes.flatMap((n) => n.quiz ?? [])).filter((q) => q.why.trim().length < 30);
    expect(thin.map((q) => q.why)).toEqual([]);
  });
});
