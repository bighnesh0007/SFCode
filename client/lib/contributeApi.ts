/** Contributor status and Buddy applications. Shapes mirror server/src/services/buddy. */
import { apiRequest } from "./apiClient";
import type { Standing } from "./adminApi";

export interface MyContributorStatus {
  standing: Standing | null;
  application: { status: "pending" | "approved" | "rejected"; createdAt: string; note: string | null } | null;
}

export const getMyContributorStatus = (token: string | null) => apiRequest<MyContributorStatus>("/api/v1/contribute/me", { token });
export const applyForBuddy = (token: string | null, motivation: string, link: string) =>
  apiRequest<MyContributorStatus>("/api/v1/contribute/apply", { method: "POST", token, body: { motivation, link } });
