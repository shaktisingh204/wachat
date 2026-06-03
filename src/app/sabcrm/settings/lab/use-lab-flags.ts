'use client';

/**
 * SabCRM — local experimental feature flags ("Lab").
 *
 * A tiny, self-contained `localStorage`-backed store for a handful of
 * client-only, opt-in experimental toggles surfaced in Settings → Lab. This
 * mirrors the `useCrmPrefs` pattern: there is no backend for these yet, so they
 * live purely on the device and gate nothing server-side. Each flag is an
 * honest *UI preference* — flipping one only changes how this browser behaves.
 *
 * Everything fails closed: SSR / private-mode / quota errors fall back to the
 * defaults and never throw, so a page that mounts this hook can always render.
 */

import * as React from 'react';

/** Canonical identifiers for every experimental flag. */
export type LabFlagId =
  | 'advancedFilterGroups'
  | 'kanbanDragAndDrop'
  | 'commandMenuActions'
  | 'darkMode'
  | 'calendarView'
  | 'richTextNotes';

/** The persisted shape: every known flag mapped to a boolean. */
export type LabFlags = Record<LabFlagId, boolean>;

/** Static descriptor for rendering each toggle row. */
export interface LabFlagDescriptor {
  id: LabFlagId;
  label: string;
  description: string;
}

/**
 * The catalogue of experimental flags, in display order. Keep this in sync with
 * `LabFlagId` / `DEFAULT_FLAGS` — it is the single source of truth the page
 * iterates over to render switches.
 */
export const LAB_FLAGS: readonly LabFlagDescriptor[] = [
  {
    id: 'advancedFilterGroups',
    label: 'Advanced filter groups',
    description:
      'Nest AND / OR conditions into grouped filters for more precise record views.',
  },
  {
    id: 'kanbanDragAndDrop',
    label: 'Kanban drag-and-drop',
    description:
      'Drag cards between columns on board views to update their stage inline.',
  },
  {
    id: 'commandMenuActions',
    label: 'Command menu actions',
    description:
      'Trigger record actions and navigation straight from the ⌘K command menu.',
  },
  {
    id: 'darkMode',
    label: 'Dark mode',
    description:
      'Opt into the experimental dark palette across the SabCRM workspace.',
  },
  {
    id: 'calendarView',
    label: 'Calendar view',
    description:
      'Visualise date fields on a month / week calendar alongside table views.',
  },
  {
    id: 'richTextNotes',
    label: 'Rich text notes',
    description:
      'Format notes with headings, lists, and inline styling instead of plain text.',
  },
] as const;

const STORAGE_KEY = 'sabcrm.lab.v1';

const DEFAULT_FLAGS: LabFlags = {
  advancedFilterGroups: false,
  kanbanDragAndDrop: false,
  commandMenuActions: false,
  darkMode: false,
  calendarView: false,
  richTextNotes: false,
};

/** Returns true only for keys that belong to the current flag catalogue. */
function isKnownFlag(key: string): key is LabFlagId {
  return Object.prototype.hasOwnProperty.call(DEFAULT_FLAGS, key);
}

function readStored(): Partial<LabFlags> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    // Keep only known boolean flags — tolerate stale / unknown keys gracefully.
    const out: Partial<LabFlags> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isKnownFlag(key) && typeof value === 'boolean') {
        out[key] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeStored(flags: LabFlags): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch {
    /* quota / private mode — flags stay in-memory only */
  }
}

export interface UseLabFlagsResult {
  flags: LabFlags;
  /** Set a single flag to an explicit value. */
  setFlag: (id: LabFlagId, value: boolean) => void;
  /** Flip a single flag. */
  toggleFlag: (id: LabFlagId) => void;
  /** Turn every experimental flag back off. */
  resetAll: () => void;
  /** Count of currently-enabled flags (handy for summaries). */
  enabledCount: number;
  /** True once the client has hydrated from localStorage (avoids SSR flash). */
  hydrated: boolean;
}

/**
 * Reactive accessor for the SabCRM local experimental flags. Reads once on
 * mount and persists every change. Purely device-local — it intentionally does
 * not toggle anything on the frame root; consuming features read these flags
 * themselves as they are wired up.
 */
export function useLabFlags(): UseLabFlagsResult {
  const [flags, setFlagsState] = React.useState<LabFlags>(DEFAULT_FLAGS);
  const [hydrated, setHydrated] = React.useState(false);

  // Hydrate from storage after mount so SSR and first client render agree.
  React.useEffect(() => {
    setFlagsState({ ...DEFAULT_FLAGS, ...readStored() });
    setHydrated(true);
  }, []);

  const setFlag = React.useCallback((id: LabFlagId, value: boolean) => {
    setFlagsState((prev) => {
      if (prev[id] === value) return prev;
      const next = { ...prev, [id]: value };
      writeStored(next);
      return next;
    });
  }, []);

  const toggleFlag = React.useCallback((id: LabFlagId) => {
    setFlagsState((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeStored(next);
      return next;
    });
  }, []);

  const resetAll = React.useCallback(() => {
    setFlagsState(() => {
      writeStored(DEFAULT_FLAGS);
      return DEFAULT_FLAGS;
    });
  }, []);

  const enabledCount = React.useMemo(
    () => Object.values(flags).filter(Boolean).length,
    [flags],
  );

  return { flags, setFlag, toggleFlag, resetAll, enabledCount, hydrated };
}
