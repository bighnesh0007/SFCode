"use client";

import dynamic from "next/dynamic";
import { useEditorTheme } from "@/components/useEditorTheme";
import { defineSfcThemes } from "@/lib/editorThemes";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false, loading: () => <div className="h-full animate-pulse rounded-md bg-muted/40" /> });

/** A compact Monaco field for forms (Apex highlighting; SOQL uses SQL mode, the closest Monaco has). */
export function CodeField({ value, onChange, language = "apex", height = 220, readOnly = false, label }: { value: string; onChange: (v: string) => void; language?: "apex" | "sql"; height?: number; readOnly?: boolean; label: string }) {
  const editorTheme = useEditorTheme();
  return (
    <div className="overflow-hidden rounded-md border" style={{ height }} aria-label={label}>
      <Editor
        language={language}
        theme={editorTheme}
                    beforeMount={defineSfcThemes}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, readOnly, lineNumbersMinChars: 3 }}
      />
    </div>
  );
}
