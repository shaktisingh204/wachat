/**
 * Top-level `/v1` router for sabwa-node.
 *
 * Per-domain agents (sessions, chats, messages, groups, contacts, scheduled,
 * broadcasts, bulk, audit, api-keys, webhooks, realtime, public) will mount
 * their own sub-routers here using the same path prefixes the Rust engine
 * used (see `services/sabwa-engine/src/routes/mod.rs`):
 *
 *   /v1/sessions          /v1/chats             /v1/messages
 *   /v1/groups            /v1/group-categories  /v1/contacts
 *   /v1/scheduled         /v1/broadcasts        /v1/bulk
 *   /v1/audit             /v1/api-keys          /v1/webhooks
 *   /v1/realtime          /v1/public            (api-key gated)
 *
 * For now we only ship stub routes for `/v1/sessions` and `/v1/realtime/token`
 * (both return 501) so that the engine answers handshakes from Next.js while
 * sibling agents fill in the real implementations.
 */

import { Router } from 'express';
import type { AppState } from '../state.js';
import { buildApiKeysRouter } from './api-keys.js';
import { buildAuditRouter } from './audit.js';
import { buildAutoRepliesRouter } from './auto-replies.js';
import { buildChatsRouter } from './chats.js';
import { buildContactsRouter } from './contacts.js';
import { buildChatMessagesRouter, buildMessagesRouter } from './messages.js';
import { buildGroupCategoriesRouter } from './group-categories.js';
import { buildGroupsRouter } from './groups.js';
import { buildLabelsRouter } from './labels.js';
import { buildQuickRepliesRouter } from './quick-replies.js';
import { buildRealtimeTokenRouter } from './realtime.js';
import { buildTemplatesRouter } from './templates.js';
import { buildWebhooksRouter } from './webhooks.js';
import { buildBroadcastsRouter } from './broadcasts.js';
import { buildBulkRouter } from './bulk.js';
import { buildAnalyticsRouter } from './analytics.js';
import { buildExportRouter } from './export.js';
import { buildSessionsRouter } from './sessions.js';
import { buildScheduledRouter } from './scheduled.js';

const NOT_IMPLEMENTED_BODY = {
  error: 'not implemented yet',
  code: 'not_implemented',
} as const;

function notImplemented(name: string) {
  return (_req: import('express').Request, res: import('express').Response): void => {
    res.status(501).json({ ...NOT_IMPLEMENTED_BODY, route: name });
  };
}

/** Build the `/v1` router. Mounted with the service-token gate applied upstream. */
export function buildV1Router(state: AppState): Router {
  const router = Router();

  // ── /v1/sessions ─────────────────────────────────────────────────────────
  // Real implementation: see `routes/sessions.ts`. Drives the in-process
  // Baileys pool (`state.pool`) and persists every event into the matching
  // `sabwa_*` Mongo collection.
  router.use('/sessions', buildSessionsRouter(state));

  // ── /v1/chats + /v1/messages ────────────────────────────────────────────
  // Chat list / metadata patches and inbound/outbound message persistence.
  // The send path inside `/v1/messages` runs through the anti-ban gate before
  // any Baileys dispatch (see `routes/messages.ts`).
  router.use('/chats', buildChatsRouter(state));
  // `/v1/chats/:jid/messages` is an alias the Next.js client also uses.
  router.use('/chats/:jid', buildChatMessagesRouter(state));
  router.use('/messages', buildMessagesRouter(state));

  // ── /v1/realtime/token ──────────────────────────────────────────────────
  // The browser-facing SSE handler is mounted separately at `/realtime/*`
  // (un-gated for service-token) in `index.ts` — it self-authenticates via
  // the JWT this endpoint issues.
  router.use('/realtime', buildRealtimeTokenRouter(state));

  // ── /v1/contacts, /v1/groups ────────────────────────────────────────────
  // Contact directory + group lifecycle / participants / invite links. The
  // groups router invokes the live Baileys socket directly via the in-process
  // `state.pool`; the contacts router persists patches eagerly and queues
  // Baileys block/unblock through the per-session outbound Redis list.
  router.use('/contacts', buildContactsRouter());
  router.use('/groups', buildGroupsRouter());

  // ── /v1/group-categories, /v1/labels, /v1/templates, /v1/quick-replies ──
  // Phase-1 CRUD domains backed directly by Mongo (no Baileys / Redis hop).
  // These mirror the Rust engine's HTTP contracts so the Next.js client
  // (engine-client.ts / sabwa.actions.ts) keeps working unchanged.
  router.use('/group-categories', buildGroupCategoriesRouter());
  router.use('/labels', buildLabelsRouter());
  router.use('/templates', buildTemplatesRouter());
  router.use('/quick-replies', buildQuickRepliesRouter());

  // ── /v1/auto-replies, /v1/webhooks, /v1/api-keys, /v1/audit ─────────────
  // Owned by the "auto-replies + integrations" agent. Mutations on every
  // other domain should call `recordAudit(...)` from `db/audit.ts` to feed
  // the `GET /v1/audit` listing here.
  router.use('/auto-replies', buildAutoRepliesRouter(state));
  router.use('/webhooks', buildWebhooksRouter(state));
  router.use('/api-keys', buildApiKeysRouter(state));
  router.use('/audit', buildAuditRouter(state));

  // ── /v1/scheduled ───────────────────────────────────────────────────────
  // CRUD for `sabwa_scheduled`. The scheduler tick worker (started from
  // `src/workers/index.ts`) polls Mongo every 30 s, fires due rows via the
  // in-process Baileys pool, and materialises recurring children using
  // `cron-parser`.
  router.use('/scheduled', buildScheduledRouter(state));

  // ── /v1/broadcasts, /v1/bulk, /v1/analytics, /v1/export(s) ──────────────
  // Owned by the "broadcasts + bulk + analytics + export" agent. The bulk
  // and export workers (started from `index.ts`) drain the per-campaign
  // ZSET / queued-export rows these routes enqueue.
  router.use('/broadcasts', buildBroadcastsRouter(state));
  router.use('/bulk', buildBulkRouter(state));
  router.use('/analytics', buildAnalyticsRouter(state));
  router.use('/export', buildExportRouter(state));
  // `/v1/exports` is the alias used by `listExports`/`getExport` in
  // `sabwa.actions.ts` — both paths share the same handlers.
  router.use('/exports', buildExportRouter(state));

  return router;
}
