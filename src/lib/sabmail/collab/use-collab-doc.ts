'use client';

/**
 * useSabmailCollabDoc — optional real-time CRDT layer for collaborative drafting.
 *
 * Owns a Yjs `Y.Doc` for one draft and syncs it through the box-only Yjs
 * gateway (`services/sabflow-ws`) using the gateway's binary wire protocol
 * (0x00 SYNC frames) and its `sabflow-jwt.<token>` subprotocol.
 *
 * Degrade-safe by construction:
 *   - disabled unless `NEXT_PUBLIC_SABMAIL_COLLAB_ENABLED === 'true'`,
 *   - the token endpoint 503s when the gateway/JWT_SECRET aren't configured,
 *   - any connect failure leaves the composer in plain single-user mode.
 *
 * The doc exposes a `Y.Text('body')` for the message HTML and a `Y.Map('meta')`
 * for the subject; binding to the contentEditable editor lives in
 * `bind-collab-editor.ts` and only runs once `status === 'connected'`.
 */

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';

export type SabmailCollabStatus =
  | 'disabled'
  | 'connecting'
  | 'syncing'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface UseSabmailCollabResult {
  doc: Y.Doc | null;
  status: SabmailCollabStatus;
  /** True while a live, synced gateway connection is up. */
  live: boolean;
}

const TAG_SYNC = 0x00;
const SYNC_STEP1 = 0x00;
const SYNC_STEP2 = 0x01;
const SYNC_UPDATE = 0x02;
const ORIGIN = Symbol('sabmail-ws');

const BACKOFF_MIN = 1_000;
const BACKOFF_MAX = 20_000;
const RECONNECT_CAP = 8;

function collabEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SABMAIL_COLLAB_ENABLED === 'true';
}

function gatewayBase(): string {
  const env = process.env.NEXT_PUBLIC_SABMAIL_WS_URL || process.env.NEXT_PUBLIC_SABFLOW_WS_URL;
  if (env) return env;
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/sabflow/ws`;
}

interface TokenResponse {
  token: string;
  workspaceId: string;
  docId: string;
}

async function fetchToken(docId: string): Promise<TokenResponse | null> {
  try {
    const res = await fetch(`/api/sabmail/ws-token?docId=${encodeURIComponent(docId)}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return null; // 503 = gateway/secret not configured → degrade
    const body = (await res.json()) as Partial<TokenResponse>;
    if (!body.token || !body.workspaceId) return null;
    return { token: body.token, workspaceId: body.workspaceId, docId };
  } catch {
    return null;
  }
}

class SabmailWsProvider {
  private ws: WebSocket | null = null;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private synced = false;
  private readonly onUpdate: (u: Uint8Array, origin: unknown) => void;

  constructor(
    private readonly docId: string,
    private readonly doc: Y.Doc,
    private readonly onStatus: (s: SabmailCollabStatus) => void,
  ) {
    this.onUpdate = (update, origin) => {
      if (origin === ORIGIN) return;
      this.send(SYNC_UPDATE, update);
    };
    this.doc.on('update', this.onUpdate);
    void this.connect();
  }

  destroy() {
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.doc.off('update', this.onUpdate);
    try {
      this.ws?.close(1000, 'unmount');
    } catch {
      /* ignore */
    }
    this.ws = null;
  }

  private async connect() {
    if (this.destroyed) return;
    this.onStatus(this.attempts === 0 ? 'connecting' : 'reconnecting');

    const tok = await fetchToken(this.docId);
    if (this.destroyed) return;
    if (!tok) {
      // No token → gateway not available. Stop trying; stay degraded.
      this.onStatus('disabled');
      return;
    }

    const base = gatewayBase();
    if (!base) {
      this.onStatus('disabled');
      return;
    }
    const sep = base.includes('?') ? '&' : '?';
    const url = `${base}${sep}workspaceId=${encodeURIComponent(
      tok.workspaceId,
    )}&docId=${encodeURIComponent(this.docId)}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url, [`sabflow-jwt.${tok.token}`]);
    } catch {
      this.scheduleReconnect();
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      if (this.destroyed) return;
      this.onStatus('syncing');
      this.send(SYNC_STEP1, Y.encodeStateVector(this.doc));
    };

    ws.onmessage = (ev) => {
      if (!(ev.data instanceof ArrayBuffer)) return;
      const buf = new Uint8Array(ev.data);
      if (buf.length < 2 || buf[0] !== TAG_SYNC) return;
      const sub = buf[1];
      const payload = buf.subarray(2);
      if (sub === SYNC_STEP1) {
        this.send(SYNC_STEP2, Y.encodeStateAsUpdate(this.doc, payload));
      } else if (sub === SYNC_STEP2 || sub === SYNC_UPDATE) {
        try {
          Y.applyUpdate(this.doc, payload, ORIGIN);
        } catch {
          return;
        }
        if (!this.synced && sub === SYNC_STEP2) {
          this.synced = true;
          this.attempts = 0;
          this.onStatus('connected');
        }
      }
    };

    ws.onclose = () => {
      if (this.destroyed) return;
      this.ws = null;
      this.synced = false;
      this.scheduleReconnect();
    };
    ws.onerror = () => {
      /* onclose drives reconnect */
    };
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    if (this.attempts >= RECONNECT_CAP) {
      this.onStatus('disabled');
      return;
    }
    const base = Math.min(BACKOFF_MAX, BACKOFF_MIN * 2 ** this.attempts);
    const delay = Math.max(BACKOFF_MIN, Math.round(base * (0.8 + Math.random() * 0.4)));
    this.attempts += 1;
    this.onStatus('reconnecting');
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.connect();
    }, delay);
  }

  private send(sub: number, payload: Uint8Array) {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const frame = new Uint8Array(2 + payload.length);
    frame[0] = TAG_SYNC;
    frame[1] = sub;
    frame.set(payload, 2);
    try {
      ws.send(frame);
    } catch {
      /* ignore — onclose will reconnect */
    }
  }
}

export function useSabmailCollabDoc(
  draftId: string | null,
  active: boolean,
): UseSabmailCollabResult {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [status, setStatus] = useState<SabmailCollabStatus>('disabled');
  const providerRef = useRef<SabmailWsProvider | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!draftId || !active || !collabEnabled()) {
      setStatus('disabled');
      return;
    }

    const docId = `sabmail-draft:${draftId}`;
    const yDoc = new Y.Doc();
    setDoc(yDoc);
    setStatus('connecting');

    const provider = new SabmailWsProvider(docId, yDoc, setStatus);
    providerRef.current = provider;

    return () => {
      provider.destroy();
      providerRef.current = null;
      yDoc.destroy();
      setDoc(null);
      setStatus('disabled');
    };
  }, [draftId, active]);

  return { doc, status, live: status === 'connected' };
}
