/** Display copy and colours for grading outcomes, and difficulty tones. */
import type { SubmissionStatus, Tone } from "./challengesApi";

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  running: "Grading…",
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  compile_error: "Compile Error",
  coverage: "Insufficient Coverage",
  error: "Error",
};

export const STATUS_CLASS: Record<SubmissionStatus, string> = {
  running: "text-muted-foreground",
  accepted: "text-green-600 dark:text-green-400",
  wrong_answer: "text-red-600 dark:text-red-400",
  compile_error: "text-amber-600 dark:text-amber-400",
  coverage: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
};

// Difficulty ids and their tones come from the server's registry; only the
// tone → colour mapping lives here.
export const TONE_TEXT: Record<Tone, string> = {
  green: "text-green-600 dark:text-green-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
};
export const TONE_ACCENT: Record<Tone, string> = {
  green: "before:bg-green-500",
  amber: "before:bg-amber-500",
  red: "before:bg-red-500",
};
