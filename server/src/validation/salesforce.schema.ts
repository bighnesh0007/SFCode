import { z } from "zod";

export const connectBody = z.strictObject({
  loginUrl: z.string().min(1).max(255),
  returnTo: z.string().max(512).default("/settings/org"),
});
export type ConnectBody = z.infer<typeof connectBody>;

// Salesforce may add parameters; only these three are read, the rest ignored.
export const callbackQuery = z.object({
  code: z.string().max(2048).optional(),
  state: z.string().max(2048).optional(),
  error: z.string().max(256).optional(),
  error_description: z.string().max(1024).optional(),
});
export type CallbackQuery = z.infer<typeof callbackQuery>;

/** Salesforce's own cap on anonymous Apex is far higher; this bounds abuse of our proxy. */
export const MAX_APEX_CHARS = 100_000;

export const executeBody = z.strictObject({
  code: z.string().min(1).max(MAX_APEX_CHARS),
});
export type ExecuteBody = z.infer<typeof executeBody>;

// SOQL is read-only by construction; the SELECT check only gives a clear error
// for things that aren't queries (SOSL, DML typed into the wrong box).
export const queryBody = z.strictObject({
  soql: z
    .string()
    .trim()
    .min(1)
    .max(20_000)
    .refine((q) => /^select\s/i.test(q), "Only SELECT queries can run here."),
});
export type QueryBody = z.infer<typeof queryBody>;
