import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.ts";
import { CERTIFICATION_DIR } from "../src/container.ts";
import type { CertAttemptRepository } from "../src/repositories/certAttempt.repository.ts";
import { QuestionBank, validateExam } from "../src/services/certification/bank.ts";
import { reviewSchedule } from "../src/domain/review.ts";
import { allocate, CertificationService } from "../src/services/certification/certification.service.ts";

const bank = QuestionBank.load(CERTIFICATION_DIR);
/** The answer key, read from the bank so reordering options never breaks a test. */
const right = (id: string) => [...(bank.question(id)?.question.answer ?? [])];
const wrong = (id: string) => [bank.question(id)?.question.options.find((o) => !right(id).includes(o.id))?.id ?? "?"];

class MemoryAttempts implements CertAttemptRepository {
  readonly rows: { userId: string; exam: string; questionId: string; correct: boolean; at?: Date }[] = [];
  history(userId: string) {
    return Promise.resolve(this.rows.filter((r) => r.userId === userId).map((r, i) => ({ questionId: r.questionId, correct: r.correct, at: r.at ?? new Date(1_700_000_000_000 + i * 1000) })));
  }
  record(input: { userId: string; exam: string; questionId: string; correct: boolean }) {
    this.rows.push(input);
    return Promise.resolve();
  }
  latest(userId: string, exam: string) {
    const out = new Map<string, boolean>();
    for (const r of this.rows) if (r.userId === userId && r.exam === exam) out.set(r.questionId, r.correct);
    return Promise.resolve(out);
  }
}

const valid = () => ({
  exam: "x1",
  title: "Exam X",
  order: 9,
  description: "A test exam for validation.",
  sections: [{ id: "s1", title: "Section one" }],
  questions: [
    {
      id: "x1-q1",
      section: "s1",
      prompt: "Which is right?",
      options: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }],
      answer: ["a"],
      explanation: "Because A is the right one here.",
    },
  ],
});

describe("question bank", () => {
  it("ships five exams, valid, each with a mock shape", () => {
    expect(bank.all().map((e) => [e.exam, e.questions.length, e.mock?.questions])).toEqual([
      ["admin", 60, 60],
      ["pd1", 60, 60],
      ["pd2", 60, 60],
      ["app-builder", 60, 60],
      ["js-dev-1", 60, 60],
    ]);
  });

  it.each<[string, (e: ReturnType<typeof valid> & { mock?: unknown }) => void, RegExp]>([
    ["mock weights naming an unknown section", (e) => { e.mock = { questions: 10, minutes: 20, passPercent: 60, weights: { s1: 50, s9: 50 } }; }, /every section exactly once/],
    ["mock weights not adding up to 100", (e) => { e.mock = { questions: 10, minutes: 20, passPercent: 60, weights: { s1: 90 } }; }, /add up to 100/],
  ])("rejects %s", (_name, mutate, error) => {
    const e: ReturnType<typeof valid> & { mock?: unknown } = valid();
    mutate(e);
    expect(() => validateExam(e, "x.json")).toThrow(error);
  });

  it.each<[string, (e: ReturnType<typeof valid>) => void, RegExp]>([
    ["an answer that is not an option", (e) => { e.questions[0]!.answer = ["z"]; }, /answer must be distinct ids/],
    ["a multi-answer prompt without Choose N", (e) => { e.questions[0]!.answer = ["a", "b"]; }, /Choose 2/],
    ["every option correct", (e) => { e.questions[0]!.answer = ["a", "b", "c"]; e.questions[0]!.prompt += " (Choose 3)"; }, /every option is correct/],
    ["an unknown section", (e) => { e.questions[0]!.section = "nope"; }, /unknown section/],
    ["an empty section", (e) => { e.sections.push({ id: "s2", title: "Empty one" }); }, /has no questions/],
  ])("rejects %s", (_name, mutate, error) => {
    const e = valid();
    mutate(e);
    expect(() => validateExam(e, "x.json")).toThrow(error);
  });

  it("rejects a question id shared by two exams", () => {
    const a = validateExam(valid(), "a");
    const b = validateExam({ ...valid(), exam: "x2" }, "b");
    expect(() => new QuestionBank([a, b])).toThrow(/used by two exams/);
  });
});

