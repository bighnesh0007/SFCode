import type { Metadata } from "next";
import { SITE_NAME, absoluteUrl } from "./site";

/**
 * Metadata for one page: its own title and description, a canonical URL, and
 * matching share cards. Titles get " | SFCode" from the root template.
 */
export function pageMeta({ title, description, path, noindex = false, absoluteTitle = false, kicker = "Salesforce practice" }: { title: string; description: string; path: string; noindex?: boolean; absoluteTitle?: boolean; kicker?: string }): Metadata {
  const url = absoluteUrl(path);
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  // A page's openGraph replaces the inherited one, image included, so every page names its card.
  const image = { url: absoluteUrl(`/og?${new URLSearchParams({ t: title.replace(` | ${SITE_NAME}`, ""), k: kicker }).toString()}`), width: 1200, height: 630, alt: title };
  return {
    // Absolute, because a section layout's plain title stops the root template reaching nested pages.
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: url },
    openGraph: { title: fullTitle, description, url, siteName: SITE_NAME, type: "website", locale: "en_US", images: [image] },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [image.url] },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Keeps meta descriptions inside what search results show (~155 characters), cut at a word. */
export function clip(text: string, max = 155): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*_#>[\]]|\(https?:[^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,.;:]$/, "")}…`;
}
