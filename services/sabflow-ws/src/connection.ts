/**
 * SabFlow WS Gateway — Connection lifecycle handler.
 *
 * Track A · Phase 3 · sub-task #4 of 10.
 *
 * Implements the lifecycle described in `docs/adr/sabflow-ws-gateway-node.md`
 * §3 (upgrade → auth → join → 3-step sync → updates → close) and §3.5 (30s
 * ping / 10s pong / 2-miss tolerance).
 *
 * SCOPE: this file ONLY. Every collaborator is a sibling sub-task and is
 * forward-declared here as a typed import — no runtime dependency on the
 * sibling source layout, only on the interface shape this file expects them
 * to expose. The siblings will land in parallel commits.
 *
 * Forward-declared siblings (do NOT add runtime imports of these files):
 *   - ./auth          (sub-task #2)  — JWT / cookie verification
 *   - ./room          (sub-task #5)  — in-memory doc room registry + fan-out
 *   - ./persistence   (sub-task #3)  — doc lookup + workspace ACL
 *   - ./backpressure  (sub-task #6)  — outbound coalesce window
 *   - ./seats         (sub-task #7)  — per-plan seat budget enforcement
 *
 * No external runtime dependencies. The `ws` types are inlined as a minimal
 * structural shape so this file compiles in isolation; sibling #1 (service
 * bootstrap) will install `ws` and wire the real `WebSocketServer` instance
 * into `handleUpgrade`.
 */

import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

// ---------------------------------------------------------------------------
// Forward-declared sibling interfaces. The real modules live in adjacent
// files; we import the *types* via `import type` so this file stays
// independently compilable even before the siblings land.
// ---------------------------------------------------------------------------

import type {
  WsAuthClaims,
  WsAuthFailureReason,
  extractTokenFromUpgrade as _extractTokenFromUpgrade,
  verifyWsToken as _verifyWsToken,
} from './auth.js';

import type {
  RoomRegistry,
  RoomMember,
} from './room.js';

import type {
  PersistenceRepo,
} from './persistence.js';

import type {
  CoalesceHandle,
  coalesce as _coalesce,
} from './backpressure.js';

import type {
  SeatGuard,
} from './seats.js';

// ---------------------------------------------------------------------------
// Minimal `ws` type shape — inlined so this file has no `import` from the
// `ws` package (sibling #1 owns that dependency). Replace at composition
// time with `import type { WebSocket, WebSocketServer } from 'ws'`.
// ---------------------------------------------------------------------------

type WsBufferLike = Buffer | ArrayBufferLike | string;

interface WsLike {
  readonly readyState: number;
  send(data: WsBufferLike, cb?: (err?: Error) => void): void;
  ping(data?: Buffer): void;
  pong(data?: Buffer): void;
  close(code?: number, reason?: string): void;
  terminate(): void;
  on(event: 'message', cb: (data: Buffer, isBinary: boolean) => void): this;
  on(event: 'pong', cb: () => void): this;
  on(event: 'close', cb: (code: number, reason: Buffer) => void): this;
  on(event: 'error', cb: (err: Error) => void): this;
}

interface WsServerLike {
  handleUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    cb: (ws: WsLike, req: IncomingMessage) => void,
  ): void;
}

// ---------------------------------------------------------------------------
// Public API — close codes, options, exposed accessors.
// ---------------------------------------------------------------------------

export const CLOSE = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  AUTH_UNAUTHENTICATED: 4001,
  AUTH_EXPIRED: 4002,
  AUTH_INVALID: 4003,
  AUTH_WORKSPACE_MISMATCH: 4004,
  SEAT_DENIED: 4403,
  INTERNAL: 4500,
} as const;

export type CloseCode = (typeof CLOSE)[keyof typeof CLOSE];

/** Inbound binary-frame tag byte (see ADR §4.1). */
export const FRAME_TAG = {
  SYNC: 0x00,
  AWARENESS: 0x01,
  SERVER_BATCH: 0x7f, // outbound only; rejected inbound
} as const;

const HEARTBEAT_INTERVAL_MS = 30_000;
const PONG_WINDOW_MS = 10_000;
const MAX_MISSED_PONGS = 2;

const COALESCE_WINDOW_MS = 16;

