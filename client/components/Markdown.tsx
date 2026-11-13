"use client";

import { useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";

/**
 * Markdown → sanitised HTML. Statements are our own repo content today, but
 * they are injected as HTML, so they go through DOMPurify anyway: the day
 * statements become user-authored this must already be safe. (DWCode's regex
 * renderer had a stored-XSS bug; this is the parser + sanitiser it planned.)
 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(source, { async: false, gfm: true });
    // Sanitised on the server too, so the text is in the HTML search engines read.
    return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  }, [source]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
