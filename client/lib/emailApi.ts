/** Email preferences (opt-in) and staff email tools. */
import { apiRequest } from "./apiClient";

type Token = string | null;
export type EmailPrefsView = { weeklyDigest: boolean; contestReminders: boolean; available: boolean };
export const getEmailPrefs = (t: Token) => apiRequest<EmailPrefsView>("/api/v1/email/prefs", { token: t });
/** Changes only the preferences given. */
export const setEmailPrefs = (t: Token, patch: { weeklyDigest?: boolean; contestReminders?: boolean }) => apiRequest<EmailPrefsView>("/api/v1/email/prefs", { method: "PUT", token: t, body: patch });
export const getEmailUsage = (t: Token) => apiRequest<{ sentThisMonth: number; cap: number; perUser: number; enabled: boolean }>("/api/v1/admin/email", { token: t });
export const sendTestDigest = (t: Token) => apiRequest<{ result: string }>("/api/v1/admin/email/test", { method: "POST", token: t });
