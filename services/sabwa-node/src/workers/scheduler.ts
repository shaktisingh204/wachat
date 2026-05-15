/**
 * Scheduler worker — drains due `sabwa_scheduled` rows and fires them.
 *
 * Every `TICK_INTERVAL_MS` (30 s) the loop wakes up and:
 *
 *   1. Queries `sabwa_scheduled` for `pending` rows with `scheduledFor <= now`
 *      (recurring parents are excluded; only their materialised `one_off`
 *      children appear here).
 *   2. For each row:
 *        - Looks up the BaileysSession in the in-process pool via `sessionId`.
 *        - Builds a Baileys-compatible `content` from `row.payload`.
 *        - Calls `sock.sendMessage(target.jid, content)` for every target.
 *        - On success: marks the row `sent`.
 *        - On failure: marks the row `failed` and persists the error.
 *   3. Walks every `pending` recurring parent row and, if its current
 *      `scheduledFor` is in the past, materialises the next instance as a
 *      fresh `one_off` child row and advances the parent's `scheduledFor`
 *      to the new fire time.
 *
 * Concurrency: a single tick processes due rows in series (a 30 s tick is
 * coarse enough that head-of-line blocking inside the same tick is fine, and
 * serial sends play nicer with the antiban rate limiter). Failures on a single
 * row do NOT abort the rest of the batch.
 *
 * Timezone: `row.timezone` is fed to `cron-parser` as the `tz` option so users
 * can author cron expressions in their local zone. Defaults to `'UTC'` when
 * absent.
 */

import { randomUUID } from 'node:crypto';

import { CronExpressionParser } from 'cron-parser';

import type { AppState } from '../state.js';
import * as scheduled from '../db/scheduled.js';
import type { ScheduledDoc, ScheduledTarget } from '../db/scheduled.js';

/** Tick cadence — every 30 seconds. */
const TICK_INTERVAL_MS = 30_000;

/** Maximum due rows drained per tick. Keeps memory bounded under bursts. */
const MAX_PER_TICK = 100;

