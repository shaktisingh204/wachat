/**
 * `/v1/group-categories` — CRUD for SabNode-side group categories.
 *
 * Routes:
 *   GET    /v1/group-categories?sessionId=<id>   list
 *   POST   /v1/group-categories                  create
 *   PATCH  /v1/group-categories/:id              partial update
 *   DELETE /v1/group-categories/:id              hard delete (204)
 *
 * Response envelope mirrors the Rust engine (Next.js depends on this):
 *   - list:   { categories: GroupCategoryDto[] }
 *   - create: { category: GroupCategoryDto }
 *   - update: { category: GroupCategoryDto }
 *   - delete: 204 No Content
 */

import { Router, type Request, type Response } from 'express';

import {
  createGroupCategory,
  deleteGroupCategory,
  listGroupCategories,
  updateGroupCategory,
} from '../db/group-categories.js';
import type { AppState } from '../state.js';

function stateFrom(req: Request): AppState {
  return req.app.locals.state as AppState;
}

export function buildGroupCategoriesRouter(): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const sessionId =
      typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required', code: 'bad_request' });
      return;
    }
    try {
      const categories = await listGroupCategories(stateFrom(req).db, sessionId);
      res.json({ categories });
    } catch (err) {
      stateFrom(req).log.error({ err }, 'group-categories: list failed');
      res.status(500).json({ error: 'failed to list group categories', code: 'internal' });
    }
  });

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required', code: 'bad_request' });
      return;
    }
    if (!name) {
      res.status(400).json({ error: 'name is required', code: 'bad_request' });
      return;
    }
    try {
      const category = await createGroupCategory(stateFrom(req).db, {
        sessionId,
        projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
        name,
        color: typeof body.color === 'string' ? body.color : undefined,
        icon: typeof body.icon === 'string' ? body.icon : undefined,
        order: typeof body.order === 'number' ? body.order : undefined,
        groupJids: Array.isArray(body.groupJids)
          ? (body.groupJids as unknown[]).filter(
              (v): v is string => typeof v === 'string',
            )
          : undefined,
      });
      res.json({ category });
    } catch (err) {
      stateFrom(req).log.error({ err }, 'group-categories: create failed');
      res.status(500).json({ error: 'failed to create group category', code: 'internal' });
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
      const category = await updateGroupCategory(stateFrom(req).db, id, {
        name: typeof body.name === 'string' ? body.name : undefined,
        color: typeof body.color === 'string' ? body.color : undefined,
        icon: typeof body.icon === 'string' ? body.icon : undefined,
        order: typeof body.order === 'number' ? body.order : undefined,
        groupJids: Array.isArray(body.groupJids)
          ? (body.groupJids as unknown[]).filter(
              (v): v is string => typeof v === 'string',
            )
          : undefined,
      });
      if (!category) {
        res.status(404).json({ error: 'category not found', code: 'not_found' });
        return;
      }
      res.json({ category });
    } catch (err) {
      stateFrom(req).log.error({ err, id }, 'group-categories: update failed');
      res.status(500).json({ error: 'failed to update group category', code: 'internal' });
    }
  });

  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'bad_request' });
      return;
    }
    try {
      await deleteGroupCategory(stateFrom(req).db, id);
      res.status(204).end();
    } catch (err) {
      stateFrom(req).log.error({ err, id }, 'group-categories: delete failed');
      res.status(500).json({ error: 'failed to delete group category', code: 'internal' });
    }
  });

  return router;
}
