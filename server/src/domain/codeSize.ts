/**
 * Code size of a solution: characters left after comments and whitespace are
 * removed, so formatting and explanations never count against anyone.
 *
 * Grading records no SOQL/DML counts, and run time depends on each learner's
 * own org, so size is the one efficiency measure that compares fairly.
 * Comment stripping is lexical and ignores string literals; a "//" inside a
 * string drops the rest of that line for everyone alike, which is acceptable
 * for a rough comparison.
 */
export function codeSize(files: Record<string, string>): number {
  let n = 0;
  for (const src of Object.values(files)) {
    const stripped = src
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    n += stripped.replace(/\s+/g, "").length;
  }
  return n;
}

export interface SizeStats {
  /** Your smallest accepted solution. */
  mine: number;
  median: number;
  smallest: number;
  /** Learners with an accepted solution, you included. */
  solvers: number;
  /** Share of other solvers whose best is larger than yours, 0–100. */
  smallerThan: number;
}

/** `best` maps each solver to their smallest size; `me` must be one of them. */
export function sizeStats(best: Map<string, number>, me: string): SizeStats | null {
  const mine = best.get(me);
  if (mine === undefined) return null;
  const sizes = [...best.values()].sort((a, b) => a - b);
  const mid = Math.floor(sizes.length / 2);
  const at = (i: number) => sizes[i] ?? 0;
  const median = sizes.length % 2 ? at(mid) : Math.round((at(mid - 1) + at(mid)) / 2);
  const others = sizes.length - 1;
  const larger = sizes.filter((s) => s > mine).length;
  return { mine, median, smallest: at(0), solvers: sizes.length, smallerThan: others ? Math.round((larger / others) * 100) : 0 };
}
