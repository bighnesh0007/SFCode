/** Typed calls for profiles and the leaderboard. Shapes mirror server/src/services/community. */
import { apiRequest } from "./apiClient";
import type { Track } from "./challengesApi";

type Token = string | null;

/** Equipped cosmetic style tokens per slot ("frame" | "badge" | "accent"). */
export type Cosmetics = Partial<Record<"frame" | "badge" | "accent", string>>;

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

export interface About {
  bio: string;
  company: string;
  location: string;
  trailheadUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  certifications: string[];
  openToWork: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  progress: { current: number; target: number };
}

export interface ContestResult {
  slug: string;
  title: string;
  endsAt: string;
  rank: number;
  entrants: number;
  score: number;
}

export type TierId = "novice" | "trailblazer" | "ranger" | "expert" | "legend";
export interface Tier {
  id: TierId;
  title: string;
  level: number;
  points: number;
  next: { title: string; min: number } | null;
  progress: number;
}

export interface RatingPoint {
  contestSlug: string;
  title: string;
  endsAt: string;
  rank: number;
  entrants: number;
  rating: number;
  delta: number;
}

export interface ProfileView {
  rating: { current: number; peak: number; history: RatingPoint[] } | null;
  tier: Tier;
  cosmetics: Cosmetics;
  about: About;
  stats: { freezesLeft: number; streak: number; longestStreak: number; coins: number | null; contests: number; bestPlacement: number | null; activeDays: number };
  achievements: Achievement[];
  contests: ContestResult[];
  roadmap: { title: string; done: number; total: number } | null;
  handle: string;
  displayName: string;
  imageUrl: string | null;
  joined: string;
  score: number;
  solved: number;
  rank: number | null;
  byTrack: { track: Track; solved: number; total: number }[];
  byDifficulty: { difficulty: string; solved: number; total: number }[];
  activity: { day: string; count: number }[];
  recent: { slug: string; title: string; track: Track; difficulty: string; at: string }[];
}

export interface LeaderboardRow {
  tier: { id: TierId; title: string };
  cosmetics: Cosmetics;
  rank: number;
  handle: string;
  displayName: string;
  imageUrl: string | null;
  score: number;
  solved: number;
}

export const getMyProfile = (token: Token) => apiRequest<ProfileView>("/api/v1/profile/me", { token });
export const getProfile = (handle: string) => apiRequest<ProfileView>(`/api/v1/profile/${encodeURIComponent(handle)}`);
export const updateMyProfile = (token: Token, changes: { handle?: string; displayName?: string }) =>
  apiRequest<ProfileView>("/api/v1/profile/me", { method: "PATCH", token, body: changes });
export type LeaderboardWindow = "all" | "30d" | "7d";
export type ScoredTrack = "apex" | "soql" | "debug" | "flow" | "lwc";
export const getLeaderboard = (window: LeaderboardWindow, track?: ScoredTrack) =>
  apiRequest<LeaderboardRow[]>(`/api/v1/leaderboard?window=${window}${track ? `&track=${track}` : ""}`);

export interface RatingRow {
  rank: number;
  handle: string;
  displayName: string;
  imageUrl: string | null;
  rating: number;
  contests: number;
}
export const getRatingBoard = () => apiRequest<RatingRow[]>("/api/v1/leaderboard/rating");

export const updateMyAbout = (token: Token, about: { bio: string; company: string; location: string; trailheadUrl: string; linkedinUrl: string; githubUrl: string; certifications: string[]; openToWork: boolean }) =>
  apiRequest<ProfileView>("/api/v1/profile/me/about", { method: "PUT", token, body: about });

export const getMyTier = (token: Token) => apiRequest<Tier>("/api/v1/profile/me/tier", { token });

/** Fired after an accepted submission so the rank watcher can check for a level-up. */
export const SOLVED_EVENT = "sfc:solved";
