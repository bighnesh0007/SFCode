/** Public facts about the site, used for canonical links, sitemaps and share cards. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sf.bighnesh.space").replace(/\/+$/, "");
export const SITE_NAME = "SFCode";
export const SITE_TAGLINE = "Salesforce practice problems for Apex, SOQL, LWC and Flow";
export const SITE_DESCRIPTION =
  "Free Salesforce practice: Apex, SOQL, LWC, Flow and debugging problems graded in your own org, certification practice questions for Admin, PD I, PD II, App Builder and JavaScript Developer I, and step-by-step roadmaps.";

export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
