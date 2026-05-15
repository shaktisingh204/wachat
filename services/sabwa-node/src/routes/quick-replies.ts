/**
 * `/v1/quick-replies` — CRUD for slash-command snippets.
 *
 * Routes:
 *   GET    /v1/quick-replies?sessionId=<id>  list   -> { quickReplies: QuickReplyDto[] }
 *   POST   /v1/quick-replies                  create -> { quickReply: QuickReplyDto }
 *   PATCH  /v1/quick-replies/:id              update -> { quickReply: QuickReplyDto }
 *   DELETE /v1/quick-replies/:id              delete -> 204
 *
 * Wire shape matches `SabwaQuickReply` in `src/lib/sabwa/types.ts`. The
 * legacy `upsertQuickReply` action reads `quickReplyId` off the create
 * response, so we mirror that field alongside the full `quickReply` object.
 */

import { Router, type Request, type Response } from 'express';

import {
  createQuickReply,
  deleteQuickReply,
  listQuickReplies,
  updateQuickReply,
} from '../db/quick-replies.js';
import type { AppState } from '../state.js';
import { asString } from './_helpers.js';

function stateFrom(req: Request): AppState {
  return req.app.locals.state as AppState;
}

export function buildQuickRepliesRouter(): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const sessionId = asString(req.query.sessionId);
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required', code: 'bad_request' });
      return;
    }
    try {
      const quickReplies = await listQuickReplies(stateFrom(req).db, sessionId);
      res.json({ quickReplies });
    } catch (err) {
      stateFrom(req).log.error({ err }, 'quick-replies: list failed');
      res.status(500).json({ error: 'failed to list quick replies', code: 'internal' });
    }
  });

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const shortcut = typeof body.shortcut === 'string' ? body.shortcut.trim() : '';
    const text = typeof body.body === 'string' ? body.body : '';
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required', code: 'bad_request' });
      return;
    }
    if (!shortcut) {
      res.status(400).json({ error: 'shortcut is required', code: 'bad_request' });
      return;
    }
    if (!text) {
      res.status(400).json({ error: 'body is required', code: 'bad_request' });
      return;
    }
    try {
      const quickReply = await createQuickReply(stateFrom(req).db, {
        sessionId,
        projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
        shortcut,
        body: text,
        mediaSabFileId:
          typeof body.mediaSabFileId === 'string' ? body.mediaSabFileId : undefined,
      });
      res.json({ quickReply, quickReplyId: quickReply._id });
    } catch (err) {
      stateFrom(req).log.error({ err }, 'quick-replies: create failed');
      res.status(500).json({ error: 'failed to create quick reply', code: 'internal' });
    }
  });

  router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
    const id = asString(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'bad_request' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.shortcut === 'string' && body.shortcut.trim().length === 0) {
      res.status(400).json({ error: 'shortcut cannot be empty', code: 'bad_request' });
      return;
    }
    try {
      const quickReply = await updateQuickReply(stateFrom(req).db, id, {
        shortcut: typeof body.shortcut === 'string' ? body.shortcut : undefined,
        body: typeof body.body === 'string' ? body.body : undefined,
        mediaSabFileId:
          typeof body.mediaSabFileId === 'string' ? body.mediaSabFileId : undefined,
      });
      if (!quickReply) {
        res.status(404).json({ error: 'quick reply not found', code: 'not_found' });
        return;
      }
      res.json({ quickReply });
    } catch (err) {
      stateFrom(req).log.error({ err, id }, 'quick-replies: update failed');
      res.status(500).json({ error: 'failed to update quick reply', code: 'internal' });
    }
  });

  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    const id = asString(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'bad_request' });
      return;
    }
    try {
      await deleteQuickReply(stateFrom(req).db, id);
      res.status(204).end();
    } catch (err) {
      stateFrom(req).log.error({ err, id }, 'quick-replies: delete failed');
      res.status(500).json({ error: 'failed to delete quick reply', code: 'internal' });
    }
  });

  return router;
}
