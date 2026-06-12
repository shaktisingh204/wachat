/**
 * SabSMS journeys — event-consumer handler registration (V2.9).
 *
 * Adapts the orchestration functions in `./triggers.ts` onto the
 * `sabsms:events` consumer router. Registration is ADDITIVE: handlers
 * no-op when the dispatch context carries no `db` (e.g. pure router
 * unit tests), so the V2.2 consumer behaviour is untouched.
 *
 * Handled kinds:
 *   - `messageInbound`       → wake waitUntil(replied), exit-on-reply,
 *                              inbound_keyword enrolment
 *   - `contactUnsubscribed`  → exit every live run for the phone hash
 *   - `campaignCompleted`    → enrol recipients into
 *                              campaign_completed-triggered journeys
 *   - `linkClicked`          → wake waitUntil(clicked) (pseudo-event
 *                              XADDed by `../links.ts` recordClick)
 *
 * Worker-safe: relative imports only, no `server-only`.
 */

import type { Db } from 'mongodb';

import type {
  HandlerContext,
  SabsmsEngineEvent,
  SabsmsEventRouter,
} from '../events/consumer';
import { createMongoJourneyStore, type JourneyStore } from './store';
import {
  onCampaignCompleted,
  onContactUnsubscribed,
  onLinkClicked,
  onMessageInbound,
} from './triggers';

/** Pseudo-event kind emitted by the Next-side link shortener. */
export const LINK_CLICKED_EVENT_KIND = 'linkClicked';

const storeCache = new WeakMap<Db, JourneyStore>();

function storeFor(db: Db): JourneyStore {
  let store = storeCache.get(db);
  if (!store) {
    store = createMongoJourneyStore(db);
    storeCache.set(db, store);
  }
  return store;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

type CtxWithDb = HandlerContext & { db?: Db };

/**
 * Register the journey handlers on a consumer router. Handlers are
 * replay-tolerant by construction: wakes/exits are conditional state
 * transitions and enrolment dedupes per (journey, phone).
 */
export function registerJourneyEventHandlers(router: SabsmsEventRouter): SabsmsEventRouter {
  router.on('messageInbound', async (event: SabsmsEngineEvent, ctx) => {
    const db = (ctx as CtxWithDb).db;
    if (!db) return;
    const res = await onMessageInbound(storeFor(db), {
      workspaceId: str(event.payload.workspaceId),
      from: str(event.payload.from),
      body: str(event.payload.body),
    });
    if (res.woken || res.started || res.exited) {
      ctx.log('journeys: messageInbound processed', { ...res });
    }
  });

  router.on('contactUnsubscribed', async (event: SabsmsEngineEvent, ctx) => {
    const db = (ctx as CtxWithDb).db;
    if (!db) return;
    const res = await onContactUnsubscribed(storeFor(db), {
      workspaceId: str(event.payload.workspaceId),
      phoneHash: str(event.payload.phoneHash),
    });
    if (res.exited) ctx.log('journeys: unsubscribe exited runs', { ...res });
  });

  router.on('campaignCompleted', async (event: SabsmsEngineEvent, ctx) => {
    const db = (ctx as CtxWithDb).db;
    if (!db) return;
    const res = await onCampaignCompleted(storeFor(db), {
      workspaceId: str(event.payload.workspaceId),
      campaignId: str(event.payload.campaignId),
    });
    if (res.started) ctx.log('journeys: campaignCompleted enrolments', { ...res });
  });

  router.on(LINK_CLICKED_EVENT_KIND, async (event: SabsmsEngineEvent, ctx) => {
    const db = (ctx as CtxWithDb).db;
    if (!db) return;
    const res = await onLinkClicked(storeFor(db), {
      workspaceId: str(event.payload.workspaceId),
      slug: str(event.payload.slug) || undefined,
      messageId: str(event.payload.messageId) || undefined,
      contactId: str(event.payload.contactId) || undefined,
    });
    if (res.woken) ctx.log('journeys: linkClicked woke runs', { ...res });
  });

  return router;
}
