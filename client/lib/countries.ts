import { apiRequest } from "@/lib/apiClient";

// The code list lives on the server (it validates against it); names come from the browser.
export const getCountryCodes = () => apiRequest<string[]>("/api/v1/countries");

let names: Intl.DisplayNames | null = null;
export function countryName(code: string): string {
  try {
    names ??= new Intl.DisplayNames(["en"], { type: "region" });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Regional-indicator emoji for a two-letter code. */
export const countryFlag = (code: string) => String.fromCodePoint(0x1f1a5 + code.charCodeAt(0), 0x1f1a5 + code.charCodeAt(1));
