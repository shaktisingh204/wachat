/**
 * `/v1/export` (singular path, plus alias `/v1/exports`) — message export jobs.
 *
 * Routes:
 *   POST /v1/export
 *     body { sessionId, targets[], scope?, format: 'json'|'csv'|'txt'|'pdf', includeMedia: bool }
 *     → { exportId, status }
 *   GET  /v1/export?sessionId=:id  → { exports: [...] }
 *   GET  /v1/export/:id           → { export: { ..., status, downloadUrl? } }
 *
 * The job is durable: the route only inserts a row with `status: 'queued'`
 * and the worker in `workers/export.ts` claims it.
 *
 * The Next.js shim sends `scope.kind/jids/from/to` (see `createExport` in
 * `sabwa.actions.ts`); legacy callers may instead post `targets[]`, which we
 * normalise to `scope.kind === 'chats'`.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import type { AppState } from '../state.js';
import * as exports from '../db/exports.js';
import { asString } from './_helpers.js';

const ScopeSchema = z.object({
  kind: z.enum(['all', 'chats', 'date_range']),
  jids: z.array(z.string()).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const CreateBody = z.object({
  sessionId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  format: z.enum(['json', 'csv', 'txt', 'pdf']),
  includeMedia: z.boolean().optional().default(false),
  scope: ScopeSchema.optional(),
  // Legacy alias used by the original spec.
  targets: z.array(z.string()).optional(),
});

const ListQuery = z.object({
  sessionId: z.string().min(1),
});

export function buildExportRouter(state: AppState): Router {
  const router = Router();

  // ── POST /v1/export ─────────────────────────────────────────────────────
  router.post('/', async (req: Request, res: Response) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: 'bad_request' });
      return;
    }
    const b = parsed.data;
    const scope: exports.ExportScope = b.scope
      ? {
          kind: b.scope.kind,
          jids: b.scope.jids,
          from: b.scope.from ? new Date(b.scope.from) : undefined,
          to: b.scope.to ? new Date(b.scope.to) : undefined,
        }
      : b.targets && b.targets.length > 0
        ? { kind: 'chats', jids: b.targets }
        : { kind: 'all' };

    try {
      const id = await exports.createExport(state.db, {
        sessionId: b.sessionId,
        projectId: b.projectId,
        format: b.format,
        scope,
        includeMedia: b.includeMedia ?? false,
      });

      // Ping the worker via Redis so it can pick up the job without
      // waiting on its polling tick.
      await state.redis.client
        .publish('sabwa:exports:ping', JSON.stringify({ exportId: id }))
        .catch(() => undefined);

      res.json({ exportId: id, status: 'queued' });
    } catch (err) {
      state.log.error({ err }, 'export.create failed');
      res.status(500).json({ error: 'export.create failed', code: 'internal' });
    }
  });

  // ── GET /v1/export?sessionId=… ──────────────────────────────────────────
  router.get('/', async (req: Request, res: Response) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'sessionId is required', code: 'bad_request' });
      return;
    }
    try {
      const rows = await exports.listBySession(state.db, parsed.data.sessionId);
      res.json({ exports: rows.map(exports.toWire) });
    } catch (err) {
      state.log.error({ err }, 'export.list failed');
      res.status(500).json({ error: 'export.list failed', code: 'internal' });
    }
  });

  // ── GET /v1/export/:id ──────────────────────────────────────────────────
  router.get('/:id', async (req: Request, res: Response) => {
    const id = asString(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'bad_request' });
      return;
    }
    try {
      const doc = await exports.findById(state.db, id);
      if (!doc) {
        res.status(404).json({ error: 'export not found', code: 'not_found' });
        return;
      }
      res.json({ export: exports.toWire(doc), status: doc.status });
    } catch (err) {
      state.log.error({ err, id }, 'export.get failed');
      res.status(500).json({ error: 'export.get failed', code: 'internal' });
    }
  });

  return router;
}