describe("CertificationService", () => {
  it("never sends answers or explanations with questions", () => {
    const service = new CertificationService(bank, undefined);
    for (const e of bank.all()) {
      const json = JSON.stringify(service.practice(e.exam, undefined, 30));
      expect(json).not.toMatch(/"answer"|"explanation"/);
      for (const q of e.questions) expect(json).not.toContain(q.explanation.slice(0, 40));
    }
  });

  it("filters by section, caps the count, and returns every question exactly once", () => {
    const service = new CertificationService(bank, undefined, () => 0.42);
    const testing = service.practice("pd1", "testing", 30);
    expect(testing.every((q) => q.section === "testing")).toBe(true);
    expect(service.practice("pd1", undefined, 5)).toHaveLength(5);
    const all = service.practice("pd1", undefined, 30).map((q) => q.id);
    expect(new Set(all).size).toBe(Math.min(30, bank.exam("pd1")?.questions.length ?? 0)); // a session is capped at 30
  });

  it("grades multi-answer questions regardless of order, and only all-or-nothing", async () => {
    const service = new CertificationService(bank, undefined);
    expect((await service.answer(null, "pd1-soql-injection", right("pd1-soql-injection").reverse())).correct).toBe(true);
    expect((await service.answer(null, "pd1-soql-injection", right("pd1-soql-injection").slice(0, 1))).correct).toBe(false);
    expect((await service.answer(null, "pd1-soql-injection", [...right("pd1-soql-injection"), ...wrong("pd1-soql-injection")])).correct).toBe(false);
    const r = await service.answer(null, "pd1-limits-soql", wrong("pd1-limits-soql"));
    expect(r).toMatchObject({ correct: false, answer: right("pd1-limits-soql") });
    expect(r.explanation).toContain("100");
  });

  it("rejects selections that are not the question's options", async () => {
    const service = new CertificationService(bank, undefined);
    await expect(service.answer(null, "pd1-limits-soql", ["z"])).rejects.toThrow(/options/);
    await expect(service.answer(null, "pd1-limits-soql", ["a", "a"])).rejects.toThrow(/options/);
    await expect(service.answer(null, "nope", ["a"])).rejects.toThrow(/not found/i);
  });

  it("records attempts only for signed-in users and reports progress by latest attempt", async () => {
    const attempts = new MemoryAttempts();
    const service = new CertificationService(bank, attempts);
    await service.answer(null, "pd1-limits-soql", right("pd1-limits-soql"));
    expect(attempts.rows).toHaveLength(0);
    await service.answer("u1", "pd1-limits-soql", wrong("pd1-limits-soql"));
    await service.answer("u1", "pd1-limits-soql", right("pd1-limits-soql"));
    await service.answer("u1", "pd1-limits-dml", wrong("pd1-limits-dml"));
    const logic = (await service.list("u1")).find((e) => e.exam === "pd1")?.sections.find((s) => s.id === "logic");
    expect(logic).toMatchObject({ answered: 2, correct: 1 });
    expect((await service.list(null))[0]?.sections[0]?.answered).toBeNull();
  });
});

describe("certification readiness", () => {
  it("averages each section's share right; unanswered counts as not known; weakest is the lowest", async () => {
    const attempts = new MemoryAttempts();
    const service = new CertificationService(bank, attempts);
    const pd1 = bank.exam("pd1");
    if (!pd1) throw new Error("pd1 missing");
    expect((await service.list("u")).find((e) => e.exam === "pd1")).toMatchObject({ readiness: 0 });
    // Master one whole section, get half of another right.
    const [first, second] = pd1.sections;
    for (const q of pd1.questions.filter((q) => q.section === first?.id)) attempts.rows.push({ userId: "u", exam: "pd1", questionId: q.id, correct: true });
    const secondQs = pd1.questions.filter((q) => q.section === second?.id);
    secondQs.forEach((q, i) => attempts.rows.push({ userId: "u", exam: "pd1", questionId: q.id, correct: i < secondQs.length / 2 }));
    const half = Math.ceil(secondQs.length / 2) / secondQs.length;
    const summary = (await service.list("u")).find((e) => e.exam === "pd1");
    expect(summary?.readiness).toBe(Math.round((100 * (1 + half)) / pd1.sections.length));
    expect(summary?.weakest).not.toBe(first?.id);
    expect((await service.list(null))[0]?.readiness).toBeNull();
  });
});

