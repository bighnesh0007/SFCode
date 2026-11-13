"use client";

import { useEffect, useRef } from "react";

/**
 * Ctrl/Cmd+Enter submits from anywhere on the page. Monaco swallows key events,
 * so editors also bind it with `bindEditor` (both call the latest `submit`).
 */
export function useSubmitShortcut(submit: () => void, enabled: boolean) {
  const ref = useRef({ submit, enabled });
  useEffect(() => {
    ref.current = { submit, enabled };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && ref.current.enabled) {
        e.preventDefault();
        ref.current.submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return {
    bindEditor(editor: { addCommand(keybinding: number, handler: () => void): unknown }, monaco: { KeyMod: { CtrlCmd: number }; KeyCode: { Enter: number } }) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        if (ref.current.enabled) ref.current.submit();
      });
    },
  };
}
