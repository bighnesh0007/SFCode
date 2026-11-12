import { z } from "zod";
import { CERTIFICATIONS } from "../domain/achievements.ts";

export const handleParams = z.strictObject({ handle: z.string().min(1).max(40) });
export type HandleParams = z.infer<typeof handleParams>;

export const profileUpdateBody = z
  .strictObject({ handle: z.string().max(40).optional(), displayName: z.string().max(60).optional() })
  .refine((b) => b.handle !== undefined || b.displayName !== undefined, "Change at least one field.");
export type ProfileUpdateBody = z.infer<typeof profileUpdateBody>;

export const leaderboardQuery = z.object({ window: z.enum(["all", "30d"]).default("all") });
export type LeaderboardQuery = z.infer<typeof leaderboardQuery>;

/** An https URL on one of the given hosts (or their subdomains), or empty to clear. */
const linkOn = (hosts: string[], label: string) =>
  z
    .string()
    .max(200)
    .refine((v) => {
      if (v === "") return true;
      try {
        const u = new URL(v);
        return u.protocol === "https:" && hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
      } catch {
        return false;
      }
    }, `Use an https link on ${label}.`);

export const aboutBody = z.strictObject({
  bio: z.string().max(280),
  company: z.string().max(80),
  location: z.string().max(80),
  trailheadUrl: linkOn(["trailblazer.me", "salesforce.com", "trailhead.com"], "trailblazer.me or salesforce.com"),
  linkedinUrl: linkOn(["linkedin.com"], "linkedin.com"),
  githubUrl: linkOn(["github.com"], "github.com"),
  certifications: z.array(z.enum(CERTIFICATIONS)).max(CERTIFICATIONS.length),
  openToWork: z.boolean(),
});
export type AboutBody = z.infer<typeof aboutBody>;
