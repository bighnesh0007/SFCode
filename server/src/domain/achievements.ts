/**
 * Streaks and achievements, computed on read from solves and activity, so
 * there's nothing to backfill or keep in sync. Pure functions: easy to test.
 */

/** Current and longest run of consecutive UTC days with any submission. A streak survives until the end of the day after the last active day. */
export function streaks(days: string[], todayIso: string): { current: number; longest: number } {
  const set = new Set(days);
  const dayMs = 86_400_000;
  const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

  let longest = 0;
  for (const d of set) {
    if (set.has(iso(toMs(d) - dayMs))) continue; // not the start of a run
    let len = 1;
    while (set.has(iso(toMs(d) + len * dayMs))) len++;
    longest = Math.max(longest, len);
  }
  const today = toMs(todayIso);
  let start = set.has(todayIso) ? today : set.has(iso(today - dayMs)) ? today - dayMs : null;
  let current = 0;
  while (start !== null && set.has(iso(start))) {
    current++;
    start -= dayMs;
  }
  return { current, longest };
}

export interface AchievementInput {
  solved: { slug: string; track: string; difficulty: string; category: string }[];
  score: number;
  longestStreak: number;
  contestsEntered: number;
  bestPlacement: number | null;
  roadmapPct: number | null;
  /** Live community problems the user wrote. */
  contributions?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  /** Icon token; the client maps it to an icon. */
  icon: string;
  earned: boolean;
  progress: { current: number; target: number };
}

type Def = { id: string; title: string; description: string; icon: string; target: number; measure: (i: AchievementInput) => number };

const count = (i: AchievementInput, pred: (s: AchievementInput["solved"][number]) => boolean) => i.solved.filter(pred).length;

export const ACHIEVEMENTS: Def[] = [
  { id: "first-solve", title: "Hello, World", description: "Solve your first problem.", icon: "sparkles", target: 1, measure: (i) => i.solved.length },
  { id: "query-whisperer", title: "Query Whisperer", description: "Solve 3 SOQL problems.", icon: "database", target: 3, measure: (i) => count(i, (s) => s.track === "soql") },
  { id: "trigger-tamer", title: "Trigger Tamer", description: "Solve 3 trigger problems.", icon: "zap", target: 3, measure: (i) => count(i, (s) => s.category === "Triggers") },
  { id: "bug-hunter", title: "Bug Hunter", description: "Fix 3 broken programs in the Debugging Arena.", icon: "bug", target: 3, measure: (i) => count(i, (s) => s.track === "debug") },
  { id: "flow-master", title: "Flow Master", description: "Solve 3 Flow problems.", icon: "workflow", target: 3, measure: (i) => count(i, (s) => s.track === "flow") },
  { id: "governor-slayer", title: "Governor Slayer", description: "Fix SOQL in a loop.", icon: "gauge", target: 1, measure: (i) => count(i, (s) => s.category === "Governor Limits") },
  { id: "async-ace", title: "Async Ace", description: "Solve 2 async or Batch Apex problems.", icon: "timer", target: 2, measure: (i) => count(i, (s) => s.category === "Async Apex" || s.category === "Batch Apex") },
  { id: "hard-mode", title: "Hard Mode", description: "Solve a Hard problem.", icon: "mountain", target: 1, measure: (i) => count(i, (s) => s.difficulty === "Hard") },
  { id: "century", title: "Century", description: "Earn 100 points.", icon: "trophy", target: 100, measure: (i) => i.score },
  { id: "streak-7", title: "On Fire", description: "Practise 7 days in a row.", icon: "flame", target: 7, measure: (i) => i.longestStreak },
  { id: "streak-30", title: "Unstoppable", description: "Practise 30 days in a row.", icon: "flame", target: 30, measure: (i) => i.longestStreak },
  { id: "contestant", title: "Contestant", description: "Enter a contest.", icon: "swords", target: 1, measure: (i) => i.contestsEntered },
  { id: "podium", title: "Podium", description: "Finish top 3 in a contest.", icon: "medal", target: 1, measure: (i) => (i.bestPlacement !== null && i.bestPlacement <= 3 ? 1 : 0) },
  { id: "contributor", title: "Contributor", description: "Get a problem you wrote published.", icon: "pen", target: 1, measure: (i) => i.contributions ?? 0 },
  { id: "problem-setter", title: "Problem Setter", description: "Get 5 problems you wrote published.", icon: "pen", target: 5, measure: (i) => i.contributions ?? 0 },
  { id: "pathfinder", title: "Pathfinder", description: "Finish half of your roadmap.", icon: "map", target: 50, measure: (i) => i.roadmapPct ?? 0 },
];

export function achievements(input: AchievementInput): Achievement[] {
  return ACHIEVEMENTS.map((d) => {
    const current = Math.min(d.target, Math.max(0, Math.floor(d.measure(input))));
    return { id: d.id, title: d.title, description: d.description, icon: d.icon, earned: current >= d.target, progress: { current, target: d.target } };
  });
}

/** Certifications a learner can list. A fixed list keeps profiles clean and comparable. */
export const CERTIFICATIONS = [
  "Administrator",
  "Advanced Administrator",
  "Platform App Builder",
  "Platform Developer I",
  "Platform Developer II",
  "JavaScript Developer I",
  "Sales Cloud Consultant",
  "Service Cloud Consultant",
  "Experience Cloud Consultant",
  "Data Cloud Consultant",
  "Agentforce Specialist",
  "Application Architect",
  "System Architect",
  "Technical Architect",
] as const;
