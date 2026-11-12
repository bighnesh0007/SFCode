/** Blog API. Shapes mirror server/src/services/blog. */
import { API_BASE_URL, apiRequest } from "./apiClient";

type Token = string | null;

export interface Author {
  handle: string;
  displayName: string;
  imageUrl: string | null;
}

export interface PostSummary {
  slug: string;
  title: string;
  excerpt: string;
  author: Author;
  score: number;
  commentCount: number;
  createdAt: string;
}

export interface PostView extends PostSummary {
  body: string;
  status: "published" | "hidden";
  updatedAt: string;
  myVote: number;
  canEdit: boolean;
  canModerate: boolean;
  comments: { id: string; body: string; author: Author; createdAt: string; hidden: boolean; canDelete: boolean }[];
}

export const listPosts = (sort: "new" | "top") => apiRequest<PostSummary[]>(`/api/v1/blog?sort=${sort}`);
export const getPost = (token: Token, slug: string) => apiRequest<PostView>(`/api/v1/blog/${encodeURIComponent(slug)}`, { token });
export const createPost = (token: Token, title: string, body: string) => apiRequest<PostView>("/api/v1/blog", { method: "POST", token, body: { title, body } });
export const updatePost = (token: Token, slug: string, changes: { title?: string; body?: string }) =>
  apiRequest<PostView>(`/api/v1/blog/${encodeURIComponent(slug)}`, { method: "PATCH", token, body: changes });
export const votePost = (token: Token, slug: string, value: -1 | 0 | 1) =>
  apiRequest<{ score: number; myVote: number }>(`/api/v1/blog/${encodeURIComponent(slug)}/vote`, { method: "POST", token, body: { value } });
export const commentOn = (token: Token, slug: string, body: string) =>
  apiRequest<PostView>(`/api/v1/blog/${encodeURIComponent(slug)}/comments`, { method: "POST", token, body: { body } });

/** 204 responses have no JSON body; shared helper for the no-content calls. */
async function noContent(token: Token, path: string, method: "POST" | "DELETE", body?: unknown): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(err?.error?.message ?? `Request failed (HTTP ${res.status}).`);
  }
}

export const deletePost = (token: Token, slug: string) => noContent(token, `/api/v1/blog/${encodeURIComponent(slug)}`, "DELETE");
export const hidePost = (token: Token, slug: string, hidden: boolean) => noContent(token, `/api/v1/blog/${encodeURIComponent(slug)}/hide`, "POST", { hidden });
export const deleteComment = (token: Token, id: string) => noContent(token, `/api/v1/blog/comments/${encodeURIComponent(id)}`, "DELETE");
