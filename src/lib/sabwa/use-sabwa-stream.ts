'use client';

/**
 * useSabwaStream — Phase 2 client SSE hook.
 *
 * Opens a single `EventSource` against `/api/sabwa/stream?sessionId=…`,
 * parses each frame as JSON `{ kind, ...payload }`, and exposes:
 *
 *   - `status`     — connecting | open | closed | idle
 *   - `lastQr`     — most recent QR payload (kind === 'qr')
 *   - `lastPairCode` — most recent pair code (kind === 'pair_code')
 *   - `lastEvent`  — the last event of any kind
 *   - `subscribe(kind, handler)` — per-kind subscription, returns
 *     unsubscribe; uses a stable ref-managed Map so re-renders don't
 *     drop handlers
 *   - `isConnected` — flips true when a `status` event with
 *     `status === 'connected'` is seen
 *
 * Auto-reconnects on `onerror` with capped exponential backoff
 * (1s, 2s, 5s, 10s, 30s). Cleans up the EventSource on unmount or
 * when `sessionId` becomes falsy.
 *
 * NOTE: a separate stream API exists in `use-sabwa-data.ts` (still
 * used internally by chat realtime); this hook is the canonical
 * session-level stream entry point.
 */

import * as React from 'react';

// ─── Event taxonomy ────────────────────────────────────────────────────────

export type SabwaEventKind =
  | 'qr'
  | 'pair_code'
  | 'status'
  | 'message'
  | 'message_status'
  | 'chat'
  | 'presence'
  | 'typing'
  | 'scheduled'
  | 'campaign_paused';

/**
 * Wire-shape of a single SSE frame from `/api/sabwa/stream`. The engine
 * always includes a discriminant `kind`; the rest of the payload is
 * kind-specific and we keep it permissive on the client.
 */
export interface SabwaEvent {
  kind: SabwaEventKind;
  // status events
  status?: string;
  // pairing events
  qr?: string;
  pairCode?: string;
  // message events
  messageId?: string;
  chatJid?: string;
  fromJid?: string;
  body?: string;
  // common metadata
  sessionId?: string;
  ts?: string | number;
  [key: string]: unknown;
}

export type SabwaStreamConnectionStatus =
  | 'connecting'
  | 'open'
  | 'closed'
  | 'idle';

// ─── Legacy options (kept for back-compat with existing callers) ───────────

interface UseSabwaStreamOptions {
  /** Disable the stream entirely (e.g. when a modal is closed). */
  enabled?: boolean;
  /** Fired exactly once when the session first reaches connected. */
  onConnected?: (ev: SabwaEvent) => void;
  /**
   * Active project id (client-side localStorage state). Forwarded to
   * `/api/sabwa/stream` so the server route can authorize the request
   * by project ownership instead of relying on a Mongo session row
   * (the Rust engine keeps sessions in an in-memory pool and doesn't
   * persist them at pair time).
   */
  projectId?: string | null;
}

export interface UseSabwaStreamResult {
  status: SabwaStreamConnectionStatus;
  lastQr?: string;
  lastPairCode?: string;
  lastEvent?: SabwaEvent;
  isConnected: boolean;
  subscribe(
    kind: SabwaEventKind,
    handler: (ev: SabwaEvent) => void,
  ): () => void;
  /** @deprecated mirrors `lastEvent.error`; kept for the old pairing-flow caller. */
  error?: string;
  /** @deprecated mirrors `lastQr`; kept for the old pairing-flow caller. */
  qr?: string;
  /** @deprecated mirrors `lastPairCode`; kept for the old pairing-flow caller. */
  pairCode?: string;
}

// ─── Backoff schedule ──────────────────────────────────────────────────────