export interface HandleUpgradeOpts {
  wss: WsServerLike;
  auth: {
    extractTokenFromUpgrade: typeof _extractTokenFromUpgrade;
    verifyWsToken: typeof _verifyWsToken;
  };
  persistence: PersistenceRepo;
  rooms: RoomRegistry;
  backpressure: {
    coalesce: typeof _coalesce;
  };
  seats?: SeatGuard;
  /**
   * Optional initial sync-step-1 producer — given a docId, returns the Yjs
   * state vector for that doc. The implementation is owned by the
   * persistence sibling; the connection layer just frames + sends.
   */
  getInitialSyncStep1: (docId: string) => Promise<Uint8Array> | Uint8Array;
  /** Optional id generator (test seam). */
  newConnectionId?: () => string;
}

// ---------------------------------------------------------------------------
// Per-connection state.
// ---------------------------------------------------------------------------

interface ConnectionRecord {
  id: string;
  ws: WsLike;
  userId: string;
  workspaceId: string;
  docId: string;
  pingTimer: NodeJS.Timeout | null;
  pongDeadline: NodeJS.Timeout | null;
  missedPongs: number;
  coalesce: CoalesceHandle;
  closed: boolean;
}

const connections = new Map<string, ConnectionRecord>();

// ---------------------------------------------------------------------------
// Helpers — raw HTTP refusal, framing, close.
// ---------------------------------------------------------------------------

function abortUpgrade(socket: Duplex, status: number, body: string): void {
  const reason =
    status === 401 ? 'Unauthorized' :
    status === 403 ? 'Forbidden' :
    status === 404 ? 'Not Found' :
    status === 400 ? 'Bad Request' :
    'Error';
  const payload = body.length > 0 ? body : reason;
  try {
    socket.write(
      `HTTP/1.1 ${status} ${reason}\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n` +
      `Content-Length: ${Buffer.byteLength(payload)}\r\n` +
      `Connection: close\r\n` +
      `\r\n` +
      payload,
    );
  } catch {
    /* socket may already be torn down */
  }
  try { socket.destroy(); } catch { /* noop */ }
}

function parseDocIdFromUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  // IncomingMessage.url is path+query only; supply a dummy origin for URL().
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, 'http://sabflow.invalid');
  } catch {
    return null;
  }
  const doc = parsed.searchParams.get('doc');
  if (!doc) return null;
  // Conservative shape check; full uuid validation is sibling #3's job.
  if (doc.length < 1 || doc.length > 128) return null;
  if (!/^[A-Za-z0-9._\-:]+$/.test(doc)) return null;
  return doc;
}

function authFailureToCloseCode(reason: WsAuthFailureReason): CloseCode {
  switch (reason) {
    case 'missing':       return CLOSE.AUTH_UNAUTHENTICATED;
    case 'expired':       return CLOSE.AUTH_EXPIRED;
    case 'invalid':       return CLOSE.AUTH_INVALID;
    case 'wrong-audience':return CLOSE.AUTH_INVALID;
    default:              return CLOSE.AUTH_INVALID;
  }
}

function frameSyncStep1(stateVector: Uint8Array): Buffer {
  // [tag=0x00][yjs sync-step-1 payload]
  const out = Buffer.allocUnsafe(1 + stateVector.byteLength);
  out[0] = FRAME_TAG.SYNC;
  out.set(stateVector, 1);
  return out;
}

function newId(): string {
  // RFC4122-ish; no `crypto` import to keep deps zero — caller can override.
  let s = '';
  for (let i = 0; i < 16; i++) {
    s += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }
  return s;
}

// ---------------------------------------------------------------------------
// Heartbeat — 30s ping, 10s pong window, 2 misses = close 1001.
// ---------------------------------------------------------------------------

function armHeartbeat(rec: ConnectionRecord): void {
  const schedulePing = () => {
    if (rec.closed) return;
    rec.pingTimer = setTimeout(() => {
      if (rec.closed) return;
      try {
        rec.ws.ping();
      } catch {
        return closeConnection(rec, CLOSE.GOING_AWAY, 'ping-failed');
      }
      rec.pongDeadline = setTimeout(() => {
        if (rec.closed) return;
        rec.missedPongs += 1;
        if (rec.missedPongs >= MAX_MISSED_PONGS) {
          closeConnection(rec, CLOSE.GOING_AWAY, 'pong-timeout');
          return;
        }
        // Missed but under tolerance — schedule next ping immediately.
        schedulePing();
      }, PONG_WINDOW_MS);
    }, HEARTBEAT_INTERVAL_MS);
  };

  rec.ws.on('pong', () => {
    if (rec.pongDeadline) {
      clearTimeout(rec.pongDeadline);
      rec.pongDeadline = null;
    }
    rec.missedPongs = 0;
    schedulePing();
  });

  schedulePing();
}

