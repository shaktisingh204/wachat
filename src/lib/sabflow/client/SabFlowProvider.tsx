'use client';

/**
 * SabFlowProvider — React context that owns the live SabFlow doc plus
 * presence state for a route subtree.
 *
 * Internally composes two sibling hooks (`useSabFlowDoc` + `usePresence`)
 * which are forward-declared here and implemented in adjacent files inside
 * `src/lib/sabflow/client/`. The provider:
 *
 *   - Surfaces a single `SabFlowContext` value (doc + status + peers
 *     + setLocalPresence + lastError + reconnectAttempts).
 *   - Renders a `fallback` (default "Connecting…" pill) until the doc
 *     transitions to `'connected'`.
 *   - SSR-safe: on the server (or before hydration) returns `fallback`
 *     so we never call socket/cookie APIs during pre-render.
 *   - Catches rendering errors from descendants via an inner error
 *     boundary and forwards them to the registered error sink (sibling
 *     #8 — `registerSabFlowErrorSink` from `./errorSink`).
 *
 * Exports two consumer hooks:
 *   - `useSabFlowContext()` — throws when called outside a provider.
 *   - `useSabFlowDocOrNull()` — returns `null` outside a provider; useful
 *     for optional sub-trees (sidebars, breadcrumbs) that should not
 *     hard-require the provider.
 */

import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { PresenceEntry } from '@/lib/sabflow/presence/store';
import * as Y from 'yjs';

// ── Forward-declared sibling modules ────────────────────────────────────────
//
// These imports point at sibling files inside `./` (the client/ folder).
// They are intentionally typed loosely here so this file compiles even while
// the siblings are still in flight — each sibling will tighten its own
// exported signature. Keeping this file as the single source of the context
// shape lets the other siblings depend on us instead of vice-versa.

import { useSabFlowDoc } from './useSabFlowDoc';
import { usePresence } from './usePresence';
import { reportSabFlowError } from './SabFlowErrorBoundary';

// ── Public types ────────────────────────────────────────────────────────────

export type SabFlowConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'syncing'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'closed';

export type SabFlowLocalUser = {
  userId: string;
  name?: string;
  avatarUrl?: string;
};

export type SabFlowContextValue = {
  /** The live SabFlow document, or `null` until the first sync completes. */
  doc: Y.Doc | null;
  /** Connection lifecycle state for the underlying transport. */
  status: SabFlowConnectionStatus;
  /** Other users currently editing this doc (excluding the local user). */
  peers: PresenceEntry[];
  /** Push the local user's cursor / metadata to the presence channel. */
  setLocalPresence: (
    patch: Partial<Omit<PresenceEntry, 'userId' | 'lastSeen'>>,
  ) => void;
  /** Most recent error from the doc transport, or `null`. */
  lastError: Error | null;
  /** Count of reconnect attempts since the last successful connection. */
  reconnectAttempts: number;
};

const SabFlowContext = createContext<SabFlowContextValue | null>(null);

// Named re-export for tests / advanced consumers that need to compose
// providers (e.g. storybook mocks). Most callers should use the helper
// hooks below instead of reading the context directly.
export { SabFlowContext };

// ── Provider ────────────────────────────────────────────────────────────────

export type SabFlowProviderProps = {
  workspaceId: string;
  docId: string;
  /** Server action / API caller that mints a short-lived doc token. */
  fetchToken: () => Promise<string>;
  /** Identity broadcast on the presence channel. */
  localUser: SabFlowLocalUser;
  /** Rendered while the doc is not yet `'connected'`; defaults to a pill. */
  fallback?: ReactNode;
  children: ReactNode;
};

export function SabFlowProvider({
  workspaceId,
  docId,
  fetchToken,
  localUser,
  fallback,
  children,
}: SabFlowProviderProps) {
  // SSR + first-paint guard. `useSabFlowDoc` opens a WebSocket and reads
  // window/localStorage; we keep it off the server render entirely and let
  // the fallback paint instead.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const renderedFallback = fallback ?? <DefaultConnectingFallback />;

  if (!mounted) {
    return <>{renderedFallback}</>;
  }

  return (
    <SabFlowProviderInner
      workspaceId={workspaceId}
      docId={docId}
      fetchToken={fetchToken}
      localUser={localUser}
      fallback={renderedFallback}
    >
      {children}
    </SabFlowProviderInner>
  );
}

