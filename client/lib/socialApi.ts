/** Follows, the activity feed and notifications. Shapes mirror server/src/services/social. */
import { apiRequest } from "./apiClient";

type Token = string | null;

export interface SocialInfo {
  followers: number;
  following: number;
  isFollowing: boolean;
  isMe: boolean;
}
export interface FeedActor {
  handle: string;
  displayName: string;
  imageUrl: string | null;
}
export type FeedItem =
  | { kind: "solve"; at: string; actor: FeedActor; problem: { slug: string; title: string; track: string; difficulty: string } }
  | { kind: "rank"; at: string; actor: FeedActor; rank: { id: string; title: string } }
  | { kind: "problem"; at: string; actor: FeedActor; problem: { slug: string; title: string; track: string; difficulty: string } }
  | { kind: "post"; at: string; actor: FeedActor; post: { slug: string; title: string } };
export interface NotificationItem {
  id: string;
  kind: "follow" | "review" | "buddy" | "mentor" | "team";
  data: Record<string, string>;
  read: boolean;
  at: string;
}

const enc = encodeURIComponent;
export const getSocial = (t: Token, handle: string) => apiRequest<SocialInfo>(`/api/v1/social/${enc(handle)}`, { token: t });
export const setFollow = (t: Token, handle: string, on: boolean) => apiRequest<SocialInfo>(`/api/v1/social/${enc(handle)}/follow`, { method: "POST", token: t, body: { on } });
export const getFeed = (t: Token, scope: "following" | "everyone") => apiRequest<FeedItem[]>(`/api/v1/feed?scope=${scope}`, { token: t });
export const getNotifications = (t: Token) => apiRequest<{ unread: number; items: NotificationItem[] }>("/api/v1/notifications", { token: t });
export const getUnread = (t: Token) => apiRequest<{ unread: number }>("/api/v1/notifications/unread", { token: t });
export const markRead = (t: Token) => apiRequest<{ ok: true }>("/api/v1/notifications/read", { method: "POST", token: t });

/** "3m", "2h", "5d" ago. */
export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
