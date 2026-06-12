/**
 * SabSMS — Next-side pseudo-event emitter (V2.9).
 *
 * The Rust engine owns the `sabsms:events` stream for engine-domain
 * events, but link clicks happen entirely Next-side (the `/s/[slug]`
 * redirect → `links.ts#recordClick`). This module XADDs a `linkClicked`
 * pseudo-event in the EXACT wire shape the engine uses
 * (`services/sabsms-engine/src/events.rs` — fields `kind` / `payload` /
 * `at`, internally-tagged camelCase payload) so the existing consumer
 * parses it like any other event.
 *
 * Fire-and-forget by contract: emitting must NEVER fail or slow the
 * caller (it sits on the public redirect path).
 */

import Redis from 'ioredis';

import { SABSMS_EVENTS_STREAM } from './consumer';

export interface LinkClickedPayload {
  workspaceId: string;
  slug: string;
  messageId?: string;
  contactId?: string;
  campaignId?: string;
}

let client: Redis | null = null;

function getRedis(): Redis {
  if (client) return client;
  // Same connection convention as the consumer / sabflow workers:
  // REDIS_URL wins; `||` (not `??`) so empty strings fall through.
  if (process.env.REDIS_URL) {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  } else {
    client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
      ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  }
  client.on('error', () => {
    /* swallowed — emit is best-effort */
  });
  return client;
}

/**
 * XADD a `linkClicked` event. Swallows every failure (warn-logged) —
 * journey click-wakes are an enhancement, never a dependency of the
 * redirect itself.
 */
export async function emitLinkClickedEvent(payload: LinkClickedPayload): Promise<void> {
  try {
    const redis = getRedis();
    const event = {
      kind: 'linkClicked',
      workspaceId: payload.workspaceId,
      slug: payload.slug,
      ...(payload.messageId ? { messageId: payload.messageId } : {}),
      ...(payload.contactId ? { contactId: payload.contactId } : {}),
      ...(payload.campaignId ? { campaignId: payload.campaignId } : {}),
    };
    await redis.xadd(
      SABSMS_EVENTS_STREAM,
      '*',
      'kind',
      'linkClicked',
      'payload',
      JSON.stringify(event),
      'at',
      String(Date.now()),
    );
  } catch (err) {
    console.warn(
      '[sabsms/events] linkClicked emit failed (ignored)',
      err instanceof Error ? err.message : err,
    );
  }
}