/** Re-export so routes can validate cron strings at create time. */
export function validateCron(cron: string, timezone: string): string | null {
  try {
    CronExpressionParser.parse(cron, { tz: timezone || 'UTC' });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Compute the next fire time for a cron expression, evaluated in `timezone`,
 * AFTER the supplied `after` instant. Returns `null` if the cron cannot be
 * parsed (we treat that as "stop scheduling further instances").
 */
export function nextCronFireTime(cron: string, timezone: string, after: Date): Date | null {
  try {
    const it = CronExpressionParser.parse(cron, {
      tz: timezone || 'UTC',
      currentDate: after,
    });
    return it.next().toDate();
  } catch {
    return null;
  }
}

/**
 * Start the scheduler tick loop. Returns a `stop()` function callers should
 * `await` during graceful shutdown so the in-flight tick can finish.
 */
export function startScheduler(state: AppState): () => Promise<void> {
  let stopped = false;
  let inflight: Promise<void> = Promise.resolve();

  const loop = async (): Promise<void> => {
    state.log.info({ intervalMs: TICK_INTERVAL_MS }, 'scheduler: starting tick loop');
    while (!stopped) {
      const started = Date.now();
      try {
        await tickOnce(state);
      } catch (err) {
        state.log.error({ err }, 'scheduler: tick failed');
      }
      const elapsed = Date.now() - started;
      const delay = Math.max(0, TICK_INTERVAL_MS - elapsed);
      await sleep(delay);
    }
    state.log.info('scheduler: tick loop stopped');
  };

  inflight = loop();

  return async (): Promise<void> => {
    stopped = true;
    await inflight;
  };
}

/** One iteration of the tick loop. Exported for tests. */
export async function tickOnce(state: AppState): Promise<void> {
  const now = new Date();

  // 1) Fire all due one-off rows.
  const due = await scheduled.findDue(state.db, now, MAX_PER_TICK);
  for (const row of due) {
    try {
      await dispatchRow(state, row);
    } catch (err) {
      // Per-row isolation: log and continue.
      const message = err instanceof Error ? err.message : String(err);
      state.log.warn({ err, id: row._id }, 'scheduler: dispatch threw');
      try {
        await scheduled.markFailed(state.db, row._id, message);
      } catch (markErr) {
        state.log.error({ err: markErr, id: row._id }, 'scheduler: markFailed also failed');
      }
    }
  }

  // 2) Materialise next instances for recurring parents whose previous fire
  //    time is in the past.
  await materialiseRecurring(state, now);
}

/**
 * Dispatch a single row: send to each target via the BaileysSession, then
 * flip the row's status. We treat the row as `sent` if *every* target send
 * resolved, otherwise `failed` with a concatenated error.
 */
async function dispatchRow(state: AppState, row: ScheduledDoc): Promise<void> {
  // Resolve a sender from the live pool first (the real `BaileysSession`
  // class exposes `sendMessage` directly). Fall back to the legacy
  // `state.sessions` placeholder map for forward-compatibility with any
  // code that still writes there.
  const sender = resolveSender(state, row.sessionId);
  if (!sender) {
    await scheduled.markFailed(state.db, row._id, `session not in pool: ${row.sessionId}`);
    return;
  }
  if (sender.status && sender.status !== 'connected') {
    await scheduled.markFailed(
      state.db,
      row._id,
      `session not connected (status=${sender.status})`,
    );
    return;
  }

  const content = buildBaileysContent(row.payload);
  const errors: string[] = [];

  for (const target of row.targets) {
    try {
      await sender.send(target.jid, content);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${target.jid}: ${message}`);
    }
  }

  if (errors.length === 0) {
    await scheduled.markSent(state.db, row._id);
    state.log.info(
      { id: row._id, sessionId: row.sessionId, targets: row.targets.length },
      'scheduler: dispatched',
    );
  } else if (errors.length === row.targets.length) {
    await scheduled.markFailed(state.db, row._id, errors.join('; '));
  } else {
    // Partial success — we still mark `sent` but persist the error string so
    // the operator can see which target(s) failed. Mirrors the Rust engine.
    await scheduled.markSent(state.db, row._id);
    await scheduled.setLastError(state.db, row._id, errors.join('; '));
  }
}

/**
 * For every `pending` recurring parent row, compute the next fire time after
 * its current `scheduledFor` and, if that time is now in the past or near
 * future, insert a fresh `one_off` child row at that instant. Advances the
 * parent's `scheduledFor` to the new fire time so the next tick won't
 * re-materialise the same instance.
 *
 * We only materialise ONE step ahead per tick — the next tick (30 s later)
 * will pick up the following step. This keeps backfill bounded if a long
 * outage leaves a recurring schedule far behind.
 */
async function materialiseRecurring(state: AppState, now: Date): Promise<void> {
  const parents = await scheduled.findRecurringParents(state.db);
  for (const parent of parents) {
    if (!parent.cron) continue;
    // The parent's current `scheduledFor` is the "anchor" — the moment the
    // child due THIS cycle should fire. Materialise if it's already past,
    // otherwise leave it alone (the cron's `next()` from now would push too
    // far ahead).
    if (parent.scheduledFor.getTime() > now.getTime()) continue;

    try {
      const fireAt = parent.scheduledFor;
      const tz = parent.timezone ?? 'UTC';

      // Insert the child for the anchor instant.
      const childId = `sch_${randomUUID()}`;
      await scheduled.insert(state.db, {
        _id: childId,
        projectId: parent.projectId,
        sessionId: parent.sessionId,
        kind: 'one_off',
        scheduledFor: fireAt,
        timezone: tz,
        targets: parent.targets,
        payload: parent.payload,
        parentId: parent._id,
      });

      // Advance the parent: stamp lastFiredAt + push scheduledFor to the
      // next cron tick AFTER the just-materialised anchor.
      const nextAfter = nextCronFireTime(parent.cron, tz, fireAt);
      await scheduled.setLastFiredAt(state.db, parent._id, fireAt);
      if (nextAfter) {
        await scheduled.advanceRecurringParent(state.db, parent._id, nextAfter);
      } else {
        // Cron no longer produces future fires — flip the parent so we stop
        // walking it.
        await scheduled.retireRecurringParent(state.db, parent._id);
      }

      state.log.info(
        { parentId: parent._id, childId, fireAt, cron: parent.cron, tz },
        'scheduler: materialised recurring child',
      );
    } catch (err) {
      state.log.error({ err, parentId: parent._id }, 'scheduler: materialiseRecurring failed');
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Structural shape we need to dispatch a message: send + optional status. */
interface Sender {
  status?: string;
  send(jid: string, content: BaileysContent): Promise<unknown>;
}

/**
 * Resolve a `Sender` for `sessionId`. Tries the live pool first (real
 * `BaileysSession` instances that expose `sendMessage`), then falls back to
 * the legacy placeholder map (where `sock.sendMessage` lives on a raw
 * Baileys `WASocket`). Returns `null` if neither path is wired.
 */
function resolveSender(state: AppState, sessionId: string): Sender | null {
  const live = state.pool.get(sessionId) as
    | {
        sendMessage?: (
          jid: string,
          content: BaileysContent,
        ) => Promise<unknown>;
        status?: string;
      }
    | undefined;
  if (live && typeof live.sendMessage === 'function') {
    return {
      status: live.status,
      send: (jid, content) => live.sendMessage!(jid, content),
    };
  }
  const legacy = state.sessions.get(sessionId);
  const sock = legacy?.sock as
    | { sendMessage?: (jid: string, content: BaileysContent) => Promise<unknown> }
    | undefined;
  if (legacy && sock && typeof sock.sendMessage === 'function') {
    return {
      status: legacy.status,
      send: (jid, content) => sock.sendMessage!(jid, content),
    };
  }
  return null;
}

/**
 * Minimal subset of `AnyMessageContent` we build at the worker. Kept here so
 * we don't pull `@whiskeysockets/baileys` types into the shared state.
 */
interface BaileysContent {
  text?: string;
  image?: { url: string } | Buffer;
  video?: { url: string } | Buffer;
  audio?: { url: string } | Buffer;
  document?: { url: string } | Buffer;
  caption?: string;
  mimetype?: string;
  fileName?: string;
  ptt?: boolean;
  [k: string]: unknown;
}

/**
 * Translate a stored `payload` (the same shape that `POST /v1/messages/send`
 * receives) into the Baileys `sendMessage` content object.
 *
 * Supported types: `text` (default), `image`, `video`, `audio`, `voice`,
 * `document`. Unknown types fall back to a plain text send of `payload.body`.
 */
function buildBaileysContent(payload: unknown): BaileysContent {
  const p = (payload ?? {}) as Record<string, unknown>;
  const type = typeof p.type === 'string' ? p.type : 'text';

  switch (type) {
    case 'image':
      return {
        image: mediaSource(p),
        caption: optString(p.caption),
        mimetype: optString(p.mimetype),
      };
    case 'video':
      return {
        video: mediaSource(p),
        caption: optString(p.caption),
        mimetype: optString(p.mimetype),
      };
    case 'audio':
      return {
        audio: mediaSource(p),
        mimetype: optString(p.mimetype) ?? 'audio/mp4',
        ptt: false,
      };
    case 'voice':
      return {
        audio: mediaSource(p),
        mimetype: optString(p.mimetype) ?? 'audio/ogg; codecs=opus',
        ptt: true,
      };
    case 'document':
      return {
        document: mediaSource(p),
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

function mediaSource(p: Record<string, unknown>): { url: string } | Buffer {
  if (typeof p.url === 'string') return { url: p.url };
  if (typeof p.data === 'string') return Buffer.from(p.data, 'base64');
  // Fall back to an empty buffer — Baileys will reject this with a clear
  // error which is then captured as the row's `lastError`.
  return Buffer.alloc(0);
}

function optString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Find a target by JID — exported for tests. */
export function _findTarget(
  targets: ScheduledTarget[],
  jid: string,
): ScheduledTarget | undefined {
  return targets.find((t) => t.jid === jid);
}
