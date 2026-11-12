import { z } from "zod";

export const handleParams = z.strictObject({ handle: z.string().min(1).max(40) });
export type HandleParams = z.infer<typeof handleParams>;

export const profileUpdateBody = z
  .strictObject({ handle: z.string().max(40).optional(), displayName: z.string().max(60).optional() })
  .refine((b) => b.handle !== undefined || b.displayName !== undefined, "Change at least one field.");
export type ProfileUpdateBody = z.infer<typeof profileUpdateBody>;

export const leaderboardQuery = z.object({ window: z.enum(["all", "30d"]).default("all") });
export type LeaderboardQuery = z.infer<typeof leaderboardQuery>;