function clearHeartbeat(rec: ConnectionRecord): void {
  if (rec.pingTimer) { clearTimeout(rec.pingTimer); rec.pingTimer = null; }
  if (rec.pongDeadline) { clearTimeout(rec.pongDeadline); rec.pongDeadline = null; }
}

// ---------------------------------------------------------------------------
// Close path — idempotent, removes from registry, unbinds room.
// ---------------------------------------------------------------------------

function closeConnection(
  rec: ConnectionRecord,
  code: CloseCode,
  reason: string,
  rooms?: RoomRegistry,
): void {
  if (rec.closed) return;
  rec.closed = true;
  clearHeartbeat(rec);
  try { rec.coalesce.flush(); } catch { /* noop */ }
  try { rec.coalesce.dispose(); } catch { /* noop */ }
  if (rooms) {
    try { rooms.leave(rec.docId, rec.id); } catch { /* noop */ }
  }
  connections.delete(rec.id);
  try {
    rec.ws.close(code, reason);
  } catch {
    try { rec.ws.terminate(); } catch { /* noop */ }
  }
}

// ---------------------------------------------------------------------------
// Inbound frame demux — tag byte routes to room sibling.
// ---------------------------------------------------------------------------

function bindInbound(rec: ConnectionRecord, rooms: RoomRegistry): void {
  rec.ws.on('message', (data: Buffer, isBinary: boolean) => {
    if (rec.closed) return;
    if (!isBinary) {
      // Text frames are JSON control plane; out of scope for this sub-task.
      // Sibling #8 (control-plane parser) owns it. We forward verbatim.
      try { rooms.onControlMessage(rec.docId, rec.id, data.toString('utf8')); }
      catch { /* noop — control parser handles its own errors */ }
      return;
    }
    if (data.length < 1) return;
    const tag = data[0];
    const payload = data.subarray(1);
    switch (tag) {
      case FRAME_TAG.SYNC:
        try { rooms.onSyncFrame(rec.docId, rec.id, payload); }
        catch { closeConnection(rec, CLOSE.INTERNAL, 'sync-dispatch-failed', rooms); }
        return;
      case FRAME_TAG.AWARENESS:
        try { rooms.onAwarenessFrame(rec.docId, rec.id, payload); }
        catch { closeConnection(rec, CLOSE.INTERNAL, 'awareness-dispatch-failed', rooms); }
        return;
      case FRAME_TAG.SERVER_BATCH:
        // Server-only tag; clients MUST NOT send it.
        closeConnection(rec, CLOSE.INTERNAL, 'client-sent-server-batch', rooms);
        return;
      default:
        // Unknown tag — drop silently per ADR §4 (forward-compat).
        return;
    }
  });

  rec.ws.on('close', (code: number) => {
    if (rec.closed) return;
    rec.closed = true;
    clearHeartbeat(rec);
    try { rec.coalesce.dispose(); } catch { /* noop */ }
    try { rooms.leave(rec.docId, rec.id); } catch { /* noop */ }
    connections.delete(rec.id);
    void code;
  });

  rec.ws.on('error', () => {
    closeConnection(rec, CLOSE.INTERNAL, 'ws-error', rooms);
  });
}

// ---------------------------------------------------------------------------
// Public entry — bound to `wss.on('upgrade', ...)`.
// ---------------------------------------------------------------------------

export async function handleUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  opts: HandleUpgradeOpts,
): Promise<void> {
  // 1) Token extraction — synchronous structural parse.
  const tokenResult = opts.auth.extractTokenFromUpgrade(req);
  if (!tokenResult.ok) {
    return abortUpgrade(socket, 401, 'unauthenticated');
  }

  // 2) Token verification — async (may call out to a JWKS or DB).
  let claims: WsAuthClaims;
  try {
    const verified = await opts.auth.verifyWsToken(tokenResult.token);
    if (!verified.ok) {
      // Pre-101 path: respond with raw HTTP 401 (close codes are for after-101).
      void authFailureToCloseCode(verified.reason);
      return abortUpgrade(socket, 401, `auth:${verified.reason}`);
    }
    claims = verified.claims;
  } catch {
    return abortUpgrade(socket, 500, 'auth-internal');
  }

  // 3) docId query param — required.
  const docId = parseDocIdFromUrl(req.url);
  if (!docId) {
    return abortUpgrade(socket, 400, 'missing-doc');
  }

  // 4) Workspace ACL — claims.ws must match the doc's workspace.
  try {
    const allowed = await opts.persistence.canAccess({
      docId,
      workspaceId: claims.ws,
      userId: claims.sub,
    });
    if (!allowed) {
      return abortUpgrade(socket, 403, 'workspace-mismatch');
    }
  } catch {
    return abortUpgrade(socket, 500, 'acl-internal');
  }

  // 5) Optional seat check (forward-decl sibling #7).
  if (opts.seats) {
    try {
      const seat = await opts.seats.tryAcquire({
        docId,
        workspaceId: claims.ws,
        userId: claims.sub,
      });
      if (!seat.ok) {
        return abortUpgrade(socket, 403, 'seat-denied');
      }
    } catch {
      return abortUpgrade(socket, 500, 'seat-internal');
    }
  }

  // 6) Complete the upgrade — `ws` library writes the 101 for us.
  opts.wss.handleUpgrade(req, socket, head, (ws) => {
    void registerSocket(ws, claims, docId, opts);
  });
}

