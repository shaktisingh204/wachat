"use client";

/**
 * useDockApps — which apps live on the macOS-style dock.
 *
 * Pin state is per-browser (localStorage) so it never blocks render on a
 * network call. Two sync channels keep every consumer consistent:
 *   - a same-tab CustomEvent (the dock and the Launchpad both mount this
 *     hook, so pinning in Launchpad must update the dock instantly), and
 *   - the cross-tab `storage` event.
 *
 * Pins are validated against the live SAB_APPS registry on every read, so a
 * stale id (renamed app, module hidden via HIDDEN_APP_IDS) silently drops
 * out instead of rendering a dead tile.
 */

import * as React from "react";

import { SAB_APPS } from "./apps";

const STORAGE_KEY = "sabnode.dock.pins.v1";
const SYNC_EVENT = "sabnode:dock-pins-changed";

/** Curated out-of-the-box dock. Order matters (left → right). */
const DEFAULT_PINS = [
  "home",
  "wachat",
  "sabflow",
  "sabchat",
  "email",
  "sabpay",
  "ad-manager",
  "sabfiles",
  "settings",
];

function validIds(): Set<string> {
  return new Set(SAB_APPS.map((app) => app.id));
}

function sanitize(ids: unknown): string[] {
  if (!Array.isArray(ids)) return DEFAULT_PINS.filter((id) => validIds().has(id));
  const known = validIds();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id === "string" && known.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function readPins(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return sanitize(DEFAULT_PINS);
    return sanitize(JSON.parse(raw));
  } catch {
    return sanitize(DEFAULT_PINS);
  }
}

function writePins(pins: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
  } catch {
    // Storage full / blocked — the in-memory state still works for this tab.
  }
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

export interface DockApps {
  /** Pinned app ids, dock order. Empty until hydrated on the client. */
  pinnedIds: string[];
  /** True once localStorage has been read (avoids SSR/first-paint mismatch). */
  hydrated: boolean;
  isPinned: (id: string) => boolean;
  pin: (id: string) => void;
  unpin: (id: string) => void;
  toggle: (id: string) => void;
  /** Restore the curated default dock. */
  reset: () => void;
}

export function useDockApps(): DockApps {
  // Start empty on both server and client so hydration matches; the real
  // pins land in a layout effect before first paint.
  const [pinnedIds, setPinnedIds] = React.useState<string[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useLayoutEffect(() => {
    setPinnedIds(readPins());
    setHydrated(true);

    const refresh = () => setPinnedIds(readPins());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STORAGE_KEY) refresh();
    };
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const pin = React.useCallback((id: string) => {
    if (!validIds().has(id)) return;
    const next = sanitize([...readPins(), id]);
    writePins(next);
  }, []);

  const unpin = React.useCallback((id: string) => {
    const next = readPins().filter((p) => p !== id);
    writePins(next);
  }, []);

  const toggle = React.useCallback(
    (id: string) => {
      if (readPins().includes(id)) unpin(id);
      else pin(id);
    },
    [pin, unpin],
  );

  const reset = React.useCallback(() => {
    writePins(sanitize(DEFAULT_PINS));
  }, []);

  const isPinned = React.useCallback(
    (id: string) => pinnedIds.includes(id),
    [pinnedIds],
  );

  return { pinnedIds, hydrated, isPinned, pin, unpin, toggle, reset };
}
