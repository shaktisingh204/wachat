/**
 * `/v1/bulk` — bulk-send campaign lifecycle.
 *
 * Campaigns are paced by the `bulk-sender` worker. The route layer only:
 *   1. Records the campaign + per-recipient rows in Mongo.
 *   2. Seeds the per-campaign queue ZSET in Redis (score = order).
 *   3. Drops a control signal on the campaign's control list for the worker
 *      to pick up on its next tick (pause / resume / abort).
 *
 * Routes:
 *   GET    /v1/bulk?sessionId=:id          → { campaigns: [...] }
 *   POST   /v1/bulk                        → { campaignId }
 *   GET    /v1/bulk/:id                    → { campaign: { ..., recipients[] } }
 *   POST   /v1/bulk/:id/pause              → { ok: true }
 *   POST   /v1/bulk/:id/resume             → { ok: true }
 *   POST   /v1/bulk/:id/abort              → { ok: true }
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import type { AppState } from '../state.js';
import * as bulk from '../db/bulk.js';

const ListQuery = z.object({
  sessionId: z.string().min(1),
});

// Permissive — Next.js sends a `SabwaBulkCampaignDraft` shape but the engine
// only needs the fields below.
const StartBody = z.object({
  sessionId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  name: z.string().min(1),
  payload: z.unknown(),
  recipients: z.array(z.string().min(1)).min(1),
  perMinute: z.number().int().positive().optional(),
  jitterSec: z.number().int().nonnegative().optional(),
  // The "draft" wrapper from the spec; if present, fall through to the
  // flattened fields above.
  draft: z
    .object({
      audience: z.array(z.string()).optional(),
      payload: z.unknown().optional(),
      sendRate: z.number().int().positive().optional(),
      jitter: z.number().int().nonnegative().optional(),
      name: z.string().optional(),
      recipients: z.array(z.string()).optional(),
      perMinute: z.number().int().positive().optional(),
      jitterSec: z.number().int().nonnegative().optional(),
    })
    .partial()
    .optional(),
}).passthrough();

export function buildBulkRouter(state: AppState): Router {
  const router = Router();

  // ── GET /v1/bulk ────────────────────────────────────────────────────────
  router.get('/', async (req: Request, res: Response) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'sessionId is required', code: 'bad_request' });
      return;
    }
    try {
      const rows = await bulk.listBySession(state.db, parsed.data.sessionId);
      // Summaries only — no recipients array for the list view.
      const campaigns = rows.map((doc) => bulk.toWire(doc, []));
      res.json({ campaigns });
    } catch (err) {
      state.log.error({ err }, 'bulk.list failed');
      res.status(500).json({ error: 'bulk.list failed', code: 'internal' });
    }
  });

  // ── POST /v1/bulk ───────────────────────────────────────────────────────
  router.post('/', async (req: Request, res: Response) => {
    const parsed = StartBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: 'bad_request' });
      return;
    }
    const b = parsed.data;
    // Flatten draft → flat fields (caller may have used either shape).
    const draft = b.draft ?? {};
    const name = b.name ?? draft.name ?? '';
    const payload = b.payload ?? draft.payload ?? {};
    const recipients = b.recipients ?? draft.recipients ?? draft.audience ?? [];
    const sendRate = b.perMinute ?? draft.perMinute ?? draft.sendRate;
    const jitter = b.jitterSec ?? draft.jitterSec ?? draft.jitter;

    if (!name || recipients.length === 0) {
      res.status(400).json({ error: 'name and recipients are required', code: 'bad_request' });
      return;
    }

    try {
      const campaignId = await bulk.createCampaign(state.db, {
        sessionId: b.sessionId,
        projectId: b.projectId,
        name,
        payload,
        recipients,
        sendRate,
        jitter,
      });

      // Seed the per-campaign queue ZSET so the worker can ZPOPMIN in order.
      const queueKey = `sabwa:bulk:${campaignId}:queue`;
      const zaddArgs = recipients.map((jid, idx) => ({ score: idx + 1, value: jid }));
      if (zaddArgs.length > 0) {
        await state.redis.client.zAdd(queueKey, zaddArgs);
      }

      // Publish a start signal so the worker can pick it up immediately
      // instead of waiting for its 2s tick.
      const controlKey = `sabwa:bulk:${campaignId}:control`;
      await state.redis.client.lPush(controlKey, 'start');

      res.json({ campaignId, queueKey, status: 'queued' });
    } catch (err) {
      state.log.error({ err }, 'bulk.create failed');
      res.status(500).json({ error: 'bulk.create failed', code: 'internal' });
    }
  });

  // ── GET /v1/bulk/:id ────────────────────────────────────────────────────
  router.get('/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'bad_request' });
      return;
    }
    try {
      const doc = await bulk.findById(state.db, id);
      if (!doc) {
        res.status(404).json({ error: 'campaign not found', code: 'not_found' });
        return;
      }
      const recipients = await bulk.listRecipients(state.db, id);
      res.json({ campaign: bulk.toWire(doc, recipients) });
    } catch (err) {
      state.log.error({ err, id }, 'bulk.get failed');
      res.status(500).json({ error: 'bulk.get failed', code: 'internal' });
    }
  });

  // ── Control endpoints (pause / resume / abort) ──────────────────────────
  for (const op of ['pause', 'resume', 'abort'] as const) {
    router.post(`/:id/${op}`, async (req: Request, res: Response) => {
      const id = req.params.id;
      if (!id) {
        res.status(400).json({ error: 'id is required', code: 'bad_request' });
        return;
      }
      try {
        const doc = await bulk.findById(state.db, id);
        if (!doc) {
          res.status(404).json({ error: 'campaign not found', code: 'not_found' });
          return;
        }
        const controlKey = `sabwa:bulk:${id}:control`;
        await state.redis.client.lPush(controlKey, op);
        res.json({ campaignId: id, op, queued: true });
      } catch (err) {
        state.log.error({ err, id, op }, 'bulk.control failed');
        res.status(500).json({ error: `bulk.${op} failed`, code: 'internal' });
      }
    });
  }

  return router;
}