const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;
function nextBackoff(attempt: number): number {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useSabwaStream(
  sessionId: string | null | undefined,
  options: UseSabwaStreamOptions = {},
): UseSabwaStreamResult {
  const { enabled = true, onConnected, projectId } = options;

  const [status, setStatus] =
    React.useState<SabwaStreamConnectionStatus>('idle');
  const [lastQr, setLastQr] = React.useState<string | undefined>(undefined);
  const [lastPairCode, setLastPairCode] = React.useState<string | undefined>(
    undefined,
  );
  const [lastEvent, setLastEvent] = React.useState<SabwaEvent | undefined>(
    undefined,
  );
  const [isConnected, setIsConnected] = React.useState(false);

  // Stable subscriber map: kind -> set of handlers.
  type Handler = (ev: SabwaEvent) => void;
  const handlersRef = React.useRef<Map<SabwaEventKind, Set<Handler>>>(
    new Map(),
  );

  // Latest onConnected — read through a ref so the effect doesn't tear down on prop change.
  const onConnectedRef = React.useRef(onConnected);
  React.useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);

  // Stable subscribe — never changes identity.
  const subscribe = React.useCallback(
    (kind: SabwaEventKind, handler: Handler) => {
      const map = handlersRef.current;
      let set = map.get(kind);
      if (!set) {
        set = new Set();
        map.set(kind, set);
      }
      set.add(handler);
      return () => {
        const s = handlersRef.current.get(kind);
        if (!s) return;
        s.delete(handler);
        if (s.size === 0) handlersRef.current.delete(kind);
      };
    },
    [],
  );

  React.useEffect(() => {
    if (!enabled || !sessionId) {
      setStatus('idle');
      return;
    }

    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      // SSR / unsupported runtime — bail.
      return;
    }

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let cancelled = false;
    let firedConnected = false;

    const dispatch = (ev: SabwaEvent) => {
      setLastEvent(ev);
      if (ev.kind === 'qr' && typeof ev.qr === 'string') {
        setLastQr(ev.qr);
      } else if (
        ev.kind === 'pair_code' &&
        // Engine wire shape uses snake_case `code`; older callers used
        // `pairCode`. Accept either so we render whatever the engine
        // emits.
        (typeof (ev as { code?: unknown }).code === 'string' ||
          typeof ev.pairCode === 'string')
      ) {
        const next =
          typeof (ev as { code?: unknown }).code === 'string'
            ? ((ev as unknown as { code: string }).code)
            : (ev.pairCode as string);
        setLastPairCode(next);
      } else if (ev.kind === 'status' && ev.status === 'connected') {
        setIsConnected(true);
        if (!firedConnected) {
          firedConnected = true;
          onConnectedRef.current?.(ev);
        }
      } else if (ev.kind === 'status' && ev.status && ev.status !== 'connected') {
        // Engine reports a non-connected session status — flip the flag back.
        setIsConnected(false);
      }
      const set = handlersRef.current.get(ev.kind);
      if (set && set.size > 0) {
        for (const h of set) {
          try {
            h(ev);
          } catch {
            /* one handler throwing must not break the others */
          }
        }
      }
    };

    const connect = () => {
      if (cancelled) return;
      setStatus('connecting');
      try {
        const qs = new URLSearchParams({ sessionId });
        if (projectId) qs.set('projectId', projectId);
        es = new EventSource(`/api/sabwa/stream?${qs.toString()}`, {
          withCredentials: true,
        });
      } catch {
        // Construction failed — schedule a reconnect.
        scheduleReconnect();
        return;
      }

      es.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        setStatus('open');
      };

      // The engine emits SSE frames with NAMED event types
      // (`event: qr`, `event: pair_code`, `event: status`, ...) so each
      // kind must be subscribed via `addEventListener`. `onmessage`
      // alone only fires for unnamed frames and would silently drop
      // every QR / pair_code / status update — which is exactly what
      // was happening (no QR ever rendered).
      const handleNamed = (e: MessageEvent) => {
        if (cancelled) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(e.data);
        } catch {
          return;
        }
        if (!parsed || typeof parsed !== 'object') return;
        const obj = parsed as Record<string, unknown>;
        // Engine may not echo `kind` inside `data` — derive from the
        // event name when missing.
        if (!('kind' in obj) && e.type && e.type !== 'message') {
          obj.kind = e.type;
        }
        if ('kind' in obj) {
          dispatch(obj as SabwaEvent);
        }
      };

      // Unnamed frames (back-compat with `event: message`).
      es.onmessage = handleNamed;

      // Every kind we care about — see SabwaEventKind in this file.
      const NAMED_KINDS: SabwaEventKind[] = [
        'qr',
        'pair_code',
        'status',
        'message',
        'message_status',
        'chat',
        'presence',
        'typing',
        'scheduled',
        'campaign_paused',
      ];
      for (const kind of NAMED_KINDS) {
        es.addEventListener(kind, handleNamed as EventListener);
      }

      es.onerror = () => {
        if (cancelled) return;
        try {
          es?.close();
        } catch {
          /* noop */
        }
        es = null;
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      setStatus('closed');
      const delay = nextBackoff(attempt);
      attempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try {
        es?.close();
      } catch {
        /* noop */
      }
      es = null;
      setStatus('idle');
    };
  }, [enabled, sessionId, projectId]);

  return {
    status,
    lastQr,
    lastPairCode,
    lastEvent,
    isConnected,
    subscribe,
    // Back-compat aliases for the existing pairing-flow caller.
    qr: lastQr,
    pairCode: lastPairCode,
    error:
      typeof lastEvent?.error === 'string'
        ? (lastEvent.error as string)
        : undefined,
  };
}
