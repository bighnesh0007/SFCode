/**
 * Interview mode scoring: given a learner's submissions and the interview's
 * time window, how each problem went. Pure, so it's tested without a database.
 */
export interface InterviewSubmission {
  status: string;
  createdAt: Date;
}

export interface ProblemOutcome {
  solved: boolean;
  /** Minutes from the start to the first accepted submission. */
  solvedAfterMinutes: number | null;
  /** Graded submissions that weren't accepted, before the first accept (or in total if unsolved). */
  wrongAttempts: number;
}

/** Only submissions made inside [startedAt, endsAt] count; running ones aren't graded yet. */
export function outcomeFor(subs: InterviewSubmission[], startedAt: Date, endsAt: Date): ProblemOutcome {
  const inWindow = subs
    .filter((s) => s.status !== "running" && s.createdAt >= startedAt && s.createdAt <= endsAt)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const firstAccept = inWindow.findIndex((s) => s.status === "accepted");
  const accepted = firstAccept >= 0 ? inWindow[firstAccept] : undefined;
  // Infrastructure errors aren't the learner's fault, so they don't count as wrong.
  const wrong = (firstAccept >= 0 ? inWindow.slice(0, firstAccept) : inWindow).filter((s) => s.status !== "error").length;
  return {
    solved: accepted !== undefined,
    solvedAfterMinutes: accepted ? Math.max(0, Math.round((accepted.createdAt.getTime() - startedAt.getTime()) / 60_000)) : null,
    wrongAttempts: wrong,
  };
}

/** A short verdict for the scorecard. */
export function interviewVerdict(solved: number, total: number): string {
  if (total === 0) return "No problems";
  if (solved === total) return "Strong hire";
  if (solved / total >= 0.5) return "Lean hire";
  if (solved > 0) return "Lean no hire";
  return "No hire, this time";
}