describe("spaced review", () => {
  const DAY = 86_400_000;
  const t0 = new Date("2026-03-01T10:00:00Z");
  const at = (days: number) => new Date(t0.getTime() + days * DAY);

  it("schedule: a miss is due now; each correct answer waits longer; five in a row graduates", () => {
    const miss = [{ questionId: "q", correct: false, at: at(0) }];
    expect(reviewSchedule(miss).due(at(0)).map((s) => s.box)).toEqual([0]);
    const once = [...miss, { questionId: "q", correct: true, at: at(0) }];
    expect(reviewSchedule(once).due(at(0.9))).toHaveLength(0); // box 1: wait a day
    expect(reviewSchedule(once).due(at(1))).toHaveLength(1);
    const backToZero = [...once, { questionId: "q", correct: false, at: at(1) }];
    expect(reviewSchedule(backToZero).states[0]?.box).toBe(0);
    const streak = [...miss, ...[1, 2, 5, 12, 26].map((d) => ({ questionId: "q", correct: true, at: at(d) }))];
    expect(reviewSchedule(streak)).toMatchObject({ mastered: 1, states: [] });
    expect(reviewSchedule([{ questionId: "never-missed", correct: true, at: at(0) }]).states).toEqual([]);
  });

  it("the service returns due questions without answers, and counts upcoming and mastered", async () => {
    const attempts = new MemoryAttempts();
    const service = new CertificationService(bank, attempts);
    const [q1, q2] = bank.exam("pd1")?.questions ?? [];
    if (!q1 || !q2) throw new Error("fixture");
    attempts.rows.push({ userId: "u", exam: "pd1", questionId: q1.id, correct: false, at: at(0) });
    attempts.rows.push({ userId: "u", exam: "pd1", questionId: q2.id, correct: false, at: at(0) }, { userId: "u", exam: "pd1", questionId: q2.id, correct: true, at: at(0) });
    const r = await service.review("u", at(0.5));
    expect(r.due.map((q) => q.id)).toEqual([q1.id]);
    expect(r).toMatchObject({ upcoming: 1, mastered: 0, nextDueAt: at(1).toISOString() });
    expect(JSON.stringify(r)).not.toMatch(/"answer"|"explanation"/);
  });
});

describe("certification routes", () => {
  const app = buildApp({ certification: new CertificationService(bank, undefined) });

  it("serves questions without answers, and checks answers signed out", async () => {
    const qs = await request(app).get("/api/v1/certification/pd2/questions?count=3");
    expect(qs.status).toBe(200);
    expect(qs.body.data).toHaveLength(3);
    expect(JSON.stringify(qs.body)).not.toContain("explanation");
    const ans = await request(app).post("/api/v1/certification/answers").send({ questionId: "pd2-batch-default-scope", selected: right("pd2-batch-default-scope") });
    expect(ans.body.data).toMatchObject({ correct: true, answer: right("pd2-batch-default-scope") });
  });

  it("validates input", async () => {
    expect((await request(app).get("/api/v1/certification/pd1/questions?count=999")).status).toBe(400);
    expect((await request(app).post("/api/v1/certification/answers").send({ questionId: "pd1-limits-soql", selected: [] })).status).toBe(400);
    expect((await request(app).get("/api/v1/certification/nope/questions")).status).toBe(404);
  });
});

