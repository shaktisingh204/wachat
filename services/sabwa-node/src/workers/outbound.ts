/**
 * Outbound dispatcher — drains `sabwa:<sessionId>:outbound` and actually sends.
 *
 * Producers push JSON ops onto this Redis list:
 *
 *   { op: 'broadcast_send', broadcastId, jobId, jid, payload, source } — routes/broadcasts.ts
 *   { op: 'bulk_send',      campaignId, jid, payload, source }         — workers/bulk-sender.ts
 *   { op: 'contact_block',  jid }                                       — routes/contacts.ts
 *   { op: 'contact_unblock',jid }                                       — routes/contacts.ts
 *
 * Before this worker existed, nothing read those keys and broadcasts /
 * bulk campaigns "queued" successfully but never delivered.
 *
 * Strategy: every `TICK_INTERVAL_MS` we iterate every live session in the
 * pool, drain up to `MAX_PER_SESSION_PER_TICK` ops, and dispatch each via
 * the same `BaileysSession.sendMessage` helper the scheduler worker uses.
 * Failures are logged and (for broadcasts) reflected as `failedCount` on
 * the broadcast doc; we do NOT requeue, since the producer always has a
 * row-level record we can retry from.
 */

import type { Db } from 'mongodb';
import type { AppState } from '../state.js';
import * as broadcasts from '../db/broadcasts.js';

/** How often we sweep every session's outbound queue. */
const TICK_INTERVAL_MS = 250;

/** Cap per-session per-tick so a giant broadcast doesn't starve other sessions. */
const MAX_PER_SESSION_PER_TICK = 25;

/** Per-jid spacing inside a single broadcast/bulk burst (anti-ban). */
const PER_SEND_JITTER_MS = 80;

interface OutboundOp {
  op?: string;
  jid?: string;
  payload?: unknown;
  broadcastId?: string;
  jobId?: string;
  campaignId?: string;
  source?: string;
}

/**
 * Resolve the live Baileys session for a session id.
 * Returns null when the session isn't paired/connected — caller should
 * skip the op (it'll get re-dispatched by the producer if needed).
 */
function getLiveSession(state: AppState, sessionId: string): {
  status: string;
  sendMessage: (jid: string, content: unknown) => Promise<unknown>;
  sock?: { updateBlockStatus?: (jid: string, action: 'block' | 'unblock') => Promise<void> };
} | null {
  const live = state.pool.get(sessionId) as
    | {
        status?: string;
        sendMessage?: (jid: string, content: unknown) => Promise<unknown>;
        sock?: {
          updateBlockStatus?: (
            jid: string,
            action: 'block' | 'unblock',
          ) => Promise<void>;
        };
      }
    | undefined;
  if (!live || typeof live.sendMessage !== 'function') return null;
  if (live.status && live.status !== 'connected') return null;
  return {
    status: live.status ?? 'connected',
    sendMessage: live.sendMessage.bind(live),
    sock: live.sock,
  };
}

/**
 * Translate a stored `payload` into a Baileys `sendMessage` content
 * object. Mirrors `workers/scheduler.ts::buildBaileysContent` so the
 * supported types stay consistent across schedule + broadcast + bulk.
 */
function buildBaileysContent(payload: unknown): Record<string, unknown> {
  const p = (payload ?? {}) as Record<string, unknown>;
  const type = typeof p.type === 'string' ? p.type : 'text';

  const optString = (v: unknown): string | undefined =>
    typeof v === 'string' ? v : undefined;
  const mediaSource = (): { url: string } | Buffer => {
    if (typeof p.url === 'string') return { url: p.url };
    if (typeof p.data === 'string') return Buffer.from(p.data, 'base64');
    return Buffer.alloc(0);
  };

  switch (type) {
    case 'image':
      return { image: mediaSource(), caption: optString(p.caption), mimetype: optString(p.mimetype) };
    case 'video':
      return { video: mediaSource(), caption: optString(p.caption), mimetype: optString(p.mimetype) };
    case 'audio':
      return { audio: mediaSource(), mimetype: optString(p.mimetype) ?? 'audio/mp4', ptt: false };
    case 'voice':
      return { audio: mediaSource(), mimetype: optString(p.mimetype) ?? 'audio/ogg; codecs=opus', ptt: true };
    case 'document':
      return {
        document: mediaSource(),
        mimetype: optString(p.mimetype),
        fileName: optString(p.fileName) ?? 'file',
        caption: optString(p.caption),
      };
    case 'text':
    default: {
      const body =
        (typeof p.body === 'string' && p.body) ||
        (typeof p.text === 'string' && p.text) ||
        '';
      return { text: body };
    }
  }
}

/**
 * Bump a broadcast's progress counters and flip its status to `completed`
 * once every recipient has been accounted for.
 */
