/** Problem discussion threads. */
import { API_BASE_URL, apiRequest } from "./apiClient";

type Token = string | null;

export interface DiscussionComment {
  id: string;
  body: string;
  spoiler: boolean;
  hidden: boolean;
  author: { handle: string; displayName: string; imageUrl: string | null };
  createdAt: string;
  canDelete: boolean;
  canHide: boolean;
}

const enc = encodeURIComponent;
export const getDiscussion = (token: Token, slug: string) => apiRequest<DiscussionComment[]>(`/api/v1/challenges/${enc(slug)}/discussion`, { token });
export const postComment = (token: Token, slug: string, body: string, spoiler: boolean) =>
  apiRequest<DiscussionComment[]>(`/api/v1/challenges/${enc(slug)}/discussion`, { method: "POST", token, body: { body, spoiler } });

async function noBody(token: Token, path: string, method: string, body?: unknown): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const b = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(b?.error?.message ?? `Request failed (HTTP ${res.status}).`);
  }
}
export const deleteComment = (token: Token, id: string) => noBody(token, `/api/v1/discussion/${enc(id)}`, "DELETE");
export const hideComment = (token: Token, id: string, hidden: boolean) => noBody(token, `/api/v1/admin/discussion/${enc(id)}`, "POST", { hidden });

export interface ModerationDiscussion extends DiscussionComment {
  problem: { slug: string; title: string; track: string };
}
export const getRecentDiscussion = (token: Token) => apiRequest<ModerationDiscussion[]>("/api/v1/admin/discussion", { token });
