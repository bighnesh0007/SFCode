import { z } from "zod";

export const blogListQuery = z.object({ sort: z.enum(["new", "top"]).default("new") });
export type BlogListQuery = z.infer<typeof blogListQuery>;

export const blogSlugParams = z.strictObject({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/) });
export type BlogSlugParams = z.infer<typeof blogSlugParams>;

export const commentParams = z.strictObject({ id: z.uuid() });
export type CommentParams = z.infer<typeof commentParams>;

// Lengths are enforced (with friendly messages) in BlogService; these are hard ceilings.
export const postBody = z.strictObject({ title: z.string().max(200), body: z.string().max(25_000) });
export type PostBody = z.infer<typeof postBody>;

export const postPatchBody = z.strictObject({ title: z.string().max(200).optional(), body: z.string().max(25_000).optional() });
export type PostPatchBody = z.infer<typeof postPatchBody>;

export const voteBody = z.strictObject({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) });
export type VoteBody = z.infer<typeof voteBody>;

export const commentBody = z.strictObject({ body: z.string().max(3_000) });
export type CommentBody = z.infer<typeof commentBody>;

export const hideBody = z.strictObject({ hidden: z.boolean() });
export type HideBody = z.infer<typeof hideBody>;
