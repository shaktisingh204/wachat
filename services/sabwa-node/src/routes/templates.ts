/**
 * `/v1/templates` — CRUD for saved message templates.
 *
 * Routes:
 *   GET    /v1/templates?sessionId=<id>  list   -> { templates: TemplateDto[] }
 *   POST   /v1/templates                  create -> { template: TemplateDto }
 *   PATCH  /v1/templates/:id              update -> { template: TemplateDto }
 *   DELETE /v1/templates/:id              delete -> 204
 *
 * Wire shape matches `SabwaTemplate` in `src/lib/sabwa/types.ts`. We also
 * surface `templateId` on the create response so legacy Next.js callers
 * (`upsertTemplate` in `sabwa.actions.ts`) keep working — they only read
 * `templateId` off the body.
 */

import { Router, type Request, type Response } from 'express';

import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
} from '../db/templates.js';
import type { AppState } from '../state.js';
import { asString } from './_helpers.js';

function stateFrom(req: Request): AppState {
  return req.app.locals.state as AppState;
}

export function buildTemplatesRouter(): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const sessionId = asString(req.query.sessionId);
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required', code: 'bad_request' });
      return;
    }
    try {
      const templates = await listTemplates(stateFrom(req).db, sessionId);
      res.json({ templates });
    } catch (err) {
      stateFrom(req).log.error({ err }, 'templates: list failed');
      res.status(500).json({ error: 'failed to list templates', code: 'internal' });
    }
  });

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const text = typeof body.body === 'string' ? body.body : '';
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required', code: 'bad_request' });
      return;
    }
    if (!name) {
      res.status(400).json({ error: 'name is required', code: 'bad_request' });
      return;
    }
    if (!text) {
      res.status(400).json({ error: 'body is required', code: 'bad_request' });
      return;
    }
    try {
      const template = await createTemplate(stateFrom(req).db, {
        sessionId,
        projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
        name,
        body: text,
        category: typeof body.category === 'string' ? body.category : undefined,
        variables: Array.isArray(body.variables)
          ? (body.variables as unknown[]).filter(
              (v): v is string => typeof v === 'string',
            )
          : undefined,
        mediaSabFileId:
          typeof body.mediaSabFileId === 'string' ? body.mediaSabFileId : undefined,
      });
      // `templateId` is kept for backwards-compat with `upsertTemplate` callers
      // that only consume the id off the response envelope.
      res.json({ template, templateId: template._id });
    } catch (err) {
      stateFrom(req).log.error({ err }, 'templates: create failed');
      res.status(500).json({ error: 'failed to create template', code: 'internal' });
    }
  });

  router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
    const id = asString(req.params.id);
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
      const template = await updateTemplate(stateFrom(req).db, id, {
        name: typeof body.name === 'string' ? body.name : undefined,
        body: typeof body.body === 'string' ? body.body : undefined,
        category: typeof body.category === 'string' ? body.category : undefined,
        variables: Array.isArray(body.variables)
          ? (body.variables as unknown[]).filter(
              (v): v is string => typeof v === 'string',
            )
          : undefined,
        mediaSabFileId:
          typeof body.mediaSabFileId === 'string' ? body.mediaSabFileId : undefined,
      });
      if (!template) {
        res.status(404).json({ error: 'template not found', code: 'not_found' });
        return;
      }
      res.json({ template });
    } catch (err) {
      stateFrom(req).log.error({ err, id }, 'templates: update failed');
      res.status(500).json({ error: 'failed to update template', code: 'internal' });
    }
  });

  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    const id = asString(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'bad_request' });
      return;
    }
    try {
      await deleteTemplate(stateFrom(req).db, id);
      res.status(204).end();
    } catch (err) {
      stateFrom(req).log.error({ err, id }, 'templates: delete failed');
      res.status(500).json({ error: 'failed to delete template', code: 'internal' });
    }
  });

  return router;
}
