import { z } from "zod";

export const adminUsersQuery = z.object({ q: z.string().max(80).default("") });
export type AdminUsersQuery = z.infer<typeof adminUsersQuery>;

export const roleBody = z.strictObject({ userId: z.string().min(1).max(100), role: z.enum(["admin", "moderator"]) });
export type RoleBody = z.infer<typeof roleBody>;