async function recordBroadcastProgress(
  db: Db,
  broadcastId: string,
  sent: number,
  failed: number,
): Promise<void> {
  await broadcasts.markSent(db, broadcastId, sent, failed);
  // Re-read to see if we're done. Cheap — single _id lookup.
  const doc = await broadcasts.findById(db, broadcastId);
  if (!doc) return;
  const processed = (doc.sentCount ?? 0) + (doc.failedCount ?? 0);
  if (processed >= (doc.totalCount ?? doc.recipients.length)) {
    const next = (doc.sentCount ?? 0) > 0 ? 'completed' : 'failed';
    await broadcasts.setStatus(db, broadcastId, next);
  } else if (doc.status === 'queued') {
    await broadcasts.setStatus(db, broadcastId, 'running');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Dispatch a single op from the outbound queue. Returns whether the op
 * was "consumed cleanly" — true on success OR on permanent failure (so
 * the producer can re-emit if it wants), false on transient failure
 * (e.g. session disconnected mid-tick) where the op is dropped.
 */
async function dispatchOp(
  state: AppState,
  sessionId: string,
  raw: string,
): Promise<void> {
  let op: OutboundOp;
  try {
    op = JSON.parse(raw) as OutboundOp;
  } catch {
    state.log.warn({ sessionId, raw: raw.slice(0, 120) }, 'outbound: malformed op (json parse failed)');
    return;
  }

  const session = getLiveSession(state, sessionId);
  if (!session) {
    state.log.warn(
      { sessionId, opKind: op.op, jid: op.jid },
      'outbound: dropping op — session not in pool / not connected',
    );
    if (op.op === 'broadcast_send' && op.broadcastId) {
      await recordBroadcastProgress(state.db, op.broadcastId, 0, 1).catch(() => {});
    }
    return;
  }

  switch (op.op) {
    case 'broadcast_send': {
      if (!op.jid || !op.broadcastId) return;
      try {
        await session.sendMessage(op.jid, buildBaileysContent(op.payload));
        await recordBroadcastProgress(state.db, op.broadcastId, 1, 0);
      } catch (err) {
        state.log.warn(
          { err, sessionId, broadcastId: op.broadcastId, jid: op.jid },
          'outbound: broadcast send failed',
        );
        await recordBroadcastProgress(state.db, op.broadcastId, 0, 1).catch(() => {});
      }
      return;
    }
    case 'bulk_send': {
      if (!op.jid) return;
      try {
        await session.sendMessage(op.jid, buildBaileysContent(op.payload));
      } catch (err) {
        state.log.warn(
          { err, sessionId, campaignId: op.campaignId, jid: op.jid },
          'outbound: bulk send failed',
        );
        // bulk-sender already marks recipient.status='sent' optimistically
        // before pushing to outbound; nothing to roll back here without a
        // schema change. Failures show up in the worker log for now.
      }
      return;
    }
    case 'contact_block':
    case 'contact_unblock': {
      const action = op.op === 'contact_block' ? 'block' : 'unblock';
      const updater = session.sock?.updateBlockStatus;
      if (!op.jid || typeof updater !== 'function') return;
      try {
        await updater.call(session.sock, op.jid, action);
      } catch (err) {
        state.log.warn({ err, sessionId, jid: op.jid, action }, 'outbound: block status failed');
      }
      return;
    }
    default:
      state.log.warn({ sessionId, opKind: op.op }, 'outbound: unknown op kind — dropping');
  }
}

/** Drain up to `MAX_PER_SESSION_PER_TICK` ops for `sessionId`. */
async function drainSession(state: AppState, sessionId: string): Promise<number> {
  const key = `sabwa:${sessionId}:outbound`;
  let processed = 0;

  for (let i = 0; i < MAX_PER_SESSION_PER_TICK; i++) {
    let raw: string | null;
    try {
      raw = (await state.redis.client.lPop(key)) as string | null;
    } catch (err) {
      state.log.warn({ err, sessionId }, 'outbound: redis lPop failed');
      return processed;
    }
    if (!raw) break;
    await dispatchOp(state, sessionId, raw);
    processed += 1;
    if (PER_SEND_JITTER_MS > 0) await sleep(PER_SEND_JITTER_MS);
  }
  return processed;
}

/**
 * Start the outbound dispatcher. Returns a `stop()` function callers
 * should await during graceful shutdown so the in-flight tick can finish.
 */
export function startOutboundDispatcher(state: AppState): () => Promise<void> {
  let stopped = false;
  let inflight: Promise<void> = Promise.resolve();

  const loop = async (): Promise<void> => {
    state.log.info({ intervalMs: TICK_INTERVAL_MS }, 'outbound: starting tick loop');
    while (!stopped) {
      const started = Date.now();
      try {
        const entries = state.pool.entries();
        for (const [sessionId] of entries) {
          if (stopped) break;
          await drainSession(state, sessionId);
        }
      } catch (err) {
        state.log.error({ err }, 'outbound: tick failed');
      }
      const elapsed = Date.now() - started;
      const delay = Math.max(0, TICK_INTERVAL_MS - elapsed);
      await sleep(delay);
    }
    state.log.info('outbound: tick loop stopped');
  };

  inflight = loop();

  return async (): Promise<void> => {
    stopped = true;
    await inflight;
  };
}
