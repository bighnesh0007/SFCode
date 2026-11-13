/**
 * Spaced review (Leitner boxes) for certification questions you've missed.
 * A question enters review the first time you get it wrong. Its box is the
 * number of correct answers in a row since the last miss; each box waits
 * longer before the question is due again. A miss sends it back to box 0.
 * After GRADUATE correct answers in a row it's mastered and leaves review.
 */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14] as const;
export const GRADUATE = INTERVAL_DAYS.length;

export interface ReviewState {
  questionId: string;
  box: number;
  dueAt: Date;
}

export function reviewSchedule(attempts: { questionId: string; correct: boolean; at: Date }[]): { due: (now: Date) => ReviewState[]; states: ReviewState[]; mastered: number } {
  const byQ = new Map<string, { correct: boolean; at: Date }[]>();
  for (const a of [...attempts].sort((x, y) => x.at.getTime() - y.at.getTime())) {
    const list = byQ.get(a.questionId) ?? [];
    list.push(a);
    byQ.set(a.questionId, list);
  }
  const states: ReviewState[] = [];
  let mastered = 0;
  for (const [questionId, list] of byQ) {
    if (!list.some((a) => !a.correct)) continue; // never missed: not in review
    let box = 0;
    for (const a of list) box = a.correct ? box + 1 : 0;
    if (box >= GRADUATE) {
      mastered++;
      continue;
    }
    const last = list.at(-1)?.at ?? new Date(0);
    states.push({ questionId, box, dueAt: new Date(last.getTime() + (INTERVAL_DAYS[box] ?? 0) * 86_400_000) });
  }
  return { states, mastered, due: (now) => states.filter((s) => s.dueAt <= now).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime()) };
}
