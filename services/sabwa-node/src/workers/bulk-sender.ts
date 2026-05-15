/**
 * Bulk-sender worker.
 *
 * One process drains every active campaign in the cluster — concurrency is
 * achieved by interleaving campaigns within a single event-loop, NOT by
 * sharding across replicas. We poll Mongo every 2s for campaigns whose
 * status is `queued` or `running`, then for each one:
 *
 *   1. Drain pending control signals (`start` / `pause` / `resume` / `abort`).
 *   2. Compute the per-tick send budget from the campaign's `sendRate`
 *      (msgs/min) — clamped to 60 to keep a single campaign from monopolising
 *      the loop.
 *   3. Pop that many recipients off the ZSET `sabwa:bulk:{campaignId}:queue`
 *      and, for each:
 *        - LPUSH a 1:1 outbound op onto `sabwa:{sessionId}:outbound`.
 *        - Sleep `jitter` seconds (with +/- 30% random spread).
 *        - Mark the recipient `sent` and bump the parent counters.
 *   4. Publish a progress event onto `sabwa:events:{sessionId}` for SSE so
 *      the UI live-updates without another HTTP round-trip.
 *
 * Why a ZSET, not a list: the user-visible "order" is preserved across
 * pause/resume cycles and ZPOPMIN is atomic.
 *
 * Why one process, not workers per campaign: campaigns are I/O bound (Redis
 * + Mongo writes) and `await` makes interleaving free. Spinning a worker per
 * campaign just multiplies the connection cost.
 */

import type { AppState } from '../state.js';
import * as bulk from '../db/bulk.js';

const TICK_INTERVAL_MS = 2_000;
const MAX_RECIPIENTS_PER_TICK = 60;
const DEFAULT_SEND_RATE_PER_MINUTE = 30;
const MAX_CONSECUTIVE_ERRORS = 3;

export function startBulkSender(state: AppState): () => Promise<void> {
  let stopped = false;
  let inflight: Promise<void> = Promise.resolve();

  const loop = async (): Promise<void> => {
    while (!stopped) {
      const started = Date.now();
      try {
        await tickOnce(state);
      } catch (err) {
        state.log.error({ err }, 'bulk-sender tick failed');
      }
      const elapsed = Date.now() - started;
      const delay = Math.max(0, TICK_INTERVAL_MS - elapsed);
      await sleep(delay);
    }
  };

  inflight = loop();

  return async (): Promise<void> => {
    stopped = true;
    await inflight;
  };
}

async function tickOnce(state: AppState): Promise<void> {
  const campaigns = await bulk.findActive(state.db);
  if (campaigns.length === 0) return;

  // Process every active campaign — interleaved (Promise.all), capped so a
  // bug that loads thousands of rows can't blow the event loop.
  const slice = campaigns.slice(0, 32);
  await Promise.all(slice.map((doc) => dispatchBatch(state, doc).catch((err) => {
    state.log.error({ err, campaignId: doc._id }, 'dispatchBatch failed');
  })));
}

