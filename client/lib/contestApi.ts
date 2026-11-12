/** Contests and the coin store. Shapes mirror server/src/services/{contests,store}. */
import { apiRequest } from "./apiClient";

type Token = string | null;

export type ContestPhase = "upcoming" | "live" | "ended";

export interface ContestSummary {
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  phase: ContestPhase;
  problemCount: number;
  entrants: number;
}

export interface StandingRow {
  rank: number;
  handle: string;
  displayName: string;
  imageUrl: string | null;
  score: number;
  penalty: number;
  problems: { slug: string; solved: boolean; wrong: number; minutes: number | null }[];
}

export interface ContestView extends ContestSummary {
  joined: boolean;
  canManage: boolean;
  problems: { slug: string; title: string; track: string; difficulty: string; points: number }[];
  standings: StandingRow[];
}

export interface Wallet {
  earnedFromSolves: number;
  earnedFromContests: number;
  earnedFromDaily: number;
  spent: number;
  balance: number;
}

export interface StoreItem {
  id: string;
  slot: "frame" | "badge" | "accent";
  name: string;
  description: string;
  price: number;
  style: string;
  owned: boolean;
  equipped: boolean;
}

export interface StoreView {
  wallet: Wallet | null;
  items: StoreItem[];
}

const enc = encodeURIComponent;
export const listContests = () => apiRequest<ContestSummary[]>("/api/v1/contests");
export const getContest = (token: Token, slug: string) => apiRequest<ContestView>(`/api/v1/contests/${enc(slug)}`, { token });
export const joinContest = (token: Token, slug: string) => apiRequest<ContestView>(`/api/v1/contests/${enc(slug)}/join`, { method: "POST", token });
export const createContest = (token: Token, body: { title: string; startsAt: string; endsAt: string; problems: { slug: string; points: number }[] }) =>
  apiRequest<ContestView>("/api/v1/contests", { method: "POST", token, body });

export const getStore = (token: Token) => apiRequest<StoreView>("/api/v1/store", { token });
export const buyItem = (token: Token, itemId: string) => apiRequest<StoreView>("/api/v1/store/buy", { method: "POST", token, body: { itemId } });
export const equipItem = (token: Token, itemId: string, on: boolean) => apiRequest<StoreView>("/api/v1/store/equip", { method: "POST", token, body: { itemId, on } });
