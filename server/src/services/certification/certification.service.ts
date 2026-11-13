/**
 * Certification Prep. Correct answers and explanations leave the server only
 * in the response to an answer — never with the question — so they can't be
 * read off the page before answering.
 */
import { reviewSchedule } from "../../domain/review.ts";
import { NotFoundError, ValidationError } from "../../errors/AppError.ts";
import type { CertAttemptRepository } from "../../repositories/certAttempt.repository.ts";
import type { QuestionBank } from "./bank.ts";

export const MAX_SESSION_QUESTIONS = 30;

export interface ExamSummary {
  exam: string;
  title: string;
  description: string;
  questionCount: number;
  /** Mock exam available, with the real exam's shape. */
  mock: { questions: number; minutes: number; passPercent: number } | null;
  /** `answered`/`correct` count each question once, by its latest attempt; null when signed out. */
  sections: { id: string; title: string; total: number; answered: number | null; correct: number | null }[];
  /**
   * 0-100: the share of each section's questions whose latest answer is
   * right, averaged over sections (unanswered counts as not known). null
   * when signed out.
   */
  readiness: number | null;
  /** The section with the lowest share right, to practise next. */
  weakest: string | null;
}

export interface PracticeQuestion {
  id: string;
  section: string;
  prompt: string;
  options: { id: string; text: string }[];
  /** How many options to pick. */
  choose: number;
}

export interface AnswerResult {
  correct: boolean;
  answer: string[];
  explanation: string;
}

/** A question as learners see it: never the answer or the explanation. */
function toPractice(q: { id: string; section: string; prompt: string; options: { id: string; text: string }[]; answer: string[] }): PracticeQuestion {
  return { id: q.id, section: q.section, prompt: q.prompt, options: q.options.map((o) => ({ id: o.id, text: o.text })), choose: q.answer.length };
}

export interface MockExam {
  exam: string;
  title: string;
  /** Scaled down with the question count when the bank is smaller than the real exam. */
  minutes: number;
  passPercent: number;
  /** The real exam's length, for "this mock has 40 of the real exam's 60 questions". */
  realQuestions: number;
  realMinutes: number;
  questions: PracticeQuestion[];
}

export interface MockResult {
  score: number;
  passed: boolean;
  passPercent: number;
  correct: number;
  total: number;
  sections: { id: string; title: string; correct: number; total: number }[];
  results: { id: string; correct: boolean; selected: string[]; answer: string[]; explanation: string }[];
}

/** Questions per section in proportion to `weights`, never more than a section has. */
export function allocate(weights: Record<string, number>, available: Record<string, number>, total: number): Record<string, number> {
  const ids = Object.keys(weights);
  const sum = ids.reduce((n, id) => n + (weights[id] ?? 0), 0);
  const out: Record<string, number> = {};
  for (const id of ids) out[id] = Math.min(available[id] ?? 0, Math.floor((total * (weights[id] ?? 0)) / sum));
  // Hand out what rounding and small sections left over, largest weight first.
  let left = total - Object.values(out).reduce((a, b) => a + b, 0);
  const byWeight = [...ids].sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0));
  while (left > 0) {
    const room = byWeight.filter((id) => (out[id] ?? 0) < (available[id] ?? 0));
    if (room.length === 0) break;
    for (const id of room) {
      if (left === 0) break;
      out[id] = (out[id] ?? 0) + 1;
      left--;
    }
  }
  return out;
}

export class CertificationService {
  constructor(
    private readonly bank: QuestionBank,
    private readonly attempts: CertAttemptRepository | undefined,
    private readonly random: () => number = Math.random,
  ) {}

  async list(userId: string | null): Promise<ExamSummary[]> {
    return Promise.all(
      this.bank.all().map(async (e) => {
        const latest = userId && this.attempts ? await this.attempts.latest(userId, e.exam) : null;
        const sections = e.sections.map((s) => {
          const ids = e.questions.filter((q) => q.section === s.id).map((q) => q.id);
          return {
            id: s.id,
            title: s.title,
            total: ids.length,
            answered: latest ? ids.filter((id) => latest.has(id)).length : null,
            correct: latest ? ids.filter((id) => latest.get(id) === true).length : null,
          };
        });
        const shares = sections.map((s) => ({ id: s.id, share: s.total ? (s.correct ?? 0) / s.total : 0 }));
        const readiness = latest ? Math.round((100 * shares.reduce((n, s) => n + s.share, 0)) / Math.max(1, shares.length)) : null;
        const weakest = latest ? ([...shares].sort((a, b) => a.share - b.share)[0]?.id ?? null) : null;
        return { exam: e.exam, title: e.title, description: e.description, questionCount: e.questions.length, mock: e.mock ? { questions: e.mock.questions, minutes: e.mock.minutes, passPercent: e.mock.passPercent } : null, sections, readiness, weakest };
      }),
    );
  }

  /** Readiness for each exam the user has answered at least one question of, best first. */
  async readiness(userId: string): Promise<{ exam: string; title: string; readiness: number; answered: number; total: number }[]> {
    return (await this.list(userId))
      .map((e) => ({ exam: e.exam, title: e.title, readiness: e.readiness ?? 0, answered: e.sections.reduce((n, s) => n + (s.answered ?? 0), 0), total: e.questionCount }))
      .filter((e) => e.answered > 0)
      .sort((a, b) => b.readiness - a.readiness);
  }

