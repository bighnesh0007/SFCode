/**
 * The product catalogue: one list drives the navbar, the footer, the home page
 * grid and the placeholder pages, so a feature cannot be listed in one place
 * and missing from another.
 */
import { Bot, Bug, Database, GraduationCap, LayoutTemplate, Sparkles, Swords, Terminal, Trophy, Workflow, type LucideIcon } from "lucide-react";

export type FeatureStatus = "live" | "soon";

export interface Feature {
  id: string;
  href: string;
  title: string;
  /** Short label for the navbar. */
  nav: string;
  description: string;
  icon: LucideIcon;
  status: FeatureStatus;
  /** Shown in the top navbar (the rest live in the "More" menu and footer). */
  primary: boolean;
}

export const FEATURES: readonly Feature[] = [
  { id: "apex", href: "/playground/apex", title: "Apex Playground", nav: "Apex", description: "Write anonymous Apex and run it against your connected org, with the debug log alongside.", icon: Terminal, status: "live", primary: true },
  { id: "soql", href: "/soql", title: "SOQL Practice", nav: "SOQL", description: "LeetCode-style query challenges: filters, relationships, aggregates and subqueries, checked against an expected answer.", icon: Database, status: "live", primary: true },
  { id: "lwc", href: "/playground/lwc", title: "LWC Playground", nav: "LWC", description: "Write Lightning Web Components and preview them live.", icon: LayoutTemplate, status: "soon", primary: true },
  { id: "challenges", href: "/challenges", title: "Apex Challenge Arena", nav: "Challenges", description: "Problems on triggers, classes, batch and asynchronous Apex, graded by hidden Apex tests in your org.", icon: Swords, status: "live", primary: true },
  { id: "flows", href: "/flows", title: "Flow Builder Challenges", nav: "Flows", description: "Practice building record-triggered, screen and scheduled flows.", icon: Workflow, status: "soon", primary: false },
  { id: "debugging", href: "/debugging", title: "Debugging Arena", nav: "Debugging", description: "Find and fix the bug in existing Apex — governor limits, recursion, null handling.", icon: Bug, status: "live", primary: false },
  { id: "contests", href: "/contests", title: "Timed Contests", nav: "Contests", description: "Competitive, timed Salesforce coding rounds with a leaderboard.", icon: Trophy, status: "live", primary: true },
  { id: "generator", href: "/generator", title: "AI Problem Generator", nav: "Generator", description: "Generate fresh Salesforce challenges on any topic and difficulty.", icon: Sparkles, status: "soon", primary: false },
  { id: "interview", href: "/interview", title: "Mock Interviews", nav: "Interview", description: "AI-powered Salesforce technical interviews with feedback.", icon: Bot, status: "soon", primary: false },
  { id: "certification", href: "/certification", title: "Certification Prep", nav: "Cert Prep", description: "Original practice questions and timed mock exams for Administrator, Platform App Builder, Platform Developer I and II, and JavaScript Developer I.", icon: GraduationCap, status: "live", primary: false },
];

export function featureById(id: string): Feature {
  const f = FEATURES.find((x) => x.id === id);
  if (!f) throw new Error(`unknown feature ${id}`);
  return f;
}
