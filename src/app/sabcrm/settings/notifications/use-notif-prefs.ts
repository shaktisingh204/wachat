'use client';

/**
 * SabCRM — local notification preferences hook.
 *
 * A tiny, self-contained `localStorage`-backed store for the notification
 * preferences surfaced in Settings → Notifications. There is no backend for
 * these yet, so they live purely on the device:
 *
 *   - `muteAll`  — master kill switch. When on, every event is silenced
 *                  regardless of its per-event / per-channel toggles. The
 *                  individual toggles keep their stored values so flipping the
 *                  master back off restores the prior configuration.
 *   - `events`   — per-event channel map. Each notifiable event tracks two
 *                  independent channels: `inApp` (the live in-product feed /
 *                  bell, which the SabCRM shell already renders) and `email`
 *                  (UI-only for now — there is no email delivery engine wired
 *                  up, so the email switch records intent but does nothing until
 *                  the engine ships).
 *
 * Everything fails closed: SSR / private-mode / quota errors fall back to the
 * defaults and never throw, and unknown / removed event keys from an older
 * stored payload are ignored, so a page that mounts this hook can always
 * render against the current event catalogue.
 */

import * as React from 'react';

/** Stable identifiers for every notifiable event. */
export type NotifEventKey =
  | 'recordAssigned'
  | 'mentioned'
  | 'taskDue'
  | 'newComment'
  | 'workflowCompleted';

/** A notification channel. `email` is UI-only until the engine ships. */
export type NotifChannel = 'inApp' | 'email';

/** The two-channel on/off state for a single event. */
export interface NotifChannelState {
  inApp: boolean;
  email: boolean;
}

export interface NotifPrefs {
  /** Master mute — silences every event regardless of per-event toggles. */
  muteAll: boolean;
  /** Per-event channel preferences. */
  events: Record<NotifEventKey, NotifChannelState>;
}

/** Descriptor for one notifiable event, used to render rows + seed defaults. */
export interface NotifEventDescriptor {
  key: NotifEventKey;
  label: string;
  description: string;
  /** Default in-app channel state (email always defaults off — no engine). */
  defaultInApp: boolean;
}

/**
 * The notifiable-event catalogue. This is the single source of truth for both
 * the default preferences and the rows the page renders, so the two can never
 * drift apart.
 */
export const NOTIF_EVENTS: readonly NotifEventDescriptor[] = [
  {
    key: 'recordAssigned',
    label: 'A record is assigned to me',
    description:
      'When someone assigns a record (lead, deal, task…) to you.',
    defaultInApp: true,
  },
  {
    key: 'mentioned',
    label: 'I am mentioned in a comment',
    description: 'When a teammate @-mentions you in an activity or comment.',
    defaultInApp: true,
  },
  {
    key: 'taskDue',
    label: 'A task assigned to me is due',
    description: 'A reminder when one of your tasks reaches its due date.',
    defaultInApp: true,
  },
  {
    key: 'newComment',
    label: 'A new comment on a record I own',
    description:
      'When anyone comments on a record where you are the owner.',
    defaultInApp: true,
  },
  {
    key: 'workflowCompleted',
    label: 'A workflow I triggered completes',
    description:
      'When an automation or workflow you started finishes running.',
    defaultInApp: false,
  },
] as const;

const STORAGE_KEY = 'sabcrm.notif-prefs.v1';

/** Builds the default preferences from the event catalogue. */
function buildDefaults(): NotifPrefs {
  const events = {} as Record<NotifEventKey, NotifChannelState>;
  for (const ev of NOTIF_EVENTS) {
    events[ev.key] = { inApp: ev.defaultInApp, email: false };
  }
  return { muteAll: false, events };
}

const DEFAULT_PREFS: NotifPrefs = buildDefaults();

/**
 * Coerces an arbitrary stored payload into a complete, well-formed `NotifPrefs`.
 * Missing / unknown / malformed fields fall back to defaults so an older or
 * corrupted payload can never crash a render.
 */
function normalize(raw: unknown): NotifPrefs {
  const base = buildDefaults();
  if (!raw || typeof raw !== 'object') return base;

  const obj = raw as Partial<NotifPrefs> & Record<string, unknown>;

  if (typeof obj.muteAll === 'boolean') base.muteAll = obj.muteAll;

  const storedEvents = obj.events;
  if (storedEvents && typeof storedEvents === 'object') {
    for (const ev of NOTIF_EVENTS) {
      const stored = (storedEvents as Record<string, unknown>)[ev.key];
      if (stored && typeof stored === 'object') {
        const s = stored as Partial<NotifChannelState>;
        base.events[ev.key] = {
          inApp:
            typeof s.inApp === 'boolean' ? s.inApp : ev.defaultInApp,
          email: typeof s.email === 'boolean' ? s.email : false,
        };
      }
    }
  }

  return base;
}

function readStored(): NotifPrefs {
  if (typeof window === 'undefined') return buildDefaults();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaults();
    return normalize(JSON.parse(raw) as unknown);
  } catch {
    return buildDefaults();
  }
}

function writeStored(prefs: NotifPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / private mode — preferences stay in-memory only */
  }
}

export interface UseNotifPrefsResult {
  prefs: NotifPrefs;
  /** Toggle (or set) the master mute. */
  setMuteAll: (next: boolean) => void;
  /** Set a single channel for a single event. */
  setChannel: (
    key: NotifEventKey,
    channel: NotifChannel,
    next: boolean,
  ) => void;
  /**
   * Replace the whole preference set from an arbitrary (e.g. server-sourced)
   * payload, running it through {@link normalize} so partial / older shapes are
   * coerced to the current event catalogue. Persists to the local cache.
   */
  replace: (raw: unknown) => void;
  /** Restore every preference to its default. */
  reset: () => void;
  /** True once the client has hydrated from localStorage (avoids SSR flash). */
  hydrated: boolean;
}

/**
 * Reactive accessor for the SabCRM notification preferences. Reads once on
 * mount and persists every change. While `muteAll` is on the per-event values
 * are preserved (not cleared) so the prior setup is restored on un-mute.
 */
export function useNotifPrefs(): UseNotifPrefsResult {
  const [prefs, setPrefsState] = React.useState<NotifPrefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = React.useState(false);

  // Hydrate from storage after mount so SSR and first client render agree.
  React.useEffect(() => {
    setPrefsState(readStored());
    setHydrated(true);
  }, []);

  const commit = React.useCallback((next: NotifPrefs) => {
    writeStored(next);
    setPrefsState(next);
  }, []);

  const setMuteAll = React.useCallback(
    (next: boolean) => {
      setPrefsState((prev) => {
        const updated = { ...prev, muteAll: next };
        writeStored(updated);
        return updated;
      });
    },
    [],
  );

  const setChannel = React.useCallback(
    (key: NotifEventKey, channel: NotifChannel, next: boolean) => {
      setPrefsState((prev) => {
        const current = prev.events[key];
        if (!current) return prev;
        const updated: NotifPrefs = {
          ...prev,
          events: {
            ...prev.events,
            [key]: { ...current, [channel]: next },
          },
        };
        writeStored(updated);
        return updated;
      });
    },
    [],
  );

  const replace = React.useCallback(
    (raw: unknown) => {
      commit(normalize(raw));
    },
    [commit],
  );

  const reset = React.useCallback(() => {
    commit(buildDefaults());
  }, [commit]);

  return { prefs, setMuteAll, setChannel, replace, reset, hydrated };
}
