/** Admin API. The server re-checks the caller's standing on every call. */
import { apiRequest } from "./apiClient";

type Token = string | null;
export type Standing = "owner" | "admin" | "reviewer" | "buddy";
export type StaffRole = "admin" | "reviewer" | "buddy";
/** Server-side cap, mirrored for display. */
export const MAX_ADMINS = 2;
/** Who may grant or revoke each role (mirrors the server). */
export const CAN_GRANT: Record<StaffRole, Standing[]> = { admin: ["owner"], reviewer: ["owner", "admin"], buddy: ["owner", "admin", "reviewer"] };
export const isStaff = (s: Standing | null | undefined) => s === "owner" || s === "admin" || s === "reviewer";

export interface AdminOverview {
  learners: number;
  connectedOrgs: number;
  submissions: number;
  submissions24h: number;
  byStatus: Record<string, number>;
}

export interface AdminUser {
  userId: string;
  handle: string;
  displayName: string;
  joined: string;
  roles: StaffRole[];
  owner: boolean;
}

export const getStanding = (token: Token) => apiRequest<{ standing: Standing }>("/api/v1/admin/me", { token }).then((r) => r.standing);
export const getOverview = (token: Token) => apiRequest<AdminOverview>("/api/v1/admin/overview", { token });
export const getUsers = (token: Token, q: string) => apiRequest<AdminUser[]>(`/api/v1/admin/users?q=${encodeURIComponent(q)}`, { token });

