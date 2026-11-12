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

/**
 * My Domain hostnames people copy from the address bar, mapped to the login
 * domain. Every My Domain org has all three under the same prefix:
 *   acme.lightning.force.com        (Lightning)   → acme.my.salesforce.com
 *   acme.my.salesforce-setup.com    (Setup)       → acme.my.salesforce.com
 * The prefix may carry one org-type label, e.g. `x-dev-ed.develop` or
 * `acme--uat.sandbox`.
 */
const PASTED_DOMAINS = [".lightning.force.com", ".my.salesforce-setup.com"];
const MY_DOMAIN_PREFIX = /^[a-z0-9-]+(\.[a-z0-9-]+)?$/;

function toLoginDomain(input: string): string {
  const withScheme = /^[a-z]+:\/\//i.test(input) ? input : `https://${input}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return input;
  }
  if (url.protocol !== "https:") return input;
  const host = url.hostname.toLowerCase();
  for (const suffix of PASTED_DOMAINS) {
    const prefix = host.slice(0, -suffix.length);
    if (host.endsWith(suffix) && MY_DOMAIN_PREFIX.test(prefix)) return `https://${prefix}.my.salesforce.com`;
  }
  return withScheme;
}

/** Accepts "production", "sandbox", or a My Domain URL (login, Lightning or Setup form). */
export function resolveLoginUrl(input: string): string | null {
  if (input === "production") return PRODUCTION_LOGIN;
  if (input === "sandbox") return SANDBOX_LOGIN;
  const origin = normaliseSalesforceOrigin(toLoginDomain(input.trim()));
  // My Domain login hosts are always `*.my.salesforce.com` (incl. sandboxes'
  // `*.sandbox.my.salesforce.com`). Narrower than the instance allowlist on purpose.
  if (!origin?.endsWith(".my.salesforce.com")) return null;
  return origin;
}
