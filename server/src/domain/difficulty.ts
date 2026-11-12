/**
 * The difficulty registry — the ONE place difficulties are defined (a lesson
 * from DWCode, where hard-coded "Easy" | "Medium" | "Hard" drifted apart).
 * The client receives this list from the API and maps `tone` to colours.
 */
export const DIFFICULTIES = [
  { id: "Easy", rank: 1, tone: "green", points: 10 },
  { id: "Medium", rank: 2, tone: "amber", points: 20 },
  { id: "Hard", rank: 3, tone: "red", points: 40 },
] as const;

export type Difficulty = (typeof DIFFICULTIES)[number]["id"];
export const DIFFICULTY_IDS = DIFFICULTIES.map((d) => d.id) as [Difficulty, ...Difficulty[]];

export function pointsFor(difficulty: Difficulty): number {
  return DIFFICULTIES.find((d) => d.id === difficulty)?.points ?? 0;
}
