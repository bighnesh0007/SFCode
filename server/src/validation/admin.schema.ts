import { z } from "zod";

export const adminUsersQuery = z.object({ q: z.string().max(80).default("") });
export type AdminUsersQuery = z.infer<typeof adminUsersQuery>;

export const roleBody = z.strictObject({ userId: z.string().min(1).max(100), role: z.enum(["admin", "reviewer", "buddy"]) });
export type RoleBody = z.infer<typeof roleBody>;

export const userIdParams = z.strictObject({ userId: z.string().min(1).max(100) });
export type UserIdParams = z.infer<typeof userIdParams>;

export const suspendBody = z.strictObject({ suspended: z.boolean(), reason: z.string().trim().max(300).default("") });
export type SuspendBody = z.infer<typeof suspendBody>;

export const announcementBody = z.strictObject({
  // null or empty text clears the banner.
  announcement: z.strictObject({ text: z.string().max(280), tone: z.enum(["info", "warning", "success"]) }).nullable(),
});
export type AnnouncementBody = z.infer<typeof announcementBody>;
