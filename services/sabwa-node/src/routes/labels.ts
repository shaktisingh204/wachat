/**
 * `/v1/labels` — CRUD for chat labels.
 *
 * Routes:
 *   GET    /v1/labels?sessionId=<id>   list      -> { labels: LabelDto[] }
 *   POST   /v1/labels                  create    -> { label:  LabelDto }
 *   PATCH  /v1/labels/:id              update    -> { label:  LabelDto }
 *   DELETE /v1/labels/:id              delete    -> 204
 *
 * The wire shape matches `SabwaLabelRow` in
 * `src/app/actions/sabwa.actions.ts` (id, name, color, createdAt?).
 */

import { Router, type Request, type Response } from 'express';

import {
  createLabel,
  deleteLabel,
  listLabels,
  updateLabel,
} from '../db/labels.js';
import type { AppState } from '../state.js';

function stateFrom(req: Request): AppState {
  return req.app.locals.state as AppState;
}

export function buildLabelsRouter(): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const sessionId =
      typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required', code: 'bad_request' });
      return;
    }
    try {
      const labels = await listLabels(stateFrom(req).db, sessionId);
      res.json({ labels });
    } catch (err) {
      stateFrom(req).log.error({ err }, 'labels: list failed');
      res.status(500).json({ error: 'failed to list labels', code: 'internal' });
    }
  });

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const color = typeof body.color === 'string' ? body.color.trim() : '';
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required', code: 'bad_request' });
      return;
    }
    if (!name) {
      res.status(400).json({ error: 'name is required', code: 'bad_request' });
      return;
    }
    if (!color) {
      res.status(400).json({ error: 'color is required', code: 'bad_request' });
      return;
    }
    try {
      const label = await createLabel(stateFrom(req).db, {
        sessionId,
        projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
        name,
        color,
        order: typeof body.order === 'number' ? body.order : undefined,
      });
      res.json({ label });
    } catch (err) {
      stateFrom(req).log.error({ err }, 'labels: create failed');
      res.status(500).json({ error: 'failed to create label', code: 'internal' });
    }
  });

  router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'bad_request' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.name === 'string' && body.name.trim().length === 0) {
      res.status(400).json({ error: 'name cannot be empty', code: 'bad_request' });
      return;
    }
    try {
      const label = await updateLabel(stateFrom(req).db, id, {
        name: typeof body.name === 'string' ? body.name : undefined,
        color: typeof body.color === 'string' ? body.color : undefined,
        order: typeof body.order === 'number' ? body.order : undefined,
      });
      if (!label) {
        res.status(404).json({ error: 'label not found', code: 'not_found' });
        return;
      }
      res.json({ label });
    } catch (err) {
      stateFrom(req).log.error({ err, id }, 'labels: update failed');
      res.status(500).json({ error: 'failed to update label', code: 'internal' });
    }
  });

  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'bad_request' });
      return;
    }
    try {
      await deleteLabel(stateFrom(req).db, id);
      res.status(204).end();
    } catch (err) {
      stateFrom(req).log.error({ err, id }, 'labels: delete failed');
      res.status(500).json({ error: 'failed to delete label', code: 'internal' });
    }
  });

  return router;
}
