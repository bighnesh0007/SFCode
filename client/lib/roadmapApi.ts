/** Onboarding quiz and roadmaps. Shapes mirror server/src/services/roadmap. */
import { API_BASE_URL, apiRequest } from "./apiClient";

type Token = string | null;

export type Role = "developer" | "admin" | "consultant" | "student" | "architect";
export type Level = "new" | "basics" | "production" | "lead";
export type Goal = "pd1" | "admin-cert" | "first-job" | "level-up" | "interviews" | "lwc" | "integration";
export type Hours = "1-2" | "3-5" | "5+";
export interface Answers {
  role: Role;
  level: Level;
  goal: Goal;
  hours: Hours;
}
export interface Onboarding extends Answers {
  roadmapId: string;
  readNodes: string[];
}

export type NodeState = "done" | "assumed" | "in_progress" | "available" | "locked";
export interface RoadmapNode {
  id: string;
  title: string;
  summary: string;
  lesson?: string;
  concepts?: string[];
  pitfalls?: string[];
  resources?: { title: string; url: string; kind: "docs" | "trailhead" | "guide" | "video" }[];
  diagram?: string;
  diagramCaption?: string;
  optional?: boolean;
  level: number;
  col: number;
  depth: number;
  requires: string[];
  cert?: { exam: string; section?: string };
  state: NodeState;
  struggling: boolean;
  read: boolean;
  completeByReading: boolean;
  completeByQuiz: boolean;
  quiz?: { q: string; options: string[]; image?: string; imageAlt?: string }[];
  problems: { slug: string; title: string; track: string; difficulty: string; status: "solved" | "attempted" | "todo" }[];
  /** Optional extra problems; solving them doesn't decide whether the step is done. Absent on older servers. */
  practice?: { slug: string; title: string; track: string; difficulty: string; status: "solved" | "attempted" | "todo" }[];
}
export interface RoadmapView {
  id: string;
  title: string;
  description: string;
  level: Level;
  personalised: boolean;
  nodes: RoadmapNode[];
  next: string | null;
  done: number;
  total: number;
}

export const getOnboarding = (token: Token) => apiRequest<Onboarding | null>("/api/v1/onboarding", { token });
export const saveOnboarding = (token: Token, a: Answers) => apiRequest<Onboarding>("/api/v1/onboarding", { method: "PUT", token, body: a });
export const getRoadmap = (token: Token, id: string) => apiRequest<RoadmapView>(`/api/v1/roadmaps/${encodeURIComponent(id)}`, { token });
export const markRead = (token: Token, id: string, nodeId: string, read: boolean) =>
  apiRequest<RoadmapView>(`/api/v1/roadmaps/${encodeURIComponent(id)}/read`, { method: "POST", token, body: { nodeId, read } });

export interface QuizResult {
  correct: number;
  total: number;
  passed: boolean;
  results: { correct: boolean; answer: number; why: string }[];
  roadmap: RoadmapView;
}
export const listRoadmaps = () => apiRequest<{ id: string; title: string; description: string; nodes: number }[]>("/api/v1/roadmaps");
export const submitQuiz = (token: Token, id: string, nodeId: string, answers: number[]) =>
  apiRequest<QuizResult>(`/api/v1/roadmaps/${encodeURIComponent(id)}/quiz`, { method: "POST", token, body: { nodeId, answers } });

export type PlacementTrack = "developer" | "admin";
export interface PlacementQuestion {
  id: string;
  prompt: string;
  options: string[];
}
export interface PlacementResult {
  level: Level;
  correct: number;
  total: number;
}
export const getPlacement = (track: PlacementTrack) => apiRequest<PlacementQuestion[]>(`/api/v1/placement/${track}`);
export const gradePlacement = (track: PlacementTrack, answers: Record<string, number>) =>
  apiRequest<PlacementResult>(`/api/v1/placement/${track}`, { method: "POST", body: { answers } });

/** Where a roadmap diagram is served (an SVG; shown with <img>, so it can't run scripts). */
/** Names for node levels, shared by the interactive roadmap and the step pages. */
export const STAGE: Record<number, string> = { 1: "Foundations", 2: "Core", 3: "Advanced", 4: "Expert" };

export const diagramUrl = (name: string) => `${API_BASE_URL}/api/v1/roadmaps/diagrams/${encodeURIComponent(name)}.svg`;
