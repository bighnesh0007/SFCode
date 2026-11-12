import { z } from "zod";
import { TRACKS } from "../domain/challenge.ts";
import { MAX_FILE_CHARS } from "../services/challenges/challenge.service.ts";

export const slugParams = z.strictObject({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/) });
export type SlugParams = z.infer<typeof slugParams>;

export const submissionParams = z.strictObject({ id: z.uuid() });
export type SubmissionParams = z.infer<typeof submissionParams>;

export const submitBody = z.strictObject({
  // Names are checked against the problem in the service; this bounds shape and size.
  files: z.record(z.string().regex(/^[A-Za-z0-9_]{1,40}$/), z.string().max(MAX_FILE_CHARS)),
});
export type SubmitBody = z.infer<typeof submitBody>;

export const listQuery = z.object({ track: z.enum(TRACKS).optional() });
export type ListQuery = z.infer<typeof listQuery>;
