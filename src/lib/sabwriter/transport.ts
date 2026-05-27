/**
 * SabWriter realtime transport interface.
 *
 * The collaborative-editing surface in SabWriter is built against this
 * `IWriterTransport` interface so the real OT/CRDT implementation
 * (Y.js / Hocuspocus / Loro) can be swapped in without touching the
 * editor UI.
 *
 * For the initial ship we provide `MockTransport` — a polling
 * implementation that re-fetches the document body + presence list on
 * a fixed interval and replays "operations" locally. It is intentionally
 * naive: no conflict resolution, no CRDT merging. Concurrent edits will
 * last-write-wins.
 *
 * Real-time deferred: replace `MockTransport` with a Y.js + Hocuspocus
 * wire transport once the websocket sidecar is provisioned. The
 * interface below is the public contract.
 */

import type { PresenceCursor, SabwriterPresenceDoc } from '@/lib/rust-client/sabwriter-presence';

/** Opaque editor operation — TipTap step JSON for the real impl. */
export type WriterOperation = Record<string, unknown>;

export type OperationHandler = (op: WriterOperation, fromUserId?: string) => void;
export type PresenceHandler = (presence: SabwriterPresenceDoc[]) => void;
export type ConnectionStateHandler = (state: 'connecting' | 'open' | 'closed' | 'error') => void;

export interface ConnectOptions {
  /** Pre-warm with this content if no remote state has been loaded yet. */
  initialContentJson?: Record<string, unknown>;
  /** Hex color used for the local cursor. */
  color?: string;
  /** Display name rendered next to the local cursor. */
  displayName?: string;
}

/**
 * Transport contract for a single open document. A new instance is
 * created when the editor mounts a doc and torn down on unmount.
 */
export interface IWriterTransport {
  /** Open the connection for `docId` and start receiving updates. */
  connect(docId: string, opts?: ConnectOptions): Promise<void>;
  /** Stop streaming and release server-side presence. */
  disconnect(): Promise<void>;
  /** Send a local operation upstream. */
  sendOperation(op: WriterOperation): Promise<void>;
  /** Subscribe to remote operations (from other collaborators). */
  subscribeOperations(handler: OperationHandler): () => void;
  /** Push the local cursor position. `head === anchor` for a caret. */
  setCursor(anchor: number, head: number): Promise<void>;
  /** Subscribe to the rolling presence list. */
  subscribePresence(handler: PresenceHandler): () => void;
  /** Connection lifecycle notifications. */
  onConnectionState?(handler: ConnectionStateHandler): () => void;
}

/* ────────────────────────────────────────────────────────────────── */
/* MockTransport — polling fallback                                    */
/* ────────────────────────────────────────────────────────────────── */

/**
 * Polling implementation of `IWriterTransport`. Suitable for shipping
 * the editor UI before the real OT/CRDT wire is in place.
 *
 * Strategy:
 *   - On `connect()`, kick off a presence heartbeat every 15s.
 *   - Poll the presence list every 5s and fan out via subscribers.
 *   - Local operations are *not* fanned out remotely — `sendOperation`
 *     is a no-op other than echoing back locally so the editor's
 *     own optimistic UI still works.
 *
 * Real-time deferred: swap this for `YjsHocuspocusTransport` once the
 * websocket service is up.
 */
export class MockTransport implements IWriterTransport {
  private docId: string | null = null;
  private opHandlers = new Set<OperationHandler>();
  private presenceHandlers = new Set<PresenceHandler>();
  private connectionHandlers = new Set<ConnectionStateHandler>();
  private color = '#7C5CFF';
  private displayName: string | undefined;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastCursor: PresenceCursor | undefined;

  async connect(docId: string, opts: ConnectOptions = {}): Promise<void> {
    this.docId = docId;
    this.color = opts.color ?? this.color;
    this.displayName = opts.displayName;
    this.emitConnection('connecting');

    // Initial heartbeat + poll. The real network calls go through the
    // server actions (heartbeatPresence / listPresence) — this module is
    // client-side, so we use fetch() against the route handlers. The
    // wiring TODO below covers exposing those endpoints.
    try {
      await this.heartbeat();
      this.emitConnection('open');
    } catch {
      this.emitConnection('error');
    }

    this.heartbeatTimer = setInterval(() => {
      this.heartbeat().catch(() => this.emitConnection('error'));
    }, 15_000);
    this.pollTimer = setInterval(() => {
      this.pollPresence().catch(() => {
        /* swallow */
      });
    }, 5_000);
  }

  async disconnect(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.heartbeatTimer = null;
    this.pollTimer = null;
    // Fire-and-forget leave.
    if (this.docId) {
      try {
        await fetch(
          `/api/sabwriter/presence/leave?documentId=${encodeURIComponent(this.docId)}`,
          { method: 'DELETE' },
        );
      } catch {
        /* swallow */
      }
    }
    this.docId = null;
    this.emitConnection('closed');
  }

  async sendOperation(op: WriterOperation): Promise<void> {
    // Mock impl: just echo locally so the UI's optimistic update stays
    // consistent. The real transport would broadcast this to peers.
    for (const h of this.opHandlers) h(op);
  }

  subscribeOperations(handler: OperationHandler): () => void {
    this.opHandlers.add(handler);
    return () => this.opHandlers.delete(handler);
  }

  async setCursor(anchor: number, head: number): Promise<void> {
    this.lastCursor = { anchor, head };
    await this.heartbeat();
  }

  subscribePresence(handler: PresenceHandler): () => void {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }

  onConnectionState(handler: ConnectionStateHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  private emitConnection(state: Parameters<ConnectionStateHandler>[0]): void {
    for (const h of this.connectionHandlers) h(state);
  }

  private async heartbeat(): Promise<void> {
    if (!this.docId) return;
    // TODO(wiring): wire `/api/sabwriter/presence/heartbeat` route
    // handler that proxies to `heartbeatSabwriterPresence` server action.
    await fetch('/api/sabwriter/presence/heartbeat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        documentId: this.docId,
        cursor: this.lastCursor,
        color: this.color,
        displayName: this.displayName,
      }),
    });
  }

  private async pollPresence(): Promise<void> {
    if (!this.docId) return;
    try {
      const res = await fetch(
        `/api/sabwriter/presence?documentId=${encodeURIComponent(this.docId)}`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as { items?: SabwriterPresenceDoc[] };
      const items = json.items ?? [];
      for (const h of this.presenceHandlers) h(items);
    } catch {
      /* swallow */
    }
  }
}

/**
 * Default transport singleton factory. UI code calls
 * `getDefaultTransport()` instead of constructing directly so the impl
 * can be swapped centrally.
 */
export function getDefaultTransport(): IWriterTransport {
  return new MockTransport();
}
