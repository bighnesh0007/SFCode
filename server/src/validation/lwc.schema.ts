import { z } from "zod";
import { COMPONENT_NAME, MAX_FILE_CHARS } from "../services/lwc/compiler.ts";

export const lwcCompileBody = z.strictObject({
  component: z.string().regex(COMPONENT_NAME),
  html: z.string().max(MAX_FILE_CHARS),
  js: z.string().max(MAX_FILE_CHARS),
  css: z.string().max(MAX_FILE_CHARS).default(""),
});
export type LwcCompileBody = z.infer<typeof lwcCompileBody>;
