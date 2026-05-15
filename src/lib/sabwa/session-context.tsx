'use client';

/**
 * SabWa — current-session context (client).
 *
 * Holds the list of `SabwaSession`s for the active project and the
 * currently-selected session id. Persists the choice in
 * `localStorage` under `sabwa:current-session-id` so refreshes and
 * cross-tab navigations land back on the same number.
 *
 *   selection priority:
 *     1. last value the user explicitly picked (localStorage)
 *     2. `defaultSessionId` prop (from the server layout)
 *     3. first session in the list
 *     4. undefined (no sessions yet — Connect CTA)
 *
 * `refresh()` re-pulls the list via the `listSessions` server action
 * inside a `useTransition` so the UI never blocks the call.
 */

import * as React from 'react';

import { useProject } from '@/context/project-context';
import { listSessions } from '@/app/actions/sabwa.actions';
import type { SabwaSession } from './types';

const STORAGE_KEY = 'sabwa:current-session-id';

// ─── Public types ──────────────────────────────────────────────────────────

export interface SabwaSessionInfo {
  id: string;
  phoneE164?: string;
  pushName?: string;
  status: string;
  profilePicUrl?: string;
  label?: string;
}

export interface SabwaSessionContextValue {
  current?: SabwaSessionInfo;
  sessions: SabwaSessionInfo[];
  setCurrent: (id: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Squash a Mongo-shaped `SabwaSession` (or already-serialised shape) into
 *  the structural subset the UI needs. Accepts either flavour so the server
 *  layout can pass through `listSessions` results directly. */
export function toSessionInfo(
  raw: Partial<SabwaSession> & { _id?: unknown; id?: string },
): SabwaSessionInfo {
  const id =
    typeof raw.id === 'string'
      ? raw.id
      : raw._id != null
        ? String(raw._id)
        : '';
  return {
    id,
    phoneE164: raw.phoneE164,
    pushName: raw.pushName,
    status: typeof raw.status === 'string' ? raw.status : 'pending',
    profilePicUrl: raw.profilePicUrl,
    label: raw.label,
  };
}

function readStoredId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeStoredId(id: string | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* quota / privacy mode — ignore */
  }
}

function resolveInitialId(
  sessions: SabwaSessionInfo[],
  defaultSessionId: string | undefined,
): string | undefined {
  const stored = readStoredId();
  if (stored && sessions.some((s) => s.id === stored)) return stored;
  if (defaultSessionId && sessions.some((s) => s.id === defaultSessionId)) {
    return defaultSessionId;
  }
  return sessions[0]?.id;
}

// ─── Context ───────────────────────────────────────────────────────────────

export const SabwaSessionContext =
  React.createContext<SabwaSessionContextValue>({
    current: undefined,
    sessions: [],
    setCurrent: () => {},
    refresh: async () => {},
    loading: false,
  });

// ─── Provider ──────────────────────────────────────────────────────────────

export interface SabwaSessionProviderProps {
  children: React.ReactNode;
  initialSessions: SabwaSessionInfo[];
  defaultSessionId?: string;
}

export function SabwaSessionProvider({
  children,
  initialSessions,
  defaultSessionId,
}: SabwaSessionProviderProps) {
  const { activeProjectId } = useProject();
  const [sessions, setSessions] =
    React.useState<SabwaSessionInfo[]>(initialSessions);
  const [currentId, setCurrentId] = React.useState<string | undefined>(() =>
    resolveInitialId(initialSessions, defaultSessionId),
  );
  const [isPending, startTransition] = React.useTransition();

  // On mount, re-check localStorage (was unavailable during SSR / initial state).
  React.useEffect(() => {
    setCurrentId((prev) => prev ?? resolveInitialId(sessions, defaultSessionId));
    // We only want this on mount — sessions / defaults handle their own effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = React.useCallback(async () => {
    if (!activeProjectId) return;
    await new Promise<void>((resolve) => {
      startTransition(() => {
        (async () => {
          try {
            const result = await listSessions(activeProjectId);
            if (result.ok) {
              const next = (result.sessions ?? []).map((s) =>
                toSessionInfo(s as Partial<SabwaSession>),
              );
              setSessions(next);
              setCurrentId((prev) => {
                if (prev && next.some((s) => s.id === prev)) return prev;
                return resolveInitialId(next, defaultSessionId);
              });
            }
          } catch {
            // Engine offline / action throws NOT_IMPLEMENTED — keep prior state.
          } finally {
            resolve();
          }
        })();
      });
    });
  }, [activeProjectId, defaultSessionId]);

  // Refetch when the active project changes (after mount).
  const initialProjectRef = React.useRef(activeProjectId);
  React.useEffect(() => {
    if (activeProjectId && activeProjectId !== initialProjectRef.current) {
      void refresh();
    }
  }, [activeProjectId, refresh]);

  const setCurrent = React.useCallback((id: string) => {
    setCurrentId(id);
    writeStoredId(id);
  }, []);

  const current = React.useMemo(
    () => sessions.find((s) => s.id === currentId),
    [sessions, currentId],
  );

  const value = React.useMemo<SabwaSessionContextValue>(
    () => ({
      current,
      sessions,
      setCurrent,
      refresh,
      loading: isPending,
    }),
    [current, sessions, setCurrent, refresh, isPending],
  );

  return (
    <SabwaSessionContext.Provider value={value}>
      {children}
    </SabwaSessionContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useSabwaSession(): SabwaSessionContextValue {
  return React.useContext(SabwaSessionContext);
}
