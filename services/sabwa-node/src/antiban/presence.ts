/**
 * Presence / connection-health guard.
 *
 * SABWA_PLAN.md §9.5: if Baileys reports a `stream:error` or
 * `connection.update.lastDisconnect`, we must auto-pause any running
 * campaigns on that session — sending into a broken socket is the
 * fastest way to escalate the disconnect into a hard ban.
 *
 * This module is the *state holder* and *event sink* for those signals.
 * Per-session health lives in Redis (so multiple workers see the same
 * paused-campaigns flag), and is mirrored into in-process state for
 * cheap per-send reads.
 *
 * ## Redis key layout
 *
 *   sabwa:presence:{sessionId}         HASH
 *     paused        '1' if campaigns auto-paused
 *     reason        last reason string (free-form, surfaced in UI)
 *     lastSignalMs  epoch-ms of the most recent ban-signal event
 *
 * The sessions agent wires Baileys events into `reportStreamError(...)`
 * and `reportDisconnect(...)`. The bulk worker / message route checks
 * `isPaused(...)` before consuming rate-limit budget.
 */

import type { RedisHandles } from '../db/redis.js';

/** Reason codes for an auto-pause, persisted on `sabwa:presence:{id}.reason`. */
export type PresencePauseReason =
  | 'stream_error'
  | 'connection_lost'
  | 'logged_out'
  | 'manual';

/** Snapshot returned by `getStatus(...)`. */
export interface PresenceStatus {
  paused: boolean;
  reason: PresencePauseReason | null;
  lastSignalAt: Date | null;
}

const KEY = (sessionId: string): string => `sabwa:presence:${sessionId}`;
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7d — long enough that stale entries

/** Pause campaigns for a session. Idempotent: safe to call repeatedly. */
export async function pause(
  redis: RedisHandles,
  sessionId: string,
  reason: PresencePauseReason,
): Promise<void> {
  const key = KEY(sessionId);
  await redis.client.hSet(key, {
    paused: '1',
    reason,
    lastSignalMs: Date.now().toString(),
  });
  await redis.client.expire(key, TTL_SECONDS);
}

/**
 * Clear the paused flag (e.g. session reconnected cleanly). Keeps the
 * `lastSignalMs` timestamp around so the UI can still show "auto-paused
 * 12 minutes ago, recovered" tooltips.
 */
export async function resume(redis: RedisHandles, sessionId: string): Promise<void> {
  const key = KEY(sessionId);
  await redis.client.hSet(key, 'paused', '0');
  await redis.client.expire(key, TTL_SECONDS);
}

/** Cheap per-send predicate: should we *not* dispatch right now? */
export async function isPaused(
  redis: RedisHandles,
  sessionId: string,
): Promise<boolean> {
  const v = await redis.client.hGet(KEY(sessionId), 'paused');
  return v === '1';
}

/** Full status snapshot for surfacing in `getStatus()` / the Overview UI. */
export async function getStatus(
  redis: RedisHandles,
  sessionId: string,
): Promise<PresenceStatus> {
  const raw = await redis.client.hGetAll(KEY(sessionId));
  if (!raw || Object.keys(raw).length === 0) {
    return { paused: false, reason: null, lastSignalAt: null };
  }
  const lastMsStr = raw['lastSignalMs'];
  const reasonStr = raw['reason'];
  const lastMs = lastMsStr ? Number.parseInt(lastMsStr, 10) : NaN;
  return {
    paused: raw['paused'] === '1',
    reason: isReason(reasonStr) ? reasonStr : null,
    lastSignalAt: Number.isFinite(lastMs) ? new Date(lastMs) : null,
  };
}

/**
 * Baileys `stream:error` arrived for this session — pause immediately.
 * The sessions agent should wire this to `sock.ev.on('CB:stream:error', ...)`.
 */
export async function reportStreamError(
  redis: RedisHandles,
  sessionId: string,
): Promise<void> {
  await pause(redis, sessionId, 'stream_error');
}

/**
 * `connection.update` event with `connection === 'close'` arrived.
 * `loggedOut` distinguishes a real auth failure (don't retry) from a
 * transient socket drop (retry on reconnect).
 */
export async function reportDisconnect(
  redis: RedisHandles,
  sessionId: string,
  opts: { loggedOut: boolean },
): Promise<void> {
  await pause(redis, sessionId, opts.loggedOut ? 'logged_out' : 'connection_lost');
}

function isReason(v: string | undefined): v is PresencePauseReason {
  return (
    v === 'stream_error' ||
    v === 'connection_lost' ||
    v === 'logged_out' ||
    v === 'manual'
  );
}
