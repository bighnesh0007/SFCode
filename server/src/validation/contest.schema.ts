import { z } from "zod";

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
