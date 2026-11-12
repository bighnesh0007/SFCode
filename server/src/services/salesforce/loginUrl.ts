/**
 * Which Salesforce hosts we will talk to.
 *
 * Both the login URL (user-chosen) and the instance URL (returned by Salesforce)
 * end up as the target of server-side requests that carry secrets, so each is
 * checked against Salesforce's own domains. Anything else would turn the connect
 * flow into a way to make this server send client secrets or tokens to an
 * arbitrary host.
 */
export const PRODUCTION_LOGIN = "https://login.salesforce.com";
export const SANDBOX_LOGIN = "https://test.salesforce.com";

const ALLOWED_SUFFIXES = [".salesforce.com", ".force.com", ".salesforce.mil", ".cloudforce.com"];

function isSalesforceHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

/** Normalised `https://host` origin, or null if not an https Salesforce origin. */
export function normaliseSalesforceOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (!isSalesforceHost(url.hostname)) return null;
  return `https://${url.hostname.toLowerCase()}`;
}

/** Accepts "production", "sandbox", or a My Domain URL. */
export function resolveLoginUrl(input: string): string | null {
  if (input === "production") return PRODUCTION_LOGIN;
  if (input === "sandbox") return SANDBOX_LOGIN;
  const origin = normaliseSalesforceOrigin(input);
  // My Domain login hosts are always `*.my.salesforce.com` (incl. sandboxes'
  // `*.sandbox.my.salesforce.com`). Narrower than the instance allowlist on purpose.
  if (!origin?.endsWith(".my.salesforce.com")) return null;
  return origin;
}
