/**
 * useSabFlowDoc — React hook owning the Yjs document for a single SabFlow doc.
 *
 * Opens a WebSocket to `services/sabflow-ws`, performs an initial state-vector
 * sync, applies remote updates to a local `Y.Doc`, broadcasts local updates,
 * and exposes the live doc + connection status.
 *
 * Wire format (matches docs/adr/sabflow-foundation.md + sabflow-ws-gateway-node.md):
 *   - Binary frames, first byte is a tag.
 *   - 0x00 SYNC     — payload is a Yjs sync message:
 *                       first byte sub-tag:
 *                         0x00 STEP1 — payload = remote state vector
 *                         0x01 STEP2 — payload = update for our missing ops
 *                         0x02 UPDATE — payload = update broadcast
 *   - JWT carried via WS subprotocol entry `sabflow.jwt.<token>` per
 *     docs/adr/sabflow-auth.md (short-lived, fetched via `fetchToken`).
 *
 * Reconnect: exponential backoff 1s → 30s, ±20% jitter, 12-attempt cap, then
 * the hook surfaces status='error' and stops trying (per sabflow-ws-gateway-node §3.5).
 *
 * SSR-safe: skips all network/doc construction when `typeof window === 'undefined'`.
 *
 * NEEDED dep on root package.json: `yjs`.  No `y-websocket` dep — the WS provider
 * is rolled inline below to keep the bundle lean and the wire format owned by us.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type SabFlowDocStatus =
  | 'connecting'
  | 'syncing'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'closed';

export interface UseSabFlowDocOptions {
  workspaceId: string;
  docId: string;
  /** Returns a short-lived JWT for the WS subprotocol handshake. */
  fetchToken: () => Promise<string>;
  /**
   * Override the gateway URL (defaults to `NEXT_PUBLIC_SABFLOW_WS_URL` or
   * `wss://<host>/sabflow/ws`).  Mainly useful for tests.
   */
  wsUrl?: string;
}

export interface UseSabFlowDocResult {
  doc: Y.Doc | null;
  status: SabFlowDocStatus;
  error?: Error;
  reconnectAttempts: number;
}

/**
 * Forward-decl swap-point — if we ever move off Yjs (Automerge, Loro, etc.),
 * we'd implement this against the new lib and route the provider through it.
 * For now the implementation calls `Y.*` directly per the Yjs ADR default.
 */
export interface YjsAdapter {
  createDoc(): Y.Doc;
  encodeStateAsUpdate(doc: Y.Doc): Uint8Array;
  encodeStateVector(doc: Y.Doc): Uint8Array;
  encodeStateAsUpdateSince(doc: Y.Doc, sv: Uint8Array): Uint8Array;
  applyUpdate(doc: Y.Doc, update: Uint8Array, origin: unknown): void;
}

// ---------------------------------------------------------------------------
// Wire format constants
// ---------------------------------------------------------------------------

const TAG_SYNC = 0x00;
const SYNC_STEP1 = 0x00;
const SYNC_STEP2 = 0x01;
const SYNC_UPDATE = 0x02;

const PROVIDER_ORIGIN = Symbol('sabflow-ws');

// Backoff per docs/adr/sabflow-ws-gateway-node.md §3.5.
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const BACKOFF_JITTER = 0.2;
const RECONNECT_CAP = 12;

function backoffFor(attempt: number): number {
  const base = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** attempt);
  const jitter = base * BACKOFF_JITTER * (Math.random() * 2 - 1);
  return Math.max(BACKOFF_MIN_MS, Math.round(base + jitter));
}

function defaultWsUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SABFLOW_WS_URL;
  if (fromEnv) return fromEnv;
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/sabflow/ws`;
}

// ---------------------------------------------------------------------------
// WsProvider — minimal binary-framed provider against services/sabflow-ws
// ---------------------------------------------------------------------------

interface WsProviderEvents {
  onStatus(status: SabFlowDocStatus): void;
  onError(err: Error): void;
  onAttempts(n: number): void;
}

class WsProvider {
  private ws: WebSocket | null = null;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private synced = false;
  private boundUpdate: (update: Uint8Array, origin: unknown) => void;

  constructor(
    private readonly url: string,
    private readonly doc: Y.Doc,
    private readonly fetchToken: () => Promise<string>,
    private readonly events: WsProviderEvents,
  ) {
    this.boundUpdate = (update, origin) => {
      if (origin === PROVIDER_ORIGIN) return; // came from the server
      this.sendSyncFrame(SYNC_UPDATE, update);
    };
    this.doc.on('update', this.boundUpdate);
    void this.connect();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.doc.off('update', this.boundUpdate);
    if (this.ws) {
      try {
        this.ws.close(1000, 'client-unmount');
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.events.onStatus('closed');
  }

  private async connect(): Promise<void> {
    if (this.destroyed) return;
    this.events.onStatus(this.attempts === 0 ? 'connecting' : 'reconnecting');
    let token: string;
    try {
      token = await this.fetchToken();
    } catch (err) {
      this.handleFailure(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    if (this.destroyed) return;

    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url, [`sabflow.jwt.${token}`]);
    } catch (err) {
      this.handleFailure(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      if (this.destroyed) return;
      this.events.onStatus('syncing');
      // SYNC STEP1: send our state vector so the server can ship missing ops.
      const sv = Y.encodeStateVector(this.doc);
      this.sendSyncFrame(SYNC_STEP1, sv);
    };

    ws.onmessage = (ev) => {
      if (!(ev.data instanceof ArrayBuffer)) return;
      const buf = new Uint8Array(ev.data);
      if (buf.length < 2) return;
      const tag = buf[0];
      if (tag !== TAG_SYNC) return; // ignore unknown tags for forward-compat
      const sub = buf[1];
      const payload = buf.subarray(2);

      if (sub === SYNC_STEP1) {
        // Server asked for what it's missing — reply with STEP2.
        const update = Y.encodeStateAsUpdate(this.doc, payload);
        this.sendSyncFrame(SYNC_STEP2, update);
      } else if (sub === SYNC_STEP2 || sub === SYNC_UPDATE) {
        try {
          Y.applyUpdate(this.doc, payload, PROVIDER_ORIGIN);
        } catch (err) {
          this.events.onError(
            err instanceof Error ? err : new Error(String(err)),
          );
          return;
        }
        if (!this.synced && sub === SYNC_STEP2) {
          this.synced = true;
          this.attempts = 0;
          this.events.onAttempts(0);
          this.events.onStatus('connected');
        }
      }
    };

    ws.onerror = () => {
      // Browsers don't expose useful detail — surface a generic error and let
      // onclose drive the reconnect cycle.
      this.events.onError(new Error('sabflow-ws: socket error'));
    };

    ws.onclose = () => {
      if (this.destroyed) return;
      this.ws = null;
      this.synced = false;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.attempts >= RECONNECT_CAP) {
      this.events.onStatus('error');
      this.events.onError(
        new Error(`sabflow-ws: gave up after ${RECONNECT_CAP} attempts`),
      );
      return;
    }
    const delay = backoffFor(this.attempts);
    this.attempts += 1;
    this.events.onAttempts(this.attempts);
    this.events.onStatus('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private handleFailure(err: Error): void {
    this.events.onError(err);
    this.scheduleReconnect();
  }

  private sendSyncFrame(sub: number, payload: Uint8Array): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const frame = new Uint8Array(2 + payload.length);
    frame[0] = TAG_SYNC;
    frame[1] = sub;
    frame.set(payload, 2);
    try {
      ws.send(frame);
    } catch (err) {
      this.events.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSabFlowDoc(
  options: UseSabFlowDocOptions,
): UseSabFlowDocResult {
  const { workspaceId, docId, fetchToken, wsUrl } = options;

  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [status, setStatus] = useState<SabFlowDocStatus>('connecting');
  const [error, setError] = useState<Error | undefined>(undefined);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Keep the latest fetchToken in a ref so changing identity doesn't tear down
  // the socket — only workspaceId/docId/wsUrl rebuild the connection.
  const fetchTokenRef = useRef(fetchToken);
  useEffect(() => {
    fetchTokenRef.current = fetchToken;
  }, [fetchToken]);

  useEffect(() => {
    if (typeof window === 'undefined') return; // SSR-safe

    const yDoc = new Y.Doc();
    setDoc(yDoc);
    setStatus('connecting');
    setError(undefined);
    setReconnectAttempts(0);

    const base = wsUrl ?? defaultWsUrl();
    const sep = base.includes('?') ? '&' : '?';
    const url = `${base}${sep}workspaceId=${encodeURIComponent(
      workspaceId,
    )}&docId=${encodeURIComponent(docId)}`;

    const provider = new WsProvider(
      url,
      yDoc,
      () => fetchTokenRef.current(),
      {
        onStatus: setStatus,
        onError: setError,
        onAttempts: setReconnectAttempts,
      },
    );

    return () => {
      provider.destroy();
      yDoc.destroy();
      setDoc(null);
    };
  }, [workspaceId, docId, wsUrl]);

  return { doc, status, error, reconnectAttempts };
}
