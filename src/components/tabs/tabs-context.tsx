"use client";

/**
 * SabNode TabsProvider.
 *
 * State machine for the dashboard tab system. Tabs persist to localStorage
 * (key `sabnode:tabs:v1`) so reloads restore the user's working set.
 *
 *  - openTab: opens a new tab, OR focuses an existing tab for the same
 *    module unless `forceNew` is true.
 *  - focusTab: marks a tab active and bumps `lastActiveAt`.
 *  - closeTab: removes a tab, picks the next active tab by recency,
 *    pushes the closed tab onto `recentlyClosed` (capped to 10).
 *  - closeOthers / closeAll: bulk dismiss; pinned tabs survive.
 *  - togglePin: pinned tabs sort to the front and ignore close.
 *  - reorderTab: simple swap-by-id used by drag-and-drop.
 *  - updateActiveHref: called by the route-sync hook so a tab tracks the
 *    user's in-page navigation without spawning a new tab.
 *  - reopenLast: pops the recently-closed stack.
 *
 * The provider owns navigation: any state change that requires the URL to
 * follow (open/focus/close) calls `router.push` to the relevant tab's href.
 */

import * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import type {
  OpenTabInput,
  Tab,
  TabsAction,
  TabsContextValue,
  TabsState,
} from "./types";

const STORAGE_KEY = "sabnode:tabs:v1";
const RECENTLY_CLOSED_LIMIT = 10;

const initialState: TabsState = {
  tabs: [],
  activeId: null,
  recentlyClosed: [],
};

