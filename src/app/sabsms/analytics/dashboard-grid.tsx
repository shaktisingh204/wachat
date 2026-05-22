"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

import { Button } from "@/components/zoruui";

/**
 * Customisable layout for the analytics tiles.
 *
 * Drag-and-drop is intentionally a TODO — `react-dnd` is not in the
 * project's dependency graph today, so we use up/down arrow buttons and
 * persist the order in localStorage under
 * `sabsms:analytics:layout:<workspaceId>`. When a future PR brings
 * `react-dnd` in we can swap the buttons for proper drag handles.
 */

export interface DashboardGridItem {
  id: string;
  /** Optional column-span hint — defaults to 1. */
  span?: 1 | 2 | 3;
  node: React.ReactNode;
}

export interface DashboardGridProps {
  items: DashboardGridItem[];
  /** Used to scope the persisted order. */
  workspaceId: string;
}

const STORAGE_PREFIX = "sabsms:analytics:layout:";

function loadOrder(workspaceId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + workspaceId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((x) => typeof x === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function saveOrder(workspaceId: string, order: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_PREFIX + workspaceId,
      JSON.stringify(order),
    );
  } catch {
    // ignore — quota / private mode
  }
}

function reconcileOrder(
  saved: string[] | null,
  defaults: string[],
): string[] {
  if (!saved) return defaults;
  const known = new Set(defaults);
  const out = saved.filter((id) => known.has(id));
  for (const id of defaults) if (!out.includes(id)) out.push(id);
  return out;
}

export function DashboardGrid({ items, workspaceId }: DashboardGridProps) {
  const defaults = React.useMemo(() => items.map((i) => i.id), [items]);
  const [order, setOrder] = React.useState<string[]>(defaults);

  React.useEffect(() => {
    const saved = loadOrder(workspaceId);
    setOrder(reconcileOrder(saved, defaults));
  }, [defaults, workspaceId]);

  function move(id: string, delta: -1 | 1) {
    setOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const next = [...prev];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      saveOrder(workspaceId, next);
      return next;
    });
  }

  const byId = React.useMemo(() => {
    const map = new Map<string, DashboardGridItem>();
    for (const it of items) map.set(it.id, it);
    return map;
  }, [items]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {order.map((id, i) => {
        const item = byId.get(id);
        if (!item) return null;
        const colSpan =
          item.span === 2
            ? "lg:col-span-2"
            : item.span === 3
              ? "lg:col-span-2"
              : "";
        return (
          <div key={id} className={`relative ${colSpan}`}>
            <div className="absolute -top-1 right-2 z-10 flex items-center gap-0.5 rounded border border-zoru-line bg-zoru-bg/90 px-1 py-0.5 opacity-0 shadow-sm transition-opacity hover:opacity-100 focus-within:opacity-100">
              <GripVertical className="h-3 w-3 text-zoru-ink-muted" />
              <ZoruButton
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                aria-label="Move tile up"
                disabled={i === 0}
                onClick={() => move(id, -1)}
              >
                <ChevronUp className="h-3 w-3" />
              </ZoruButton>
              <ZoruButton
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                aria-label="Move tile down"
                disabled={i === order.length - 1}
                onClick={() => move(id, 1)}
              >
                <ChevronDown className="h-3 w-3" />
              </ZoruButton>
            </div>
            {item.node}
          </div>
        );
      })}
    </div>
  );
}
