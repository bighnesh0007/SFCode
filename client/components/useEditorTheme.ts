"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAuthState } from "@/components/auth";
import { getStore } from "@/lib/contestApi";
import { EDITOR_THEMES } from "@/lib/editorThemes";

// One store fetch per page load, shared by every editor on the page.
let cached: Promise<string | null> | null = null;

/** The Monaco theme to use: an equipped store theme, else light/dark to match the site. */
export function useEditorTheme(): string {
  const { resolvedTheme } = useTheme();
  const { isSignedIn, getToken } = useAuthState();
  const [equipped, setEquipped] = useState<string | null>(null);
  useEffect(() => {
    if (!isSignedIn) return;
    cached ??= getToken()
      .then((t) => getStore(t))
      .then((v) => v.items.find((i) => i.slot === "editor" && i.equipped)?.style ?? null)
      .catch(() => null);
    let cancelled = false;
    void cached.then((style) => !cancelled && setEquipped(style ? (EDITOR_THEMES[style] ?? null) : null));
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);
  return equipped ?? (resolvedTheme === "dark" ? "vs-dark" : "light");
}
