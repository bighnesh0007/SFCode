import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.ts";
import { CERTIFICATION_DIR } from "../src/container.ts";
import type { CertAttemptRepository } from "../src/repositories/certAttempt.repository.ts";
import { QuestionBank, validateExam } from "../src/services/certification/bank.ts";
import { reviewSchedule } from "../src/domain/review.ts";
import { CertificationService } from "../src/services/certification/certification.service.ts";

const bank = QuestionBank.load(CERTIFICATION_DIR);

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
  it("ships PD I and PD II, valid", () => {
    expect(bank.all().map((e) => [e.exam, e.questions.length])).toEqual([["pd1", 20], ["pd2", 13]]);
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
    expect(new Set(all).size).toBe(20);
  });

  it("grades multi-answer questions regardless of order, and only all-or-nothing", async () => {
    const service = new CertificationService(bank, undefined);
    expect((await service.answer(null, "pd1-soql-injection", ["b", "a"])).correct).toBe(true);
    expect((await service.answer(null, "pd1-soql-injection", ["a"])).correct).toBe(false);
    expect((await service.answer(null, "pd1-soql-injection", ["a", "b", "c"])).correct).toBe(false);
    const r = await service.answer(null, "pd1-limits-soql", ["a"]);
    expect(r).toMatchObject({ correct: false, answer: ["b"] });
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
    await service.answer(null, "pd1-limits-soql", ["b"]);
    expect(attempts.rows).toHaveLength(0);
    await service.answer("u1", "pd1-limits-soql", ["a"]);
    await service.answer("u1", "pd1-limits-soql", ["b"]);
    await service.answer("u1", "pd1-limits-dml", ["a"]);
    const logic = (await service.list("u1"))[0]?.sections.find((s) => s.id === "logic");
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
    expect((await service.list("u"))[0]).toMatchObject({ readiness: 0 });
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
    const ans = await request(app).post("/api/v1/certification/answers").send({ questionId: "pd2-batch-default-scope", selected: ["b"] });
    expect(ans.body.data).toMatchObject({ correct: true, answer: ["b"] });
  });

  it("validates input", async () => {
    expect((await request(app).get("/api/v1/certification/pd1/questions?count=999")).status).toBe(400);
    expect((await request(app).post("/api/v1/certification/answers").send({ questionId: "pd1-limits-soql", selected: [] })).status).toBe(400);
    expect((await request(app).get("/api/v1/certification/nope/questions")).status).toBe(404);
  });
});
