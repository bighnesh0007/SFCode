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
        return { exam: e.exam, title: e.title, description: e.description, questionCount: e.questions.length, sections, readiness, weakest };
      }),
    );
  }

  /** A shuffled set of questions, answers stripped. */
  practice(examId: string, section: string | undefined, count: number): PracticeQuestion[] {
    const exam = this.bank.exam(examId);
    if (!exam) throw new NotFoundError("Exam not found.");
    if (section !== undefined && !exam.sections.some((s) => s.id === section)) throw new NotFoundError("Section not found.");
    const pool = exam.questions.filter((q) => section === undefined || q.section === section);
    // Fisher–Yates; `random` is injectable so tests are deterministic.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      const a = pool[i];
      const b = pool[j];
      if (a && b) {
        pool[i] = b;
        pool[j] = a;
      }
    }
    return pool.slice(0, Math.min(count, MAX_SESSION_QUESTIONS)).map(toPractice);
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
