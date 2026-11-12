/** Compile a component on the server. The result runs only in a sandboxed iframe. */
import { apiRequest } from "./apiClient";

export const compileLwcComponent = (component: string, files: { html: string; js: string; css: string }) =>
  apiRequest<{ code: string }>("/api/v1/lwc/compile", { method: "POST", body: { component, ...files } }).then((r) => r.code);
