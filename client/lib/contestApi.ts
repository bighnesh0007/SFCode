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
  slot: "frame" | "badge" | "accent" | "editor";
  name: string;
  description: string;
  price: number;
  style: string;
  owned: boolean;
  equipped: boolean;
}

export interface FreezeOffer {
  id: string;
  name: string;
  description: string;
  price: number;
  max: number;
  owned: number;
  available: number;
}

export interface StoreView {
  wallet: Wallet | null;
  items: StoreItem[];
  freeze: FreezeOffer;
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

export const updateContest = (token: Token, slug: string, body: { title: string; startsAt: string; endsAt: string; problems: { slug: string; points: number }[] }) =>
  apiRequest<ContestView>(`/api/v1/contests/${enc(slug)}`, { method: "PATCH", token, body });

export async function deleteContest(token: Token, slug: string): Promise<void> {
  // 204 has no body, so this doesn't go through apiRequest's JSON unwrapping.
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/backend"}/api/v1/contests/${enc(slug)}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Request failed (HTTP ${res.status}).`);
  }
}
