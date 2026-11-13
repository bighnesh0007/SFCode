import type { Track } from "./challengesApi";

/** Landing-page copy for each track: what people search for, and what they'll find. */
export const TRACK_SEO: Record<Track, { title: string; h1: string; description: string; intro: string[] }> = {
  apex: {
    title: "Apex Practice Problems and Trigger Exercises",
    h1: "Apex practice problems",
    description: "Practise Apex on real problems: triggers, bulkification, Batch, Queueable and Scheduled Apex, callouts and tests, graded by deploying to your own Salesforce org.",
    intro: [
      "Each problem is a small, realistic task: a trigger that defaults a field, a Batch job that closes stale opportunities, a Queueable that syncs data, a callout with a mock. You write the Apex in the browser and submit it.",
      "Grading is a check-only deploy to your own Developer Edition org. Hidden Apex tests run against your code with bulk data, so a solution that works for one record but breaks for 200 doesn't pass. Nothing is left behind in your org.",
    ],
  },
  soql: {
    title: "SOQL Practice Problems with Answers",
    h1: "SOQL practice problems",
    description: "SOQL practice queries from Easy to Hard: filters, relationship queries, subqueries, semi-joins, aggregates and date literals, checked row by row against the expected result.",
    intro: [
      "Write one SOQL query per problem: filtering and sorting, parent and child relationship queries, semi-joins and anti-joins, GROUP BY with HAVING, and date literals like THIS_QUARTER.",
      "Your query runs against seeded data in your org and is compared row by row with the expected result, so you learn what the query actually returns, not just whether it compiles. Every problem has hints and, once solved, an editorial.",
    ],
  },
  debug: {
    title: "Apex Debugging Exercises",
    h1: "Apex debugging exercises",
    description: "Fix broken Apex: SOQL and DML in loops, governor limit exceptions, null pointers, recursive triggers and SOQL injection. Practise finding the bug like on the job.",
    intro: [
      "Every exercise starts with Apex that compiles but fails: a query inside a loop that hits the 101 SOQL limit, a trigger that recurses, a map lookup that returns null, a dynamic query open to injection.",
      "Find the cause, fix it with the smallest sensible change, and submit. Hidden tests reproduce the original failure, so the fix has to address the root cause.",
    ],
  },
  flow: {
    title: "Salesforce Flow Practice Exercises",
    h1: "Salesforce Flow practice",
    description: "Build record-triggered, before-save, after-save and autolaunched Flows in your own org, with decisions, loops and collections, and have them graded automatically.",
    intro: [
      "Flow is where most Salesforce automation lives now. These exercises cover before-save field updates, after-save record creation, decision elements, loops over record collections and autolaunched flows with input and output variables.",
      "You build each flow in Flow Builder in your own org, then submit. Tests insert and update records to check the flow behaves as described.",
    ],
  },
  lwc: {
    title: "LWC Practice Problems",
    h1: "Lightning Web Components practice problems",
    description: "Lightning Web Components practice: reactivity, getters, events, lists, accessibility, debouncing and multi-step forms, tested in your browser with no org needed.",
    intro: [
      "Build Lightning Web Components from a counter up to a sortable, paginated table, a debounced search box and a multi-step form. Each problem spells out the public API and the markup the tests look for.",
      "Components compile and preview live in your browser, and visible tests run as you type. Submitting runs hidden tests in an isolated sandbox. No org needed.",
    ],
  },
};
