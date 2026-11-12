/**
 * Loads server/certification/*.json at startup. A malformed bank throws and
 * stops the server: a question whose answer isn't among its options can never
 * be answered correctly.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

const examFile = z.strictObject({
  exam: id,
  title: z.string().min(3).max(80),
  order: z.number().int().positive(),
  description: z.string().min(10).max(300),
  sections: z.array(z.strictObject({ id, title: z.string().min(3).max(80) })).min(1),
  questions: z
    .array(
      z.strictObject({
        id,
        section: id,
        prompt: z.string().min(10).max(2000),
        options: z.array(z.strictObject({ id: z.string().regex(/^[a-h]$/), text: z.string().min(1).max(500) })).min(2).max(8),
        answer: z.array(z.string()).min(1),
        explanation: z.string().min(20).max(2000),
      }),
    )
    .min(1),
});

export type Exam = z.infer<typeof examFile>;
export type Question = Exam["questions"][number];

export function validateExam(raw: unknown, where: string): Exam {
  const parsed = examFile.safeParse(raw);
  if (!parsed.success) throw new Error(`${where}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const exam = parsed.data;
  const sections = new Set(exam.sections.map((s) => s.id));
  const seen = new Set<string>();
  for (const q of exam.questions) {
    const at = `${where} ${q.id}`;
    if (seen.has(q.id)) throw new Error(`${at}: duplicate question id`);
    seen.add(q.id);
    if (!sections.has(q.section)) throw new Error(`${at}: unknown section ${q.section}`);
    const options = q.options.map((o) => o.id);
    if (new Set(options).size !== options.length) throw new Error(`${at}: duplicate option ids`);
    if (new Set(q.answer).size !== q.answer.length || q.answer.some((a) => !options.includes(a))) {
      throw new Error(`${at}: answer must be distinct ids from its options`);
    }
    if (q.answer.length >= options.length) throw new Error(`${at}: every option is correct`);
    // A multi-answer question must say how many to pick, or it is a trick question.
    if (q.answer.length > 1 && !new RegExp(`Choose ${q.answer.length}`).test(q.prompt)) {
      throw new Error(`${at}: multi-answer prompt must say "Choose ${q.answer.length}"`);
    }
  }
  for (const s of exam.sections) {
    if (!exam.questions.some((q) => q.section === s.id)) throw new Error(`${where}: section ${s.id} has no questions`);
  }
  return exam;
}

export class QuestionBank {
  private readonly exams: Map<string, Exam>;
  private readonly byId = new Map<string, { exam: Exam; question: Question }>();

  constructor(exams: Exam[]) {
    this.exams = new Map([...exams].sort((a, b) => a.order - b.order).map((e) => [e.exam, e]));
    for (const e of exams) {
      for (const q of e.questions) {
        // Attempts are stored by question id alone, so ids are global.
        if (this.byId.has(q.id)) throw new Error(`question id ${q.id} is used by two exams`);
        this.byId.set(q.id, { exam: e, question: q });
      }
    }
  }

  static load(dir: string): QuestionBank {
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    return new QuestionBank(files.map((f) => validateExam(JSON.parse(readFileSync(join(dir, f), "utf8")), `certification/${f}`)));
  }

  all(): Exam[] {
    return [...this.exams.values()];
  }

  exam(examId: string): Exam | undefined {
    return this.exams.get(examId);
  }

  question(questionId: string): { exam: Exam; question: Question } | undefined {
    return this.byId.get(questionId);
  }
}