export async function setRole(token: Token, userId: string, role: StaffRole, grant: boolean): Promise<void> {
  // 204 has no body, so this doesn't go through apiRequest's JSON unwrapping.
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/backend"}/api/v1/admin/roles`, {
    method: grant ? "POST" : "DELETE",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ userId, role }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Request failed (HTTP ${res.status}).`);
  }
}

export interface BuddyApplicationRow {
  id: string;
  motivation: string;
  link: string | null;
  createdAt: string;
  handle: string | null;
  displayName: string;
}
export const getApplications = (token: Token) => apiRequest<BuddyApplicationRow[]>("/api/v1/admin/applications", { token });
export const decideApplication = (token: Token, id: string, approve: boolean, note: string) =>
  apiRequest<{ ok: true }>(`/api/v1/admin/applications/${encodeURIComponent(id)}/decide`, { method: "POST", token, body: { approve, note } });

export type PointsMatrix = Record<"lwc" | "apex" | "debug" | "flow" | "soql", Record<"Easy" | "Medium" | "Hard", number>>;
export interface PointsSettings {
  matrix: PointsMatrix;
  coinsPerPoint: number;
}
export const getPoints = () => apiRequest<PointsSettings>("/api/v1/points");
export const savePoints = (token: Token, p: PointsSettings) => apiRequest<PointsSettings>("/api/v1/admin/points", { method: "PUT", token, body: p });

export interface DailyPoint {
  day: string;
  signups: number;
  submissions: number;
  accepted: number;
  active: number;
}
export interface ProblemRow {
  slug: string;
  title: string;
  submissions: number;
  accepted: number;
  solvers: number;
  rate: number | null;
}
export interface AdminDashboard {
  days: DailyPoint[];
  top: ProblemRow[];
  hardest: ProblemRow[];
}
export const getDashboard = (token: Token) => apiRequest<AdminDashboard>("/api/v1/admin/dashboard", { token });

export interface AdminUserDetail {
  userId: string;
  handle: string;
  displayName: string;
  imageUrl: string | null;
  joined: string;
  roles: StaffRole[];
  submissions: number;
  accepted: number;
  solved: number;
  lastActive: string | null;
  certAnswers: number;
  org: { username: string; connectedAt: string } | null;
  recent: { slug: string; title: string; status: string; at: string }[];
  owner: boolean;
  /** null when Clerk couldn't be asked. */
  suspended: boolean | null;
}
export const getUserDetail = (token: Token, userId: string) => apiRequest<AdminUserDetail>(`/api/v1/admin/users/${encodeURIComponent(userId)}`, { token });

export async function setSuspended(token: Token, userId: string, suspended: boolean, reason: string): Promise<void> {
  // 204 has no body, so this doesn't go through apiRequest's JSON unwrapping.
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/backend"}/api/v1/admin/users/${encodeURIComponent(userId)}/suspension`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ suspended, reason }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Request failed (HTTP ${res.status}).`);
  }
}

export interface AuditRow {
  id: string;
  actorId: string;
  action: string;
  targetId: string | null;
  detail: Record<string, unknown>;
  at: string;
}
export const getAudit = (token: Token) => apiRequest<AuditRow[]>("/api/v1/admin/audit", { token });

export type AnnouncementTone = "info" | "warning" | "success";
export interface Announcement {
  text: string;
  tone: AnnouncementTone;
  id: string;
  updatedAt: string;
}
export const getAnnouncement = () => apiRequest<{ announcement: Announcement | null }>("/api/v1/announcement").then((r) => r.announcement);
export const saveAnnouncement = (token: Token, value: { text: string; tone: AnnouncementTone } | null) =>
  apiRequest<{ announcement: Announcement | null }>("/api/v1/admin/announcement", { method: "PUT", token, body: { announcement: value } }).then((r) => r.announcement);

export interface ErrorGroup {
  fingerprint: string;
  source: "client" | "server";
  name: string;
  message: string;
  stack: string | null;
  path: string | null;
  userAgent: string | null;
  occurrences: number;
  users: number;
  firstSeen: string;
  lastSeen: string;
  resolvedAt: string | null;
}
export const getErrors = (token: Token, open: boolean) => apiRequest<ErrorGroup[]>(`/api/v1/admin/errors?open=${open}`, { token });
export async function resolveError(token: Token, fingerprint: string): Promise<void> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/backend"}/api/v1/admin/errors/${fingerprint}/resolve`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Could not resolve (HTTP ${res.status}).`);
}

export interface Analytics {
  days: { day: string; views: number }[];
  pages: { path: string; views: number }[];
  total: number;
}
export const getAnalytics = (token: Token) => apiRequest<Analytics>("/api/v1/admin/analytics", { token });

export interface ProblemStatRow {
  slug: string;
  title: string;
  track: string;
  difficulty: string;
  community: boolean;
  submissions: number;
  accepted: number;
  solvers: number;
  attempters: number;
  solveRate: number | null;
}
export const getProblemStats = (token: Token) => apiRequest<ProblemStatRow[]>("/api/v1/admin/problems", { token });

export interface AdminStoreItem {
  id: string;
  slot: string;
  name: string;
  description: string;
  price: number;
  basePrice: number;
  retired: boolean;
  owners: number;
}
export const getAdminStore = (token: Token) => apiRequest<AdminStoreItem[]>("/api/v1/admin/store", { token });

async function noBody(token: Token, path: string, method: string, body: unknown): Promise<void> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/backend"}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(b?.error?.message ?? `Request failed (HTTP ${res.status}).`);
  }
}
export const setStoreItem = (token: Token, itemId: string, change: { price: number; retired: boolean }) =>
  noBody(token, `/api/v1/admin/store/${encodeURIComponent(itemId)}`, "PUT", change);

interface ModAuthor {
  handle: string;
  displayName: string;
}
export interface ModerationQueue {
  posts: { slug: string; title: string; author: ModAuthor; hidden: boolean; score: number; comments: number; createdAt: string }[];
  comments: { id: string; body: string; author: ModAuthor; hidden: boolean; post: { slug: string; title: string }; createdAt: string }[];
}
export const getModeration = (token: Token) => apiRequest<ModerationQueue>("/api/v1/admin/moderation", { token });
export const setCommentHidden = (token: Token, id: string, hidden: boolean) => noBody(token, `/api/v1/admin/moderation/comments/${encodeURIComponent(id)}`, "POST", { hidden });
