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

export interface ProfileView {
  cosmetics: Cosmetics;
  about: About;
  stats: { streak: number; longestStreak: number; coins: number | null; contests: number; bestPlacement: number | null; activeDays: number };
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
export const getLeaderboard = (window: "all" | "30d") => apiRequest<LeaderboardRow[]>(`/api/v1/leaderboard?window=${window}`);

export const updateMyAbout = (token: Token, about: { bio: string; company: string; location: string; trailheadUrl: string; linkedinUrl: string; githubUrl: string; certifications: string[]; openToWork: boolean }) =>
  apiRequest<ProfileView>("/api/v1/profile/me/about", { method: "PUT", token, body: about });