  /** A shuffled set of questions, answers stripped. */
  practice(examId: string, section: string | undefined, count: number): PracticeQuestion[] {
    const exam = this.bank.exam(examId);
    if (!exam) throw new NotFoundError("Exam not found.");
    if (section !== undefined && !exam.sections.some((s) => s.id === section)) throw new NotFoundError("Section not found.");
    const pool = this.shuffle(exam.questions.filter((q) => section === undefined || q.section === section));
    return pool.slice(0, Math.min(count, MAX_SESSION_QUESTIONS)).map(toPractice);
  }

  /** Fisher–Yates on a copy; `random` is injectable so tests are deterministic. */
  private shuffle<T>(items: readonly T[]): T[] {
    const pool = [...items];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      const a = pool[i];
      const b = pool[j];
      if (a !== undefined && b !== undefined) {
        pool[i] = b;
        pool[j] = a;
      }
    }
    return pool;
  }

  /** A timed exam weighted by section like the real one. Answers stay on the server until grading. */
  mock(examId: string): MockExam {
    const exam = this.bank.exam(examId);
    if (!exam?.mock) throw new NotFoundError("This exam has no mock mode.");
    const { mock } = exam;
    const available = Object.fromEntries(exam.sections.map((s) => [s.id, exam.questions.filter((q) => q.section === s.id).length]));
    const counts = allocate(mock.weights, available, mock.questions);
    // Section order follows the shuffle, as on the real exam.
    const picked = this.shuffle(exam.sections.flatMap((s) => this.shuffle(exam.questions.filter((q) => q.section === s.id)).slice(0, counts[s.id] ?? 0)));
    return {
      exam: exam.exam,
      title: exam.title,
      minutes: Math.max(5, Math.round((mock.minutes * picked.length) / mock.questions)),
      passPercent: mock.passPercent,
      realQuestions: mock.questions,
      realMinutes: mock.minutes,
      questions: picked.map(toPractice),
    };
  }

  /**
   * Grades a submitted mock. Unanswered questions (empty selection) count as
   * wrong, like the real exam; only answered ones are recorded as attempts, so
   * running out of time doesn't flood the review queue.
   */
  async gradeMock(userId: string | null, examId: string, answers: Record<string, string[]>): Promise<MockResult> {
    const exam = this.bank.exam(examId);
    if (!exam?.mock) throw new NotFoundError("This exam has no mock mode.");
    const ids = Object.keys(answers);
    if (ids.length === 0) throw new ValidationError("Submit at least one question.");
    const results: MockResult["results"] = [];
    for (const id of ids) {
      const found = this.bank.question(id);
      if (found?.exam.exam !== exam.exam) throw new ValidationError(`Question ${id} is not part of this exam.`);
      const q = found.question;
      const selected = [...new Set(answers[id] ?? [])].sort();
      const options = new Set(q.options.map((o) => o.id));
      if (selected.some((s) => !options.has(s))) throw new ValidationError(`An answer to ${id} names an option it doesn't have.`);
      const answer = [...q.answer].sort();
      const correct = answer.length === selected.length && answer.every((a, i) => a === selected[i]);
      if (selected.length > 0 && userId && this.attempts) await this.attempts.record({ userId, exam: exam.exam, questionId: id, correct });
      results.push({ id, correct, selected, answer, explanation: q.explanation });
    }
    const sectionOf = new Map(exam.questions.map((q) => [q.id, q.section]));
    const sections = exam.sections
      .map((s) => {
        const mine = results.filter((r) => sectionOf.get(r.id) === s.id);
        return { id: s.id, title: s.title, correct: mine.filter((r) => r.correct).length, total: mine.length };
      })
      .filter((s) => s.total > 0);
    const correct = results.filter((r) => r.correct).length;
    const score = Math.round((100 * correct) / results.length);
    return { score, passed: score >= exam.mock.passPercent, passPercent: exam.mock.passPercent, correct, total: results.length, sections, results };
  }

  /** Missed questions due for review now (answers stripped), plus what's coming and what's mastered. */
  async review(userId: string, now: Date = new Date()): Promise<{ due: PracticeQuestion[]; upcoming: number; nextDueAt: string | null; mastered: number }> {
    if (!this.attempts) return { due: [], upcoming: 0, nextDueAt: null, mastered: 0 };
    const schedule = reviewSchedule(await this.attempts.history(userId));
    const due = schedule.due(now);
    const later = schedule.states.filter((s) => s.dueAt > now).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
    const questions = due.slice(0, MAX_SESSION_QUESTIONS).flatMap((s) => {
      const found = this.bank.question(s.questionId);
      if (!found) return []; // a question removed from the bank
      return [toPractice(found.question)];
    });
    return { due: questions, upcoming: later.length, nextDueAt: later[0]?.dueAt.toISOString() ?? null, mastered: schedule.mastered };
  }

  async answer(userId: string | null, questionId: string, selected: string[]): Promise<AnswerResult> {
    const found = this.bank.question(questionId);
    if (!found) throw new NotFoundError("Question not found.");
    const { exam, question } = found;
    const options = new Set(question.options.map((o) => o.id));
    if (selected.length === 0 || new Set(selected).size !== selected.length || selected.some((s) => !options.has(s))) {
      throw new ValidationError("Select one or more of this question's options, each once.");
    }
    const answer = [...question.answer].sort();
    const picked = [...selected].sort();
    const correct = answer.length === picked.length && answer.every((a, i) => a === picked[i]);
    if (userId && this.attempts) await this.attempts.record({ userId, exam: exam.exam, questionId, correct });
    return { correct, answer, explanation: question.explanation };
  }
}
