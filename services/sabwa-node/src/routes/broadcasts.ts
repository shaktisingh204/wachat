/**
 * `/v1/broadcasts` — WhatsApp-style broadcast lists.
 *
 * Broadcast lists are recipient bundles where each recipient receives the
 * outbound payload as an individual 1:1 chat (NOT WhatsApp's native multicast
 * envelope, which is too easy to ban-trip and requires saved-contact
 * reciprocity). The send action fans out by LPUSH'ing one outbound op per
 * recipient onto `sabwa:{sessionId}:outbound`, where the WA worker (sessions
 * agent) picks them up.
 *
 * Routes:
 *   GET    /v1/broadcasts?sessionId=:id          → { broadcasts: [...] }
 *   POST   /v1/broadcasts                        → { broadcastId, created }
 *                                                  (upsert: include `id` to patch)
 *   PATCH  /v1/broadcasts/:id                    → { broadcastId, updated }
 *   POST   /v1/broadcasts/:id/send  body { sessionId, payload }
 *                                                → { broadcastId, jobId, queued }
 *   DELETE /v1/broadcasts/:id                    → { broadcastId, deleted }
 *
 * Wire shapes mirror `SabwaBroadcast` in `src/lib/sabwa/types.ts`.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import type { AppState } from '../state.js';
import * as broadcasts from '../db/broadcasts.js';

const ListQuery = z.object({
  sessionId: z.string().min(1),
});

const UpsertBody = z.object({
  sessionId: z.string().min(1),
  id: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  name: z.string().min(1),
  recipients: z.array(z.string().min(1)),
});

const SendBody = z.object({
  sessionId: z.string().min(1),
  payload: z.unknown(),
});

export function buildBroadcastsRouter(state: AppState): Router {
  const router = Router();

  // ── GET /v1/broadcasts ──────────────────────────────────────────────────
  router.get('/', async (req: Request, res: Response) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'sessionId is required', code: 'bad_request' });
      return;
    }
    try {
      const rows = await broadcasts.listBySession(state.db, parsed.data.sessionId);
      res.json({ broadcasts: rows.map(broadcasts.toWire) });
    } catch (err) {
      state.log.error({ err }, 'broadcasts.list failed');
      res.status(500).json({ error: 'broadcasts.list failed', code: 'internal' });
    }
  });

  // ── POST /v1/broadcasts (upsert) ────────────────────────────────────────
  router.post('/', async (req: Request, res: Response) => {
    const parsed = UpsertBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: 'bad_request' });
      return;
    }
    try {
      const { id, created } = await broadcasts.upsert(state.db, parsed.data);
      res.json({ broadcastId: id, created });
    } catch (err) {
      state.log.error({ err }, 'broadcasts.upsert failed');
      res.status(500).json({ error: 'broadcasts.upsert failed', code: 'internal' });
    }
  });

  // ── PATCH /v1/broadcasts/:id (alias of upsert with explicit id) ─────────
  router.patch('/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'bad_request' });
      return;
    }
    const parsed = UpsertBody.safeParse({ ...req.body, id });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: 'bad_request' });
      return;
    }
    try {
      const result = await broadcasts.upsert(state.db, parsed.data);
      res.json({ broadcastId: result.id, updated: !result.created });
    } catch (err) {
      state.log.error({ err, id }, 'broadcasts.patch failed');
      res.status(500).json({ error: 'broadcasts.patch failed', code: 'internal' });
    }
  });

  // ── DELETE /v1/broadcasts/:id ───────────────────────────────────────────
  router.delete('/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'bad_request' });
      return;
    }
    try {
      const ok = await broadcasts.deleteById(state.db, id);
      res.json({ broadcastId: id, deleted: ok });
    } catch (err) {
      state.log.error({ err, id }, 'broadcasts.delete failed');
      res.status(500).json({ error: 'broadcasts.delete failed', code: 'internal' });
    }
  });

  // ── POST /v1/broadcasts/:id/send ────────────────────────────────────────
  router.post('/:id/send', async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'bad_request' });
      return;
    }
    const parsed = SendBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: 'bad_request' });
      return;
    }
    try {
      const doc = await broadcasts.findById(state.db, id);
      if (!doc) {
        res.status(404).json({ error: 'broadcast not found', code: 'not_found' });
        return;
      }
      const sessionId = parsed.data.sessionId;
      const outboundKey = `sabwa:${sessionId}:outbound`;
      const jobId = `bcjob_${globalThis.crypto.randomUUID()}`;

      // Fan-out: one outbound op per recipient so the WA worker treats each
      // delivery as a normal 1:1 send (deduplicated, rate-limited, etc.).
      const pipeline = state.redis.client.multi();
      for (const jid of doc.recipients) {
        const op = JSON.stringify({
          op: 'broadcast_send',
          broadcastId: id,
          jobId,
          jid,
          payload: parsed.data.payload,
          source: 'broadcast',
        });
        pipeline.lPush(outboundKey, op);
      }
      await pipeline.exec();

      await broadcasts.setStatus(state.db, id, 'queued');
      await broadcasts.markSent(state.db, id, 0, 0);

      res.json({
        broadcastId: id,
        jobId,
        queueKey: outboundKey,
        queued: true,
        recipientCount: doc.recipients.length,
      });
    } catch (err) {
      state.log.error({ err, id }, 'broadcasts.send failed');
      res.status(500).json({ error: 'broadcasts.send failed', code: 'internal' });
    }
  });

  return router;
}
