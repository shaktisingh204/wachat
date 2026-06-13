"use client";

import * as React from "react";

/**
 * Payload delivered to {@link useSabmailStream}'s `onNewMail` callback.
 *
 * For SSE `new_mail` events it carries the parsed event data (account, folder
 * path, and an optional new-message count). For polling-fallback ticks it is an
 * empty object `{}`, which signals the inbox to refresh unconditionally.
 */
export interface SabmailStreamPayload {
  accountId?: string;
  path?: string;
  count?: number;
}

export interface UseSabmailStreamOptions {
  /** When `false`, the hook stays idle (no SSE, no polling). Defaults to `true`. */
  enabled?: boolean;
  /** Invoked on each `new_mail` SSE event or on each polling tick. */
  onNewMail: (payload: SabmailStreamPayload) => void;
  /** Polling-fallback interval in ms. Defaults to 60000 (60s). */
  pollMs?: number;
}

export interface UseSabmailStreamResult {
  /** `true` while the SSE connection is open; `false` while closed/polling. */
  connected: boolean;
}

const STREAM_URL = "/api/sabmail/stream";
const DEFAULT_POLL_MS = 60000;
/** Consecutive SSE errors before we give up on SSE and start polling. */
const ERROR_THRESHOLD = 2;

/**
 * Real-time inbox updates over Server-Sent Events with a graceful polling
 * fallback.
 *
 * - Opens an `EventSource` to `/api/sabmail/stream` and calls `onNewMail` on
 *   every `new_mail` event (the event `data` is parsed as JSON).
 * - `EventSource` reconnects natively after transient errors; this hook only
 *   falls back to polling once errors persist past {@link ERROR_THRESHOLD}, or
 *   immediately when `EventSource` is unavailable in the runtime.
 * - While polling, it calls `onNewMail({})` every `pollMs`. The poll interval is
 *   torn down as soon as SSE reconnects.
 *
 * `onNewMail` is held in a ref so a changing callback identity does not force a
 * reconnect; the effect depends only on `enabled` and `pollMs`.
 */
export function useSabmailStream(
  opts: UseSabmailStreamOptions
): UseSabmailStreamResult {
  const { enabled = true, onNewMail, pollMs = DEFAULT_POLL_MS } = opts;

  const [connected, setConnected] = React.useState(false);

  // Keep the latest callback without re-subscribing the EventSource.
  const onNewMailRef = React.useRef(onNewMail);
  React.useEffect(() => {
    onNewMailRef.current = onNewMail;
  }, [onNewMail]);

  React.useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    let source: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let errorCount = 0;
    let disposed = false;

    const emit = (payload: SabmailStreamPayload) => {
      try {
        onNewMailRef.current(payload);
      } catch {
        // A throwing consumer must never break the stream/poll loop.
      }
    };

    const startPolling = () => {
      if (pollTimer != null || disposed) return;
      pollTimer = setInterval(() => emit({}), Math.max(1000, pollMs));
    };

    const stopPolling = () => {
      if (pollTimer != null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    // No EventSource support (older runtimes / SSR-ish environments): poll only.
    if (typeof EventSource === "undefined") {
      startPolling();
      return () => {
        disposed = true;
        stopPolling();
      };
    }

    try {
      source = new EventSource(STREAM_URL);
    } catch {
      // Construction can throw in some environments; degrade to polling.
      startPolling();
      return () => {
        disposed = true;
        stopPolling();
      };
    }

    source.onopen = () => {
      errorCount = 0;
      setConnected(true);
      // SSE is live again — drop the polling fallback.
      stopPolling();
    };

    source.onerror = () => {
      setConnected(false);
      errorCount += 1;
      // EventSource auto-reconnects; only fall back to polling once errors
      // persist, so a single blip doesn't trigger redundant fetches.
      if (errorCount >= ERROR_THRESHOLD) {
        startPolling();
      }
    };

    source.addEventListener("new_mail", (event: MessageEvent) => {
      let payload: SabmailStreamPayload = {};
      try {
        payload =
          typeof event.data === "string" && event.data.length > 0
            ? (JSON.parse(event.data) as SabmailStreamPayload)
            : {};
      } catch {
        // Malformed frame — still refresh so the inbox isn't left stale.
        payload = {};
      }
      emit(payload);
    });

    return () => {
      disposed = true;
      stopPolling();
      if (source) {
        source.onopen = null;
        source.onerror = null;
        source.close();
        source = null;
      }
      setConnected(false);
    };
  }, [enabled, pollMs]);

  return { connected };
}

export default useSabmailStream;
