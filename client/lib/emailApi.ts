/** Email preferences (opt-in) and staff email tools. */
import { apiRequest } from "./apiClient";

type Token = string | null;
export const getEmailPrefs = (t: Token) => apiRequest<{ weeklyDigest: boolean; available: boolean }>("/api/v1/email/prefs", { token: t });
export const setEmailPrefs = (t: Token, weeklyDigest: boolean) => apiRequest<{ weeklyDigest: boolean; available: boolean }>("/api/v1/email/prefs", { method: "PUT", token: t, body: { weeklyDigest } });
export const getEmailUsage = (t: Token) => apiRequest<{ sentThisMonth: number; cap: number; perUser: number; enabled: boolean }>("/api/v1/admin/email", { token: t });
export const sendTestDigest = (t: Token) => apiRequest<{ result: string }>("/api/v1/admin/email/test", { method: "POST", token: t });