describe("mock exams", () => {
  it("allocate: splits by weight, gives leftovers to the heaviest, never exceeds what a section has", () => {
    expect(allocate({ a: 50, b: 30, c: 20 }, { a: 99, b: 99, c: 99 }, 10)).toEqual({ a: 5, b: 3, c: 2 });
    // b has only 1: the other sections take its share.
    expect(allocate({ a: 50, b: 30, c: 20 }, { a: 99, b: 1, c: 99 }, 10)).toEqual({ a: 6, b: 1, c: 3 });
    // Fewer questions in the bank than asked for: everything, no more.
    expect(allocate({ a: 50, b: 50 }, { a: 2, b: 3 }, 60)).toEqual({ a: 2, b: 3 });
  });

  it("builds a weighted, answer-free exam with time scaled to its length", () => {
    const s = new CertificationService(bank, undefined, () => 0.42);
    const m = s.mock("admin");
    const exam = bank.exam("admin");
    const n = bank.exam("admin")?.questions.length ?? 0;
    expect(m.questions).toHaveLength(Math.min(n, 60));
    expect(new Set(m.questions.map((q) => q.id)).size).toBe(Math.min(n, 60));
    expect(m).toMatchObject({ passPercent: 65, realQuestions: 60, realMinutes: 105, minutes: Math.round((105 * Math.min(n, 60)) / 60) });
    expect(JSON.stringify(m)).not.toMatch(/explanation|"answer"/);
    expect(exam).toBeDefined();
  });

  it("grades: score, pass mark, per-section totals; unanswered counts wrong and isn't recorded", async () => {
    const attempts = new MemoryAttempts();
    const s = new CertificationService(bank, attempts);
    const res = await s.gradeMock("u1", "pd1", { "pd1-limits-soql": right("pd1-limits-soql"), "pd1-limits-dml": wrong("pd1-limits-dml"), "pd1-lwc-api": [] });
    expect(res).toMatchObject({ correct: 1, total: 3, score: 33, passed: false, passPercent: 68 });
    expect(res.sections.find((x) => x.id === "logic")).toMatchObject({ correct: 1, total: 2 });
    expect(res.results.find((r) => r.id === "pd1-limits-dml")).toMatchObject({ correct: false, selected: wrong("pd1-limits-dml"), answer: right("pd1-limits-dml") });
    expect(attempts.rows.map((r) => r.questionId).sort()).toEqual(["pd1-limits-dml", "pd1-limits-soql"]);
    const all = await s.gradeMock(null, "pd1", { "pd1-limits-soql": right("pd1-limits-soql") });
    expect(all).toMatchObject({ score: 100, passed: true });
  });

  it("refuses questions from another exam or options a question doesn't have", async () => {
    const s = new CertificationService(bank, undefined);
    await expect(s.gradeMock(null, "pd1", { "pd2-mixed-dml": ["a"] })).rejects.toThrow(/not part of this exam/);
    await expect(s.gradeMock(null, "pd1", { "pd1-limits-soql": ["h"] })).rejects.toThrow(/option it doesn't have/);
  });

  it("routes: serve a mock without answers and grade it signed out", async () => {
    const app = buildApp({ certification: new CertificationService(bank, undefined) });
    const m = await request(app).get("/api/v1/certification/pd2/mock");
    expect(m.status).toBe(200);
    expect(m.body.data.questions).toHaveLength(60);
    expect(JSON.stringify(m.body)).not.toContain("explanation");
    const g = await request(app).post("/api/v1/certification/pd2/mock/grade").send({ answers: { "pd2-batch-default-scope": right("pd2-batch-default-scope") } });
    expect(g.body.data).toMatchObject({ score: 100, passed: true });
    expect((await request(app).post("/api/v1/certification/pd2/mock/grade").send({ answers: {} })).status).toBe(400);
  });
});

describe("readiness for profiles", () => {
  it("lists only practised exams, best first, with distinct questions answered", async () => {
    const attempts = new MemoryAttempts();
    const s = new CertificationService(bank, attempts);
    expect(await s.readiness("u")).toEqual([]);
    const pd1 = bank.exam("pd1")?.questions ?? [];
    const admin = bank.exam("admin")?.questions ?? [];
    // All of PD I right; two Admin answers, one wrong.
    for (const q of pd1) attempts.rows.push({ userId: "u", exam: "pd1", questionId: q.id, correct: true });
    attempts.rows.push({ userId: "u", exam: "admin", questionId: admin[0]?.id ?? "", correct: true });
    attempts.rows.push({ userId: "u", exam: "admin", questionId: admin[1]?.id ?? "", correct: false });
    const r = await s.readiness("u");
    expect(r.map((x) => [x.exam, x.readiness, x.answered, x.total])).toEqual([
      ["pd1", 100, pd1.length, pd1.length],
      ["admin", expect.any(Number), 2, admin.length],
    ]);
    expect(r[1]?.readiness).toBeLessThan(10);
    expect(await s.readiness("someone-else")).toEqual([]);
  });
});
