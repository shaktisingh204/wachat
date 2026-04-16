'use client';

/**
 * EmbedListener
 * -------------
 * Runs inside the hosted chat page (`/flow/[flowId]`) when the page is loaded
 * inside an iframe via the SabFlow embed SDK.
 *
 * Responsibilities:
 *   - Listen for postMessages from the parent window (setVariable, open, close)
 *   - Emit postMessages out for events: 'ready', 'message', 'completed', 'close'
 *   - Only activates when the URL has `?embed=standard|popup|bubble`
 *
 * The component mounts transparently — it renders nothing visible; it just
 * wires up the postMessage channel so the parent SDK can drive the chat.
 */

import { useEffect, useRef, useState } from 'react';

/* ── Message protocol types ──────────────────────────────────────────────── */

type InboundType = 'set-variable' | 'set-variables' | 'open' | 'close' | 'ping';
type OutboundType = 'ready' | 'message' | 'completed' | 'close' | 'resize';

interface InboundMessage {
  type: `sabflow:${InboundType}`;
  data?: unknown;
}

function isInbound(msg: unknown): msg is InboundMessage {
  if (!msg || typeof msg !== 'object') return false;
  const obj = msg as Record<string, unknown>;
  if (typeof obj.type !== 'string') return false;
  return obj.type.startsWith('sabflow:');
}

/* ── Public helper: post an event out to the parent frame ────────────────── */

/** Post a typed SabFlow event up to the embedding parent window. */
export function postEmbedEvent(type: OutboundType, data?: unknown): void {
  if (typeof window === 'undefined') return;
  if (window.parent === window) return; // not embedded
  try {
    window.parent.postMessage({ type: `sabflow:${type}`, data: data ?? null }, '*');
  } catch {
    /* parent may be cross-origin with strict policy — ignore */
  }
}

/* ── Public helper: hook up a callback for inbound set-variable(s) ───────── */

export interface InboundVariableHandler {
  (name: string, value: unknown): void;
}

/* ── Component ───────────────────────────────────────────────────────────── */

export interface EmbedListenerProps {
  /** Optional — called when the parent posts a `set-variable` message. */
  onSetVariable?: InboundVariableHandler;
  /** Optional — called when the parent requests the chat be programmatically re-opened (e.g. restart). */
  onOpen?: () => void;
  /** Optional — called when the parent requests the chat be closed. */
  onClose?: () => void;
}

export function EmbedListener({
  onSetVariable,
  onOpen,
  onClose,
}: EmbedListenerProps): null {
  // Refs so we don't re-bind the `message` listener every time handler identity
  // changes upstream.
  const onSetVarRef = useRef<InboundVariableHandler | undefined>(onSetVariable);
  const onOpenRef = useRef<(() => void) | undefined>(onOpen);
  const onCloseRef = useRef<(() => void) | undefined>(onClose);

  useEffect(() => { onSetVarRef.current = onSetVariable; }, [onSetVariable]);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Read embed mode from location.search on the client only. Using
  // `window.location` rather than `useSearchParams` avoids requiring a
  // Suspense boundary and keeps this component side-effect-only.
  const [embedMode, setEmbedMode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('embed');
    setEmbedMode(mode);

    // Apply initial variables from URL (?variables=<url-encoded JSON>)
    if (mode) {
      const raw = params.get('variables');
      const handler = onSetVarRef.current;
      if (raw && handler) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
              handler(name, value);
            }
          }
        } catch {
          /* malformed JSON — ignore */
        }
      }
    }
  }, []);

  useEffect(() => {
    // Only activate when we're actually being embedded.
    if (!embedMode) return;
    if (typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent): void => {
      // Accept any parent frame — we rely on origin checks at the API layer
      // and on the `sabflow:` namespace for message isolation.
      if (!isInbound(event.data)) return;

      const msg = event.data;
      const kind = msg.type.substring('sabflow:'.length) as InboundType;

      if (kind === 'set-variable') {
        const data = msg.data as { name?: unknown; value?: unknown } | null;
        if (data && typeof data.name === 'string') {
          onSetVarRef.current?.(data.name, data.value);
        }
        return;
      }

      if (kind === 'set-variables') {
        const data = msg.data as { variables?: Record<string, unknown> } | null;
        if (data && data.variables && typeof data.variables === 'object') {
          const handler = onSetVarRef.current;
          if (handler) {
            for (const [name, value] of Object.entries(data.variables)) {
              handler(name, value);
            }
          }
        }
        return;
      }

      if (kind === 'open')  { onOpenRef.current?.();  return; }
      if (kind === 'close') { onCloseRef.current?.(); return; }
      if (kind === 'ping')  { postEmbedEvent('ready', { mode: embedMode }); return; }
    };

    window.addEventListener('message', handleMessage, false);

    // Announce readiness to the parent so it can flush queued variables.
    postEmbedEvent('ready', { mode: embedMode });

    return () => {
      window.removeEventListener('message', handleMessage, false);
    };
  }, [embedMode]);

  return null;
}
