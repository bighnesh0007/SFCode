/** Typed calls for profiles and the leaderboard. Shapes mirror server/src/services/community. */
import { apiRequest } from "./apiClient";
import type { Track } from "./challengesApi";

type Token = string | null;

export interface ProfileView {
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
