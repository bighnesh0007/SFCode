/** Daily Challenge. Shape mirrors server/src/services/daily. */
import { apiRequest } from "./apiClient";

export interface DailyView {
  day: string;
  problem: { slug: string; title: string; track: string; difficulty: string };
  bonus: number;
  solvedToday: boolean | null;
  streak: number | null;
  wins: number | null;
  resetsIn: number;
}

export const getDaily = (token: string | null) => apiRequest<DailyView>("/api/v1/daily", { token });
