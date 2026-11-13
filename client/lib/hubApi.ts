/** Teams, mentors and jobs. Shapes mirror server/src/services/hub. */
import { apiRequest } from "./apiClient";
import type { TierId } from "./communityApi";

type Token = string | null;
export interface TeamSummary { slug: string; name: string; members: number; owner: boolean }
export interface TeamView {
  slug: string;
  name: string;
  owner: boolean;
  joinCode: string | null;
  members: { handle: string; displayName: string; imageUrl: string | null; points: number; tier: { id: TierId; title: string }; owner: boolean; me: boolean; place: number }[];
}
export interface Mentor { handle: string; displayName: string; imageUrl: string | null; tier: { id: TierId; title: string }; topics: string[]; note: string }
export interface MyMentor { eligible: boolean; rank: string; topics: string[]; note: string; active: boolean }
export interface JobsView {
  jobs: { id: string; title: string; company: string; location: string; url: string; tags: string[]; postedAt: string; expiresAt: string }[];
  openToWork: { handle: string; displayName: string; imageUrl: string | null }[];
}
export const MENTOR_TOPICS = ["Apex", "SOQL", "Triggers", "Flows", "LWC", "Testing", "Async Apex", "Integration", "Admin", "Certification", "Career"] as const;

const enc = encodeURIComponent;
export const myTeams = (t: Token) => apiRequest<TeamSummary[]>("/api/v1/teams", { token: t });
export const createTeam = (t: Token, name: string) => apiRequest<TeamView>("/api/v1/teams", { method: "POST", token: t, body: { name } });
export const joinTeam = (t: Token, code: string) => apiRequest<TeamView>("/api/v1/teams/join", { method: "POST", token: t, body: { code } });
export const getTeam = (t: Token, slug: string) => apiRequest<TeamView>(`/api/v1/teams/${enc(slug)}`, { token: t });
export const rotateCode = (t: Token, slug: string) => apiRequest<TeamView>(`/api/v1/teams/${enc(slug)}/code`, { method: "POST", token: t });
export const leaveTeam = (t: Token, slug: string) => apiRequest<{ ok: true }>(`/api/v1/teams/${enc(slug)}/leave`, { method: "POST", token: t });
export const removeMember = (t: Token, slug: string, handle: string) => apiRequest<TeamView>(`/api/v1/teams/${enc(slug)}/remove`, { method: "POST", token: t, body: { handle } });
export const listMentors = () => apiRequest<Mentor[]>("/api/v1/mentors");
export const myMentor = (t: Token) => apiRequest<MyMentor>("/api/v1/mentors/me", { token: t });
export const saveMentor = (t: Token, m: { topics: string[]; note: string; active: boolean }) => apiRequest<MyMentor>("/api/v1/mentors/me", { method: "PUT", token: t, body: m });
export const askMentor = (t: Token, handle: string, message: string) => apiRequest<{ ok: true }>("/api/v1/mentors/ask", { method: "POST", token: t, body: { handle, message } });
export const getJobs = () => apiRequest<JobsView>("/api/v1/jobs");
export const postJob = (t: Token, j: { title: string; company: string; location: string; url: string; tags: string[]; days: number }) => apiRequest<JobsView>("/api/v1/jobs", { method: "POST", token: t, body: j });
export const deleteJob = (t: Token, id: string) => apiRequest<JobsView>(`/api/v1/jobs/${enc(id)}`, { method: "DELETE", token: t });
