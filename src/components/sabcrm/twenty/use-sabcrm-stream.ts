'use client';

/**
 * SabCRM — client hook for the real-time record stream.
 *
 * `useSabcrmStream(projectId, object, onChange)` opens an `EventSource` against
 * `/api/sabcrm/stream` and invokes `onChange({ object, id })` whenever the
 * server emits a `change` event. It is the read side of the poll-based SSE
 * scaffold in `src/app/api/sabcrm/stream/route.ts` — record lists can call this
 * to live-refresh (e.g. re-fetch the affected object) without manual polling.
 *
 * NOTE: the *transport* is currently poll-based on the server (Mongo has no
 * change stream wired up yet), but this hook only sees the SSE event shape, so
 * it stays correct when the server is upgraded to true push later.
 *
 * Lifecycle:
 *   - SSR-safe: no connection is opened unless `window` + `EventSource` exist.
 *   - Reconnects with capped exponential backoff on `error`.
 *   - Closes the connection (and cancels any pending reconnect) on unmount or
 *     when `projectId` / `object` change.
 *
 * `onChange` is held in a ref so a caller passing an inline closure does not
 * thrash the connection on every render.
 */

import { useEffect, useRef } from 'react';

/** Shape emitted by the server's `change` SSE event. */
export interface SabcrmStreamChange {
  object: string;
  id: string;
  updatedAt?: string;
}

/** First reconnect delay; doubles each failure up to {@link MAX_BACKOFF_MS}. */
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Subscribe to live record changes for `(projectId[, object])`.
 *
 * @param projectId Tenant/project to scope the stream to. When falsy, no
 *   connection is opened (e.g. before the active project is known).
 * @param object    Optional object slug to narrow the stream to one object.
 * @param onChange  Called once per `change` event with `{ object, id, updatedAt }`.
 */
export function useSabcrmStream(
  projectId: string | null | undefined,
  object: string | null | undefined,
  onChange: (change: SabcrmStreamChange) => void,
): void {
  // Keep the latest callback without making it a connection dependency.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    // SSR / non-browser guard.
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }
    if (!projectId) return;

    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let backoff = BASE_BACKOFF_MS;
    let disposed = false;

    const params = new URLSearchParams({ projectId });
    if (object) params.set('object', object);
    const streamUrl = `/api/sabcrm/stream?${params.toString()}`;

    const handleChange = (evt: MessageEvent): void => {
      try {
        const data = JSON.parse(evt.data) as Partial<SabcrmStreamChange>;
        if (data && typeof data.id === 'string') {
          onChangeRef.current({
            object: typeof data.object === 'string' ? data.object : (object ?? ''),
            id: data.id,
            updatedAt:
              typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
          });
        }
      } catch {
        // Ignore malformed frames — a bad event must not break the stream.
      }
    };

    const connect = (): void => {
      if (disposed) return;
      try {
        source = new EventSource(streamUrl);
      } catch {
        scheduleReconnect();
        return;
      }

      // A successful open resets the backoff ladder.
      source.onopen = () => {
        backoff = BASE_BACKOFF_MS;
      };

      source.addEventListener('change', handleChange as EventListener);

      // `ping` / `error` SSE events are intentionally ignored by the consumer;
      // the transport-level `onerror` below drives reconnection.
      source.onerror = () => {
        // EventSource auto-reconnects, but we also tear down + back off to
        // avoid hammering a server that is returning errors (e.g. 400/500).
        if (source) {
          source.close();
          source = null;
        }
        scheduleReconnect();
      };
    };

    const scheduleReconnect = (): void => {
      if (disposed || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        connect();
      }, backoff);
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (source) {
        source.removeEventListener('change', handleChange as EventListener);
        source.close();
        source = null;
      }
    };
  }, [projectId, object]);
}

export default useSabcrmStream;
