/**
 * SabSMS v3.7 — sink consumption glue.
 *
 * Called by the events worker for each event off the `sabsms:events`
 * stream: build the versioned envelope, find the workspace's matching
 * sinks, fan out, and persist a delivery row per sink (carrying the retry
 * schedule for a follow-up sweeper). All IO is injected so the routing +
 * bookkeeping is unit-tested with no Mongo/network.
 */

import type { SabsmsEventSink, SabsmsSinkDelivery } from '../types';
import { buildEventEnvelope, matchingSinks, type RawEvent } from './sinks-core';
import { fanOut as realFanOut, type SinkDeliveryDeps, type SinkDeliveryResult } from './dispatch';
import type { EventEnvelope } from './sinks-core';

export interface ConsumeDeps {
  loadSinks?: (workspaceId: string) => Promise<SabsmsEventSink[]>;
  fanOut?: (
    env: EventEnvelope,
    sinks: readonly SabsmsEventSink[],
    deps?: SinkDeliveryDeps,
  ) => Promise<SinkDeliveryResult[]>;
  persistDelivery?: (row: SabsmsSinkDelivery) => Promise<void>;
  /** Transports passed through to fanOut (httpPost + kafka/kinesis). */
  delivery?: SinkDeliveryDeps;
  now?: () => Date;
}

export interface ConsumeResult {
  matched: number;
  delivered: number;
  failed: number;
}

async function defaultLoadSinks(workspaceId: string): Promise<SabsmsEventSink[]> {
  const { getSabsmsCollections } = await import('../db/collections');
  const { cols } = await getSabsmsCollections();
  return cols.eventSinks.find({ workspaceId, enabled: true }).toArray();
}

async function defaultPersistDelivery(row: SabsmsSinkDelivery): Promise<void> {
  const { getSabsmsCollections } = await import('../db/collections');
  const { cols } = await getSabsmsCollections();
  await cols.sinkDeliveries.insertOne(row);
}

export async function deliverEventToSinks(
  raw: RawEvent,
  deps: ConsumeDeps = {},
): Promise<ConsumeResult> {
  const env = buildEventEnvelope(raw);
  const loadSinks = deps.loadSinks ?? defaultLoadSinks;
  const sinks = await loadSinks(env.workspaceId);
  const matched = matchingSinks(env, sinks);
  if (matched.length === 0) return { matched: 0, delivered: 0, failed: 0 };

  const fanOut = deps.fanOut ?? realFanOut;
  const results = await fanOut(env, matched, deps.delivery);
  const now = deps.now ? deps.now() : new Date();
  const persist = deps.persistDelivery ?? defaultPersistDelivery;

  let delivered = 0;
  let failed = 0;
  await Promise.all(
    results.map(async (r, i) => {
      if (r.ok) delivered += 1;
      else failed += 1;
      await persist({
        workspaceId: env.workspaceId,
        sinkId: String(matched[i]._id ?? ''),
        eventId: env.id,
        eventType: env.type,
        status: r.ok ? 'delivered' : r.retryable ? 'pending' : 'failed',
        attempts: 1,
        lastError: r.error,
        nextRetryAt: r.nextRetryAt,
        createdAt: now,
        updatedAt: now,
      });
    }),
  );

  return { matched: matched.length, delivered, failed };
}
