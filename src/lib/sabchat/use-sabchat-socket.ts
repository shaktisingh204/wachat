'use client';

import * as React from 'react';

import { getSabchatWsTicket } from '@/app/actions/sabchat-ws.actions';

/** One realtime frame off the SabChat websocket. */
export interface SabchatWsEvent {
  /** `message.created` | `conversation.updated` | `conversation.created` |
   *  `typing` | `presence` | `pong`. */
  type: string;
  payload: any;
}

export type SabchatSocketStatus = 'idle' | 'connecting' | 'open' | 'closed';

export interface UseSabchatSocketResult {
  status: SabchatSocketStatus;
  /** Tell the tenant a conversation is being typed in (agent actor). */
  sendTyping: (conversationId: string) => void;
  /** Self-report presence to the rest of the tenant's agents. */
  setPresence: (status: 'online' | 'away' | 'busy') => void;
  /** Announce opening/closing a conversation — drives the collision warning. */
  sendViewing: (conversationId: string, state: 'open' | 'close') => void;
}

const HEARTBEAT_MS = 25_000;
const MAX_BACKOFF_MS = 15_000;

/**
 * Open and maintain the SabChat agent realtime socket for the active
 * project. Handles ticket minting, reconnect with exponential backoff, and a
 * ping heartbeat. `onEvent` is invoked for every inbound frame; keep it cheap
 * (the hook stores it in a ref so changing its identity never reconnects).
 *
 * The socket carries `message.created` / `conversation.updated` (published by
 * the Rust message + widget crates) plus `typing` / `presence` frames.
 */
export function useSabchatSocket(opts?: {
  onEvent?: (ev: SabchatWsEvent) => void;
  enabled?: boolean;
}): UseSabchatSocketResult {
  const enabled = opts?.enabled ?? true;
  const onEventRef = React.useRef(opts?.onEvent);
  onEventRef.current = opts?.onEvent;

  const [status, setStatus] = React.useState<SabchatSocketStatus>('idle');

  const wsRef = React.useRef<WebSocket | null>(null);
  const heartbeatRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = React.useRef(1000);
  const closedRef = React.useRef(false);

  const send = React.useCallback((data: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  const sendTyping = React.useCallback(
    (conversationId: string) => {
      if (conversationId) send({ type: 'typing', conversationId });
    },
    [send],
  );

  const setPresence = React.useCallback(
    (presence: 'online' | 'away' | 'busy') => send({ type: 'presence', status: presence }),
    [send],
  );

  const sendViewing = React.useCallback(
    (conversationId: string, state: 'open' | 'close') => {
      if (conversationId) send({ type: 'viewing', conversationId, state });
    },
    [send],
  );

  React.useEffect(() => {
    if (!enabled) return;
    closedRef.current = false;

    const clearHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (closedRef.current) return;
      const delay = Math.min(backoffRef.current, MAX_BACKOFF_MS);
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      reconnectRef.current = setTimeout(() => void connect(), delay);
    };

    const connect = async () => {
      if (closedRef.current) return;
      setStatus('connecting');
      let ticket: Awaited<ReturnType<typeof getSabchatWsTicket>>;
      try {
        ticket = await getSabchatWsTicket();
      } catch {
        scheduleReconnect();
        return;
      }
      if (closedRef.current) return;
      if (!ticket.ok) {
        // No project / not authed — keep retrying slowly in case the
        // project gets selected in another tab.
        scheduleReconnect();
        return;
      }

      let ws: WebSocket;
      try {
        ws = new WebSocket(`${ticket.url}?token=${encodeURIComponent(ticket.token)}`);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (closedRef.current) {
          ws.close();
          return;
        }
        backoffRef.current = 1000;
        setStatus('open');
        setPresence('online');
        clearHeartbeat();
        heartbeatRef.current = setInterval(() => send({ type: 'ping' }), HEARTBEAT_MS);
      };

      ws.onmessage = (e) => {
        let ev: SabchatWsEvent | null = null;
        try {
          ev = JSON.parse(e.data as string);
        } catch {
          return;
        }
        if (ev && typeof ev.type === 'string' && ev.type !== 'pong') {
          onEventRef.current?.(ev);
        }
      };

      const onDown = () => {
        clearHeartbeat();
        if (wsRef.current === ws) wsRef.current = null;
        if (!closedRef.current) {
          setStatus('closed');
          scheduleReconnect();
        }
      };
      ws.onclose = onDown;
      ws.onerror = onDown;
    };

    void connect();

    return () => {
      closedRef.current = true;
      clearHeartbeat();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
        try {
          ws.close();
        } catch {
          /* already closing */
        }
      }
      setStatus('idle');
    };
    // `send` / `setPresence` are stable (useCallback with stable deps).
  }, [enabled, send, setPresence]);

  return { status, sendTyping, setPresence, sendViewing };
}