type InnerProps = Omit<SabFlowProviderProps, 'fallback'> & {
  fallback: ReactNode;
};

function SabFlowProviderInner({
  workspaceId,
  docId,
  fetchToken,
  localUser,
  fallback,
  children,
}: InnerProps) {
  const {
    doc,
    status,
    error: lastError,
    reconnectAttempts,
  } = useSabFlowDoc({ workspaceId, docId, fetchToken });

  const { peers: presencePeers, setLocal } = usePresence(
    doc || new Y.Doc(),
    {
      localUser: {
        id: localUser.userId,
        name: localUser.name || 'Anonymous',
        color: '#ff8800',
      },
    }
  );

  const peers = useMemo<PresenceEntry[]>(() => {
    return Array.from(presencePeers.values()).map((p) => ({
      userId: p.userId,
      name: p.name,
      cursor: p.cursor ? { x: p.cursor.x, y: p.cursor.y } : undefined,
      lastSeen: p.lastSeen,
    }));
  }, [presencePeers]);

  // Bridge errors from the doc hook into the central error sink so the
  // surface layer (sibling #8) can render a toast / banner.
  useEffect(() => {
    if (lastError) {
      reportSabFlowError(lastError, {
        componentStack: `scope: doc, workspace: ${workspaceId}, doc: ${docId}`,
      });
    }
  }, [lastError, workspaceId, docId]);

  const safeSetLocalPresence = useCallback<
    SabFlowContextValue['setLocalPresence']
  >(
    (patch) => {
      try {
        setLocal({
          cursor: patch.cursor,
        });
      } catch (err) {
        reportSabFlowError(err instanceof Error ? err : new Error(String(err)), {
          componentStack: `scope: presence, workspace: ${workspaceId}, doc: ${docId}`,
        });
      }
    },
    [setLocal, workspaceId, docId],
  );

  const value = useMemo<SabFlowContextValue>(
    () => ({
      doc,
      status,
      peers,
      setLocalPresence: safeSetLocalPresence,
      lastError: lastError || null,
      reconnectAttempts,
    }),
    [doc, status, peers, safeSetLocalPresence, lastError, reconnectAttempts],
  );

  const handleBoundaryError = useCallback(
    (error: Error) => {
      reportSabFlowError(error, {
        componentStack: `scope: render, workspace: ${workspaceId}, doc: ${docId}`,
      });
    },
    [workspaceId, docId],
  );

  return (
    <SabFlowErrorBoundary onError={handleBoundaryError} fallback={fallback}>
      <SabFlowContext.Provider value={value}>
        {status === 'connected' ? children : fallback}
      </SabFlowContext.Provider>
    </SabFlowErrorBoundary>
  );
}

// ── Helper hooks ────────────────────────────────────────────────────────────

export function useSabFlowContext(): SabFlowContextValue {
  const ctx = useContext(SabFlowContext);
  if (!ctx) {
    throw new Error(
      'useSabFlowContext must be called inside a <SabFlowProvider>.',
    );
  }
  return ctx;
}

export function useSabFlowDocOrNull(): Y.Doc | null {
  const ctx = useContext(SabFlowContext);
  return ctx?.doc ?? null;
}

// ── Default fallback ────────────────────────────────────────────────────────

function DefaultConnectingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 animate-pulse rounded-full bg-amber-500"
      />
      Connecting…
    </div>
  );
}

// ── Error boundary ──────────────────────────────────────────────────────────

type BoundaryProps = {
  onError: (error: Error) => void;
  fallback: ReactNode;
  children: ReactNode;
};

type BoundaryState = { hasError: boolean };

class SabFlowErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    this.props.onError(error);
  }

  componentDidUpdate(prev: BoundaryProps): void {
    // Reset the boundary if the parent swaps to a different doc.
    if (prev.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
