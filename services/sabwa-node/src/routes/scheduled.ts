/**
 * `/v1/scheduled` — schedule, list, edit and cancel future messages.
 *
 * Mirrors `services/sabwa-engine/src/routes/scheduled.rs`. The Node engine
 * does NOT bounce jobs through a Redis delayed-job queue — instead, the
 * scheduler worker (`src/workers/scheduler.ts`) polls Mongo every 30 s and
 * fires due rows directly via the in-process BaileysSession pool. So these
 * handlers are pure CRUD against `sabwa_scheduled`.
 *
 * Routes:
 *   GET    /v1/scheduled?sessionId=:id&status=:s  → { items: ScheduledRow[] }
 *   POST   /v1/scheduled                          → ScheduledRow
 *   PATCH  /v1/scheduled/:id                      → ScheduledRow
 *   DELETE /v1/scheduled/:id                      → { id, cancelled }
 */

import { randomUUID } from 'node:crypto';

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import type { AppState } from '../state.js';
import * as scheduled from '../db/scheduled.js';
import { validateCron } from '../workers/scheduler.js';

// ── Zod schemas ─────────────────────────────────────────────────────────────

const TargetSchema = z.object({
  jid: z.string().min(1),
  type: z.enum(['individual', 'group', 'broadcast']).default('individual'),
});

const ListQuery = z.object({
  sessionId: z.string().min(1),
  status: z.enum(['pending', 'sent', 'failed', 'cancelled']).optional(),
});

const CreateBody = z
  .object({
    sessionId: z.string().min(1),
    projectId: z.string().min(1).optional(),
    kind: z.enum(['one_off', 'recurring']),
    scheduledFor: z.union([z.string(), z.number(), z.date()]),
    cron: z.string().min(1).optional(),
    timezone: z.string().min(1).optional(),
    targets: z.array(TargetSchema).min(1),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: z.any(),
  })
  .refine((v) => v.kind !== 'recurring' || !!v.cron, {
    message: 'recurring schedules require a `cron` string',
    path: ['cron'],
  });

const UpdateBody = z.object({
  scheduledFor: z.union([z.string(), z.number(), z.date()]).optional(),
  cron: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  targets: z.array(TargetSchema).optional(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: z.any().optional(),
});

function parseDate(v: string | number | Date): Date {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`invalid date: ${String(v)}`);
  }
  return d;
}

export function buildScheduledRouter(state: AppState): Router {
  const router = Router();

  // ── GET /v1/scheduled ─────────────────────────────────────────────────────
  router.get('/', async (req: Request, res: Response) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: 'bad_request' });
      return;
    }
    try {
      const rows = await scheduled.listBySession(
        state.db,
        parsed.data.sessionId,
        parsed.data.status,
      );
      res.json({ items: rows.map(scheduled.toRow) });
    } catch (err) {
      state.log.error({ err }, 'scheduled.list failed');
      res.status(500).json({ error: 'scheduled.list failed', code: 'internal' });
    }
  });

  // ── POST /v1/scheduled ────────────────────────────────────────────────────
  router.post('/', async (req: Request, res: Response) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: 'bad_request' });
      return;
    }
    try {
      const body = parsed.data;
      const scheduledFor = parseDate(body.scheduledFor);

      if (body.cron) {
        // Surface invalid crons at create time so the user sees a 400 instead
        // of a silent worker error 30 s later.
        const cronError = validateCron(body.cron, body.timezone ?? 'UTC');
        if (cronError) {
          res.status(400).json({ error: cronError, code: 'bad_request' });
          return;
        }
      }

      const id = `sch_${randomUUID()}`;
      const doc = await scheduled.insert(state.db, {
        _id: id,
        projectId: body.projectId,
        sessionId: body.sessionId,
        kind: body.kind,
        scheduledFor,
        cron: body.cron,
        timezone: body.timezone ?? 'UTC',
        targets: body.targets,
        payload: body.payload ?? null,
      });
      res.json(scheduled.toRow(doc));
    } catch (err) {
      state.log.error({ err }, 'scheduled.create failed');
      const message = err instanceof Error ? err.message : 'internal error';
      res.status(500).json({ error: message, code: 'internal' });
    }
  });

  // ── PATCH /v1/scheduled/:id ───────────────────────────────────────────────
  router.patch('/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'bad_request' });
      return;
    }
    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: 'bad_request' });
      return;
    }
    try {
      const body = parsed.data;
      const patch: scheduled.UpdateParams = {};
      if (body.scheduledFor !== undefined) patch.scheduledFor = parseDate(body.scheduledFor);
      if (body.cron !== undefined) patch.cron = body.cron;
      if (body.timezone !== undefined) patch.timezone = body.timezone;
      if (body.targets !== undefined) patch.targets = body.targets;
      if (body.payload !== undefined) patch.payload = body.payload;

      if (patch.cron) {
        const cronError = validateCron(patch.cron, patch.timezone ?? 'UTC');
        if (cronError) {
          res.status(400).json({ error: cronError, code: 'bad_request' });
          return;
        }
      }

      const updated = await scheduled.update(state.db, id, patch);
      if (!updated) {
        res.status(404).json({ error: 'not found or not pending', code: 'not_found' });
        return;
      }
      const fresh = await scheduled.findById(state.db, id);
      if (!fresh) {
        res.status(404).json({ error: 'not found', code: 'not_found' });
        return;
      }
      res.json(scheduled.toRow(fresh));
    } catch (err) {
      state.log.error({ err, id }, 'scheduled.update failed');
      const message = err instanceof Error ? err.message : 'internal error';
      res.status(500).json({ error: message, code: 'internal' });
    }
  });

  // ── DELETE /v1/scheduled/:id ──────────────────────────────────────────────
  router.delete('/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'bad_request' });
      return;
    }
    try {
      const cancelled = await scheduled.cancel(state.db, id);
      if (!cancelled) {
        res.status(404).json({ error: 'not found or not pending', code: 'not_found' });
        return;
      }
      res.json({ id, cancelled: true });
    } catch (err) {
      state.log.error({ err, id }, 'scheduled.cancel failed');
      res.status(500).json({ error: 'scheduled.cancel failed', code: 'internal' });
    }
  });

  return router;
}
