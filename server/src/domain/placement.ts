/**
 * The onboarding placement check: eight questions in three tiers. The level it
 * suggests is the highest tier the learner mostly gets right, and a tier only
 * counts if the ones below it were passed too.
 */
import type { Level } from "./roadmap.ts";

export type Track = "developer" | "admin";
export type Tier = 1 | 2 | 3;

export interface PlacementQuestion {
  id: string;
  tier: Tier;
  prompt: string;
  options: string[];
  answer: number;
}

const q = (id: string, tier: Tier, prompt: string, options: string[], answer: number): PlacementQuestion => ({ id, tier, prompt, options, answer });

export const PLACEMENT: Record<Track, PlacementQuestion[]> = {
  developer: [
    q("d1", 1, "Which Apex statement saves a new record to the database?", ["insert acc;", "save acc;", "commit acc;", "persist acc;"], 0),
    q("d2", 1, "Which query returns the names of accounts?", ["GET Name FROM Account", "SELECT Name FROM Account", "SELECT Name IN Account", "FIND Name FROM Account"], 1),
    q("d3", 1, "A trigger that sets a field on the record being saved, without any extra DML, should run…", ["after insert", "before insert", "in a @future method", "in a scheduled job"], 1),
    q("d4", 2, "Why should SOQL queries stay outside for loops?", ["Queries inside loops don't compile", "A transaction may run at most 100 queries", "Loops can't see query results", "It makes the code shorter"], 1),
    q("d5", 2, "What code coverage does Salesforce require to deploy Apex to production?", ["50%", "65%", "75%", "100%"], 2),
    q("d6", 2, "How does a Lightning Web Component send data up to its parent?", ["It sets a property on the parent", "It dispatches a CustomEvent", "It uses @wire", "It imports the parent class"], 1),
    q("d7", 3, "A nightly job must process 5 million records. What fits best?", ["A trigger", "A @future method", "Batch Apex", "Anonymous Apex"], 2),
    q("d8", 3, "Which is true of Queueable Apex compared with @future?", ["It can't make callouts", "It takes non-primitive arguments and can be chained", "It runs synchronously", "It has no governor limits"], 1),
  ],
  admin: [
    q("a1", 1, "Where do you add a custom field to an object?", ["App Launcher", "Object Manager", "Data Loader", "Developer Console"], 1),
    q("a2", 1, "Which record represents a potential sale in progress?", ["Lead", "Case", "Opportunity", "Campaign"], 2),
    q("a3", 1, "What controls which objects a user can create, read, edit or delete?", ["Role", "Profile and permission sets", "Queue", "Record type"], 1),
    q("a4", 2, "A field must be filled in only when Stage is Closed Lost. What do you use?", ["Make it required on the page layout", "A validation rule", "Field-level security", "A default value"], 1),
    q("a5", 2, "Org-wide default is Private. Managers must see their team's records. What grants that?", ["The role hierarchy", "A public group", "Field history tracking", "A list view"], 0),
    q("a6", 2, "The parent should show the total of its children's amounts. Which field type?", ["Formula", "Roll-up summary on a master-detail relationship", "Lookup filter", "Text area"], 1),
    q("a7", 3, "On save, set a field on the same record as fast as possible. Which automation?", ["After-save record-triggered flow", "Before-save record-triggered flow (Fast Field Updates)", "Scheduled flow", "Approval process"], 1),
    q("a8", 3, "Share every Opportunity over $1M with the Finance group. What do you create?", ["An owner-based sharing rule", "A criteria-based sharing rule", "A new profile", "A manual share on each record"], 1),
  ],
};

const PASS: Record<Tier, number> = { 1: 2, 2: 2, 3: 2 };

/** Suggested onboarding level from answers (question id → chosen option). Unanswered counts as wrong. */
export function placementLevel(track: Track, answers: Record<string, number>): { level: Level; correct: number; total: number; tiers: Record<Tier, { correct: number; total: number }> } {
  const tiers: Record<Tier, { correct: number; total: number }> = { 1: { correct: 0, total: 0 }, 2: { correct: 0, total: 0 }, 3: { correct: 0, total: 0 } };
  for (const question of PLACEMENT[track]) {
    const t = tiers[question.tier];
    t.total++;
    if (answers[question.id] === question.answer) t.correct++;
  }
  const passed = (t: Tier) => tiers[t].correct >= PASS[t];
  const level: Level = !passed(1) ? "new" : !passed(2) ? "basics" : !passed(3) ? "production" : "lead";
  const correct = tiers[1].correct + tiers[2].correct + tiers[3].correct;
  return { level, correct, total: PLACEMENT[track].length, tiers };
}

/** The questions as learners see them: no answers. */
export function placementQuestions(track: Track): { id: string; prompt: string; options: string[] }[] {
  return PLACEMENT[track].map(({ id, prompt, options }) => ({ id, prompt, options }));
}