function makeTab(input: OpenTabInput): Tab {
  const now = Date.now();
  return {
    id: `t_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    moduleId: input.moduleId,
    title: input.title,
    href: input.href,
    hue: input.hue,
    pinned: false,
    openedAt: now,
    lastActiveAt: now,
  };
}

function pickNextActive(tabs: Tab[]): string | null {
  if (tabs.length === 0) return null;
  // Prefer the most-recently-active surviving tab.
  const sorted = [...tabs].sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  return sorted[0].id;
}

function reducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "open":
      return {
        ...state,
        tabs: [...state.tabs, action.tab],
        activeId: action.tab.id,
      };

    case "focus": {
      if (!state.tabs.some((t) => t.id === action.id)) return state;
      return {
        ...state,
        activeId: action.id,
        tabs: state.tabs.map((t) =>
          t.id === action.id ? { ...t, lastActiveAt: Date.now() } : t,
        ),
      };
    }

    case "close": {
      const closing = state.tabs.find((t) => t.id === action.id);
      if (!closing) return state;
      // Pinned tabs ignore the X (UI hides it but defend against shortcuts).
      if (closing.pinned) return state;

      const remaining = state.tabs.filter((t) => t.id !== action.id);
      const nextActive =
        state.activeId === action.id ? pickNextActive(remaining) : state.activeId;
      const recentlyClosed = [closing, ...state.recentlyClosed].slice(0, RECENTLY_CLOSED_LIMIT);

      return {
        ...state,
        tabs: remaining,
        activeId: nextActive,
        recentlyClosed,
      };
    }

    case "closeOthers": {
      const target = state.tabs.find((t) => t.id === action.id);
      if (!target) return state;
      const closed = state.tabs.filter((t) => t.id !== action.id && !t.pinned);
      const remaining = state.tabs.filter((t) => t.id === action.id || t.pinned);
      const recentlyClosed = [...closed, ...state.recentlyClosed].slice(0, RECENTLY_CLOSED_LIMIT);
      return {
        ...state,
        tabs: remaining,
        activeId: action.id,
        recentlyClosed,
      };
    }

    case "closeAll": {
      const closed = state.tabs.filter((t) => !t.pinned);
      const remaining = state.tabs.filter((t) => t.pinned);
      const recentlyClosed = [...closed, ...state.recentlyClosed].slice(0, RECENTLY_CLOSED_LIMIT);
      return {
        ...state,
        tabs: remaining,
        activeId: remaining[0]?.id ?? null,
        recentlyClosed,
      };
    }

    case "pin": {
      const tabs = state.tabs.map((t) =>
        t.id === action.id ? { ...t, pinned: action.pinned } : t,
      );
      // Sort so pinned tabs come first (stable within each partition).
      const pinned = tabs.filter((t) => t.pinned);
      const unpinned = tabs.filter((t) => !t.pinned);
      return { ...state, tabs: [...pinned, ...unpinned] };
    }

    case "reorder": {
      if (action.fromId === action.toId) return state;
      const tabs = [...state.tabs];
      const fromIdx = tabs.findIndex((t) => t.id === action.fromId);
      const toIdx = tabs.findIndex((t) => t.id === action.toId);
      if (fromIdx === -1 || toIdx === -1) return state;
      // Don't allow dragging across the pinned/unpinned boundary —
      // pinned tabs always sort to the front.
      if (tabs[fromIdx].pinned !== tabs[toIdx].pinned) return state;
      const [moved] = tabs.splice(fromIdx, 1);
      tabs.splice(toIdx, 0, moved);
      return { ...state, tabs };
    }

    case "updateActiveHref": {
      if (!state.activeId) return state;
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === state.activeId
            ? {
                ...t,
                href: action.href,
                title: action.title ?? t.title,
                lastActiveAt: Date.now(),
              }
            : t,
        ),
      };
    }

    case "reopenLast": {
      const [last, ...rest] = state.recentlyClosed;
      if (!last) return state;
      const reborn: Tab = { ...last, lastActiveAt: Date.now() };
      return {
        ...state,
        tabs: [...state.tabs, reborn],
        activeId: reborn.id,
        recentlyClosed: rest,
      };
    }

    default:
      return state;
  }
}

/* ── Persistence ──────────────────────────────────────────────────── */

function loadPersisted(): TabsState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TabsState;
    // Defensive: validate the minimum shape so a stale/foreign blob never
    // crashes the provider.
    if (!parsed || !Array.isArray(parsed.tabs)) return null;
    return {
      tabs: parsed.tabs,
      activeId: parsed.activeId ?? null,
      recentlyClosed: Array.isArray(parsed.recentlyClosed) ? parsed.recentlyClosed : [],
    };
  } catch {
    return null;
  }
}

function persist(state: TabsState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / disabled storage — silently ignore */
  }
}

/* ── Context ──────────────────────────────────────────────────────── */

const TabsContext = createContext<TabsContextValue | null>(null);

export function TabsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(reducer, initialState);
  const hydratedRef = useRef(false);

  // Hydrate once on mount so SSR + first paint match.
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted) dispatch({ type: "hydrate", state: persisted });
    hydratedRef.current = true;
  }, []);

  // Debounced persistence — write whenever state changes after hydration.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const id = window.setTimeout(() => persist(state), 120);
    return () => window.clearTimeout(id);
  }, [state]);

  // Cross-tab sync: when another browser tab mutates storage, mirror it.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as TabsState;
        if (parsed && Array.isArray(parsed.tabs)) {
          dispatch({ type: "hydrate", state: parsed });
        }
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // After every state change, ensure the URL matches the active tab's href.
  // This is what makes tab focus/open/close actually change pages. We compare
  // including search params so a tab like `/x?foo=bar` doesn't trigger an
  // infinite push loop against `pathname = "/x"`.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const active = state.tabs.find((t) => t.id === state.activeId);
    if (!active) return;
    const search = searchParams?.toString();
    const currentHref = search ? `${pathname}?${search}` : pathname;
    if (active.href === currentHref) return;
    router.push(active.href);
  }, [state.activeId, state.tabs, router, pathname, searchParams]);

  const openTab = useCallback(
    (input: OpenTabInput): Tab => {
      // Reuse an existing tab for the same moduleId unless forceNew is set.
      const existing = !input.forceNew
        ? state.tabs.find((t) => t.moduleId === input.moduleId)
        : undefined;
      if (existing) {
        dispatch({ type: "focus", id: existing.id });
        return existing;
      }
      // Pre-mint the tab here so the synchronous return matches the tab
      // that ends up in state. The reducer just appends it.
      const tab = makeTab(input);
      dispatch({ type: "open", tab });
      return tab;
    },
    [state.tabs],
  );

  const focusTab = useCallback((id: string) => dispatch({ type: "focus", id }), []);
  const closeTab = useCallback((id: string) => dispatch({ type: "close", id }), []);
  const closeOthers = useCallback((id: string) => dispatch({ type: "closeOthers", id }), []);
  const closeAll = useCallback(() => dispatch({ type: "closeAll" }), []);
  const togglePin = useCallback(
    (id: string) => {
      const tab = state.tabs.find((t) => t.id === id);
      if (!tab) return;
      dispatch({ type: "pin", id, pinned: !tab.pinned });
    },
    [state.tabs],
  );
  const reorderTab = useCallback(
    (fromId: string, toId: string) => dispatch({ type: "reorder", fromId, toId }),
    [],
  );
  const reopenLast = useCallback(() => dispatch({ type: "reopenLast" }), []);
  const updateActiveHref = useCallback(
    (href: string, title?: string) => dispatch({ type: "updateActiveHref", href, title }),
    [],
  );

  const value = useMemo<TabsContextValue>(
    () => ({
      tabs: state.tabs,
      activeId: state.activeId,
      activeTab: state.tabs.find((t) => t.id === state.activeId) ?? null,
      openTab,
      focusTab,
      closeTab,
      closeOthers,
      closeAll,
      togglePin,
      reorderTab,
      reopenLast,
      updateActiveHref,
    }),
    [
      state.tabs,
      state.activeId,
      openTab,
      focusTab,
      closeTab,
      closeOthers,
      closeAll,
      togglePin,
      reorderTab,
      reopenLast,
      updateActiveHref,
    ],
  );

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

export function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error("useTabs must be used inside <TabsProvider>");
  }
  return ctx;
}

/** Optional accessor that returns null instead of throwing — for code that
 *  may legitimately render outside the provider (e.g. unit tests). */
export function useTabsOptional(): TabsContextValue | null {
  return useContext(TabsContext);
}
