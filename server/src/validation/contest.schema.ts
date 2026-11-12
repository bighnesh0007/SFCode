import { z } from "zod";
import { GOALS, HOURS, LEVELS, ROLES } from "../domain/roadmap.ts";

export const contestSlugParams = z.strictObject({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/) });
export type ContestSlugParams = z.infer<typeof contestSlugParams>;

export const createContestBody = z.strictObject({
  title: z.string().max(120),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  problems: z.array(z.strictObject({ slug: z.string().max(80), points: z.number().int() })).max(10),
});
export type CreateContestBody = z.infer<typeof createContestBody>;

export const storeItemBody = z.strictObject({ itemId: z.string().max(60) });
export type StoreItemBody = z.infer<typeof storeItemBody>;

export const equipBody = z.strictObject({ itemId: z.string().max(60), on: z.boolean() });
export type EquipBody = z.infer<typeof equipBody>;

export const onboardingBody = z.strictObject({
  role: z.enum(ROLES),
  level: z.enum(LEVELS),
  goal: z.enum(GOALS),
  hours: z.enum(HOURS),
});
export type OnboardingBody = z.infer<typeof onboardingBody>;

export const roadmapParams = z.strictObject({ id: z.string().regex(/^[a-z0-9-]{1,40}$/) });
export type RoadmapParams = z.infer<typeof roadmapParams>;

export const roadmapReadBody = z.strictObject({ nodeId: z.string().regex(/^[a-z0-9-]{1,60}$/), read: z.boolean() });
export type RoadmapReadBody = z.infer<typeof roadmapReadBody>;