async function registerSocket(
  ws: WsLike,
  claims: WsAuthClaims,
  docId: string,
  opts: HandleUpgradeOpts,
): Promise<void> {
  const id = (opts.newConnectionId ?? newId)();

  // Outbound channel — owned by the coalesce sibling.
  const coalesce = opts.backpressure.coalesce({
    windowMs: COALESCE_WINDOW_MS,
    send: (chunk: Buffer | Uint8Array) => {
      try {
        ws.send(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
      } catch {
        /* close path will fire via 'error' */
      }
    },
  });

  const member: RoomMember = {
    connectionId: id,
    userId: claims.sub,
    workspaceId: claims.ws,
    send: (payload: Uint8Array) => coalesce.push(payload),
    sendText: (text: string) => {
      try { ws.send(text); } catch { /* noop */ }
    },
    close: (code, reason) => {
      const rec = connections.get(id);
      if (rec) closeConnection(rec, (code ?? CLOSE.NORMAL) as CloseCode, reason ?? 'room-close', opts.rooms);
    },
  };

  const rec: ConnectionRecord = {
    id,
    ws,
    userId: claims.sub,
    workspaceId: claims.ws,
    docId,
    pingTimer: null,
    pongDeadline: null,
    missedPongs: 0,
    coalesce,
    closed: false,
  };
  connections.set(id, rec);

  // 7) Join the room.
  try {
    await opts.rooms.join(docId, member);
  } catch {
    closeConnection(rec, CLOSE.INTERNAL, 'room-join-failed', opts.rooms);
    return;
  }

  // 8) Wire inbound + heartbeat BEFORE the initial sync frame so a fast
  //    client reply can never race the listeners.
  bindInbound(rec, opts.rooms);
  armHeartbeat(rec);

  // 9) Send initial sync-step-1 (binary, tag 0x00).
  try {
    const sv = await opts.getInitialSyncStep1(docId);
    const frame = frameSyncStep1(sv);
    // Bypass coalesce for the very first frame — clients block on it.
    ws.send(frame);
  } catch {
    closeConnection(rec, CLOSE.INTERNAL, 'sync-step1-failed', opts.rooms);
  }
}

// ---------------------------------------------------------------------------
// Metrics surface (sibling #9 — observability — reads these).
// ---------------------------------------------------------------------------

export function connectionCount(): number {
  return connections.size;
}

export function forEachConnection(
  fn: (info: {
    id: string;
    userId: string;
    workspaceId: string;
    docId: string;
    missedPongs: number;
  }) => void,
): void {
  for (const rec of connections.values()) {
    if (rec.closed) continue;
    fn({
      id: rec.id,
      userId: rec.userId,
      workspaceId: rec.workspaceId,
      docId: rec.docId,
      missedPongs: rec.missedPongs,
    });
  }
}

// ---------------------------------------------------------------------------
// Test-only export — lets the sub-task #10 unit test reach into the registry
// without exposing the Map shape itself.
// ---------------------------------------------------------------------------

export const __testing = {
  CLOSE,
  FRAME_TAG,
  HEARTBEAT_INTERVAL_MS,
  PONG_WINDOW_MS,
  MAX_MISSED_PONGS,
  COALESCE_WINDOW_MS,
  parseDocIdFromUrl,
  frameSyncStep1,
  authFailureToCloseCode,
  /** DANGER: resets the in-memory registry. Tests only. */
  reset(): void { connections.clear(); },
};
