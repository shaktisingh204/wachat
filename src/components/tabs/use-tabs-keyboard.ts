"use client";

/**
 * useTabsKeyboard — wires browser-style tab shortcuts.
 *
 *  Ctrl/Cmd + W            close active tab
 *  Ctrl/Cmd + Shift + T    reopen last closed tab
 *  Ctrl/Cmd + 1..8         focus the Nth tab
 *  Ctrl/Cmd + 9            focus the LAST tab (matches browser convention)
 *  Ctrl/Cmd + Tab          focus the next tab (cycle)
 *  Ctrl/Cmd + Shift + Tab  focus the previous tab (cycle)
 *
 * Mounted once at the dashboard layout level.
 */

import { useEffect } from "react";
import { useTabs } from "./tabs-context";

export function useTabsKeyboard() {
  const { tabs, activeId, focusTab, closeTab, reopenLast } = useTabs();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Don't hijack when the user is typing in a form field (except the
      // close shortcut, which is universal).
      const target = e.target as HTMLElement | null;
      const inField =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // Cmd/Ctrl + W — close active tab.
      if (e.key.toLowerCase() === "w") {
        if (!activeId) return;
        e.preventDefault();
        closeTab(activeId);
        return;
      }

      // Cmd/Ctrl + Shift + T — reopen last closed.
      if (e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        reopenLast();
        return;
      }

      // Cmd/Ctrl + Tab — cycle next/prev.
      if (e.key === "Tab") {
        if (tabs.length === 0) return;
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeId);
        const delta = e.shiftKey ? -1 : 1;
        const nextIdx = (idx + delta + tabs.length) % tabs.length;
        focusTab(tabs[nextIdx].id);
        return;
      }

      // Cmd/Ctrl + 1..9 — jump to Nth (or last).
      if (!inField && /^[1-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10);
        const target = n === 9 ? tabs[tabs.length - 1] : tabs[n - 1];
        if (target) {
          e.preventDefault();
          focusTab(target.id);
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tabs, activeId, focusTab, closeTab, reopenLast]);
}
