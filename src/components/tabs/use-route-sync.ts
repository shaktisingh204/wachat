"use client";

/**
 * useTabRouteSync — keeps the active tab's `href` in sync with the URL.
 *
 * Without it, navigating *inside* a tab (e.g. clicking a sub-link in
 * Wachat) would leave the tab's stored href stale; a reload would snap
 * back to the tab's original landing route. With it, every pathname
 * change writes through to the active tab's href.
 *
 * If a different open tab already points at the same href, focus that
 * tab instead of mutating the current one — that's the natural "the user
 * clicked a link that belongs to another tab" behaviour.
 *
 * Mounted once at the dashboard layout level.
 */

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTabs } from "./tabs-context";

export function useTabRouteSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeTab, focusTab, tabs, updateActiveHref } = useTabs();

  useEffect(() => {
    if (!pathname) return;

    const search = searchParams?.toString();
    const fullHref = search ? `${pathname}?${search}` : pathname;

    // If a tab already exists for this exact href and it isn't the active
    // one, focus it (lets in-page links jump between tabs naturally).
    const matching = tabs.find((t) => t.href === fullHref);
    if (matching && matching.id !== activeTab?.id) {
      focusTab(matching.id);
      return;
    }

    if (!activeTab) return;
    if (activeTab.href === fullHref) return;
    updateActiveHref(fullHref);
  }, [pathname, searchParams, activeTab, focusTab, tabs, updateActiveHref]);
}