async function dispatchBatch(state: AppState, campaign: bulk.CampaignDoc): Promise<void> {
  // 1. Apply any pending control signal.
  await applyControlSignals(state, campaign);

  // Re-fetch in case a control flipped status (paused/aborted/completed).
  const fresh = await bulk.findById(state.db, campaign._id);
  if (!fresh) return;
  if (fresh.status === 'paused' || fresh.status === 'aborted' || fresh.status === 'completed' || fresh.status === 'failed') {
    return;
  }
  campaign = fresh;

  // 2. queued → running on first batch.
  if (campaign.status === 'queued') {
    await bulk.setStatus(state.db, campaign._id, 'running');
  }

  // 3. Budget from sendRate (msgs/minute) → per-tick (2s) recipients.
  const ratePerMin = campaign.sendRate ?? DEFAULT_SEND_RATE_PER_MINUTE;
  const perTick = Math.max(1, Math.min(MAX_RECIPIENTS_PER_TICK, Math.ceil((ratePerMin * TICK_INTERVAL_MS) / 60_000)));

  // 4. Pop recipients from the campaign queue ZSET.
  const queueKey = `sabwa:bulk:${campaign._id}:queue`;
  const popped: Array<{ value: string; score: number }> = [];
  try {
    // node-redis exposes zPopMin(key, count) but pre-existing typings can
    // be flaky on tuples; we collect via repeat zPopMin if needed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await (state.redis.client as any).zPopMinCount?.(queueKey, perTick)
      ?? await (state.redis.client as any).zPopMin(queueKey, perTick);
    if (Array.isArray(res)) {
      for (const entry of res) {
        if (entry && typeof entry === 'object' && 'value' in entry) {
          popped.push({ value: String(entry.value), score: Number(entry.score) });
        }
      }
    }
  } catch (err) {
    state.log.warn({ err, campaignId: campaign._id }, 'zPopMin failed; falling back to recipients list');
  }

  // Fallback path: ZSET wasn't seeded (legacy row) → drive from the campaign
  // recipients[] minus already-sent rows.
  if (popped.length === 0) {
    const recs = await bulk.listRecipients(state.db, campaign._id);
    const pending = recs.filter((r) => r.status === 'pending').slice(0, perTick);
    for (const r of pending) popped.push({ value: r.jid, score: r.order });
  }

  if (popped.length === 0) {
    await finaliseIfDrained(state, campaign);
    return;
  }

  // 5. Dispatch each recipient in series so we can apply jitter cleanly.
  let sent = 0;
  let failed = 0;
  let consecutiveErrors = campaign.consecutiveErrors ?? 0;
  let autoPaused = false;

  for (const { value: jid, score } of popped) {
    try {
      const outboundOp = {
        op: 'bulk_send',
        campaignId: campaign._id,
        jid,
        payload: personalisePayload(campaign.payload, jid),
        source: 'bulk',
      };
      await state.redis.client.lPush(`sabwa:${campaign.sessionId}:outbound`, JSON.stringify(outboundOp));

      await bulk.upsertRecipient(state.db, {
        campaignId: campaign._id,
        sessionId: campaign.sessionId,
        jid,
        order: Math.round(score),
        status: 'sent',
      });

      sent += 1;
      consecutiveErrors = 0;

      // Publish a progress event for SSE.
      await publishProgress(state, campaign.sessionId, campaign._id, {
        sentDelta: 1,
        failedDelta: 0,
        jid,
      });

      // Apply jitter — default 0, otherwise random within ±30% of `jitter`.
      if (campaign.jitter && campaign.jitter > 0) {
        const base = campaign.jitter * 1000;
        const spread = base * 0.3;
        const ms = base + (Math.random() * 2 - 1) * spread;
        await sleep(Math.max(50, ms));
      }
    } catch (err) {
      state.log.warn({ err, campaignId: campaign._id, jid }, 'bulk recipient dispatch failed');
      await bulk.upsertRecipient(state.db, {
        campaignId: campaign._id,
        sessionId: campaign.sessionId,
        jid,
        order: Math.round(score),
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
      failed += 1;
      consecutiveErrors += 1;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        autoPaused = true;
        break;
      }
    }
  }

  // 6. Persist counters.
  if (sent !== 0 || failed !== 0) {
    await bulk.bumpProgress(state.db, campaign._id, sent, failed);
  }
  if (consecutiveErrors !== (campaign.consecutiveErrors ?? 0)) {
    await bulk.setConsecutiveErrors(state.db, campaign._id, consecutiveErrors);
  }

  if (autoPaused) {
    await bulk.setStatus(state.db, campaign._id, 'paused');
    await publishStatus(state, campaign.sessionId, campaign._id, 'paused', 'consecutive_errors');
    return;
  }

  await finaliseIfDrained(state, campaign);
}

async function applyControlSignals(state: AppState, campaign: bulk.CampaignDoc): Promise<void> {
  const controlKey = `sabwa:bulk:${campaign._id}:control`;
  // Drain everything queued for this tick.
  while (true) {
    const sig = await state.redis.client.lPop(controlKey);
    if (!sig) break;
    const op = sig.toLowerCase().trim();
    switch (op) {
      case 'start':
        // No-op — implicit on first tick.
        break;
      case 'pause':
        await bulk.setStatus(state.db, campaign._id, 'paused');
        await publishStatus(state, campaign.sessionId, campaign._id, 'paused', 'operator');
        break;
      case 'resume':
        await bulk.setStatus(state.db, campaign._id, 'running');
        await publishStatus(state, campaign.sessionId, campaign._id, 'running', 'operator');
        break;
      case 'abort': {
        const cancelled = await bulk.cancelRemainingRecipients(state.db, campaign._id);
        await state.redis.client.del(`sabwa:bulk:${campaign._id}:queue`);
        await bulk.setStatus(state.db, campaign._id, 'aborted', { cancelledCount: cancelled });
        await publishStatus(state, campaign.sessionId, campaign._id, 'aborted', 'operator');
        break;
      }
      default:
        state.log.warn({ op, campaignId: campaign._id }, 'unknown bulk control signal');
    }
  }
}

async function finaliseIfDrained(state: AppState, campaign: bulk.CampaignDoc): Promise<void> {
  const queueLen = await state.redis.client.zCard(`sabwa:bulk:${campaign._id}:queue`).catch(() => 0);
  if (queueLen > 0) return;
  const pending = await bulk.countPending(state.db, campaign._id);
  if (pending > 0) return;
  await bulk.setStatus(state.db, campaign._id, 'completed');
  await publishStatus(state, campaign.sessionId, campaign._id, 'completed', 'drained');
}

/** Substitute `{{firstName}}` etc. — best-effort, matches the Rust worker. */
function personalisePayload(payload: bulk.JsonValue, jid: string): bulk.JsonValue {
  // We don't yet resolve `{{firstName}}` from sabwa_contacts here — the WA
  // worker handles that on dispatch. This is the hook for future per-jid
  // templating without another Mongo lookup in this loop.
  void jid;
  return payload;
}

async function publishProgress(
  state: AppState,
  sessionId: string,
  campaignId: string,
  payload: { sentDelta: number; failedDelta: number; jid: string },
): Promise<void> {
  const channel = `sabwa:events:${sessionId}`;
  const event = {
    type: 'bulk_progress',
    sessionId,
    campaignId,
    ...payload,
    ts: Date.now(),
  };
  await state.redis.pub.publish(channel, JSON.stringify(event)).catch(() => undefined);
}

async function publishStatus(
  state: AppState,
  sessionId: string,
  campaignId: string,
  status: string,
  detail: string,
): Promise<void> {
  const channel = `sabwa:events:${sessionId}`;
  const event = {
    type: 'bulk_status',
    sessionId,
    campaignId,
    status,
    detail,
    ts: Date.now(),
  };
  await state.redis.pub.publish(channel, JSON.stringify(event)).catch(() => undefined);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
