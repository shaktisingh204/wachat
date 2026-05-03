"use client";

/**
 * useTabRouteSync — keeps the active tab's `href` in sync with the URL.
 *
 * MUST react ONLY to URL changes (pathname / searchParams). If we also
 * react to `activeTab` / `tabs` changes, the hook fires immediately after
 * a `focusTab(B)` dispatch — *before* `router.push` has updated `pathname`.
 * It then sees the OLD pathname, finds the OLD tab still matches it, and
 * calls `focusTab(oldTab)` — silently undoing the user's click.
 *
 * The fix is to drive the effect off URL deps only and read the latest
 * context fields through a ref, so a state change inside the provider
 * never causes this hook to re-fire.
 *
 * Behaviour on a real URL change:
 *  - If a different open tab already points at the new URL, focus it
 *    (e.g. the user clicked an internal link that belongs to another tab).
 *  - Otherwise update the active tab's `href` so it tracks the URL.
 */

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTabs } from "./tabs-context";
import type { TabsContextValue } from "./types";

export function useTabRouteSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ctx = useTabs();

  // Stash the latest context fields in a ref so the effect can read them
  // without listing them as dependencies (which would re-fire the effect
  // on every state change inside the provider).
  const ctxRef = useRef<TabsContextValue>(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    if (!pathname) return;
    const search = searchParams?.toString();
    const fullHref = search ? `${pathname}?${search}` : pathname;

    const { activeTab, focusTab, tabs, updateActiveHref } = ctxRef.current;

    // If a different tab already points at this URL, switch to it.
    const matching = tabs.find((t) => t.href === fullHref);
    if (matching && matching.id !== activeTab?.id) {
      focusTab(matching.id);
      return;
    }

    if (!activeTab) return;
    if (activeTab.href === fullHref) return;
    updateActiveHref(fullHref);
  }, [pathname, searchParams]);
}
