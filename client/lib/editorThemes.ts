/** Store editor themes for Monaco. Registered before mount; the token from the store picks one. */
type Monaco = typeof import("monaco-editor");

export const EDITOR_THEMES: Record<string, string> = { midnight: "sfc-midnight", paper: "sfc-paper" };

export function defineSfcThemes(monaco: Monaco): void {
  monaco.editor.defineTheme("sfc-midnight", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "c792ea", fontStyle: "bold" },
      { token: "string", foreground: "c3e88d" },
      { token: "number", foreground: "f78c6c" },
      { token: "comment", foreground: "676e95", fontStyle: "italic" },
      { token: "type", foreground: "82aaff" },
    ],
    colors: { "editor.background": "#1a1033", "editor.lineHighlightBackground": "#2a1b4d", "editorLineNumber.foreground": "#5b4b8a", "editor.selectionBackground": "#4c2f8a" },
  });
  monaco.editor.defineTheme("sfc-paper", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "8f3f71", fontStyle: "bold" },
      { token: "string", foreground: "4f7a28" },
      { token: "number", foreground: "b35e14" },
      { token: "comment", foreground: "9c8f7a", fontStyle: "italic" },
      { token: "type", foreground: "2b6f8f" },
    ],
    colors: { "editor.background": "#fbf6ec", "editor.lineHighlightBackground": "#f3ead8", "editorLineNumber.foreground": "#b9a98b", "editor.selectionBackground": "#e8dcc2" },
  });
}
