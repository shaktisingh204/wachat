/**
 * SabNode tabs — shared types.
 *
 * A `Tab` represents one open module instance in the dashboard tab bar.
 * Tabs are persisted to localStorage, identified by a stable `id`, and
 * carry the module's hue so the bar can colour them without an extra
 * lookup per render.
 */

import type { ReactNode } from "react";

export interface TabHue {
  /** Tailwind gradient (e.g. "from-rose-500 to-pink-500"). */
  gradient: string;
  /** Soft tinted bg (e.g. "bg-rose-50"). */
  soft: string;
  /** Strong text colour (e.g. "text-rose-700"). */
  ink: string;
  /** Ring colour for focus / active outline. */
  ring: string;
  /** Hover wash — must be a literal hover:bg-* class for JIT. */
  hoverSoft: string;
}

export interface Tab {
  /** Unique tab id (UUID-style — survives reorders). */
  id: string;
  /** Module slug (e.g. "whatsapp", "crm"). Used for icon + hue lookup. */
  moduleId: string;
  /** Display title — usually the module label, may be updated by the page. */
  title: string;
  /** URL the tab points at — updated as the user navigates inside it. */
  href: string;
  /** Module-hue snapshot stored on the tab so the bar doesn't need to re-derive it. */
  hue: TabHue;
  /** Pinned tabs render compact and can't be closed via the X. */
  pinned: boolean;
  /** When the tab was first opened. */
  openedAt: number;
  /** Last time the tab was focused — used to choose the next tab on close. */
  lastActiveAt: number;
}

export interface OpenTabInput {
  moduleId: string;
  title: string;
  href: string;
  hue: TabHue;
  /** Force-open a fresh tab even if one for this module already exists. */
  forceNew?: boolean;
}

export interface TabsState {
  tabs: Tab[];
  activeId: string | null;
  /** Stack of recently closed tabs — fuels Cmd+Shift+T re-open. */
  recentlyClosed: Tab[];
}

export type TabsAction =
  | { type: "hydrate"; state: TabsState }
  | { type: "open"; tab: Tab }
  | { type: "focus"; id: string }
  | { type: "close"; id: string }
  | { type: "closeOthers"; id: string }
  | { type: "closeAll" }
  | { type: "pin"; id: string; pinned: boolean }
  | { type: "reorder"; fromId: string; toId: string }
  | { type: "updateActiveHref"; href: string; title?: string }
  | { type: "reopenLast" };

/** Read-only snapshot exposed to consumers via `useTabs()`. */
export interface TabsContextValue {
  tabs: Tab[];
  activeId: string | null;
  activeTab: Tab | null;
  openTab: (input: OpenTabInput) => Tab;
  focusTab: (id: string) => void;
  closeTab: (id: string) => void;
  closeOthers: (id: string) => void;
  closeAll: () => void;
  togglePin: (id: string) => void;
  reorderTab: (fromId: string, toId: string) => void;
  reopenLast: () => void;
  /** Write-through used by `useTabRouteSync` so a tab tracks the URL. */
  updateActiveHref: (href: string, title?: string) => void;
}

export type TabsConsumer = (ctx: TabsContextValue) => ReactNode;
