/**
 * `/v1/api-keys` — project-scoped programmatic credentials.
 *
 *   GET    /v1/api-keys?projectId=<id>  → { apiKeys: [...] }   (no full token)
 *   POST   /v1/api-keys                 → { apiKey, token }     (token shown once)
 *   DELETE /v1/api-keys/:id             → { ok: true }
 *
 * The wire shape returned in `apiKeys` only includes `tokenPrefix`; the full
 * plaintext token is **only** returned in the POST response. Storage stores
 * the SHA-256 hash of the token (see `db/api-keys.ts`).
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AppState } from '../state.js';
import { recordAudit } from '../db/audit.js';
import {
  createApiKey,
  deleteApiKey,
  findApiKey,
  listApiKeys,
} from '../db/api-keys.js';
import { actorContext, badRequest, notFound, stateOf } from './_helpers.js';

const createSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120),
  scopes: z.array(z.string().min(1)).default([]),
});

async function handleList(req: Request, res: Response): Promise<void> {
  const projectId = req.query.projectId;
  if (typeof projectId !== 'string' || projectId.length === 0) {
    badRequest(res, 'projectId query parameter is required');
    return;
  }
  const apiKeys = await listApiKeys(stateOf(req), projectId);
  res.json({ apiKeys });
}

async function handleCreate(req: Request, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'invalid body', parsed.error.issues);
    return;
  }
  const state = stateOf(req);
  const actor = actorContext(req);
  const created = await createApiKey(state, {
    projectId: parsed.data.projectId,
    name: parsed.data.name,
    scopes: parsed.data.scopes,
    createdBy: actor.userId,
  });
  if (!created) {
    badRequest(res, 'invalid projectId');
    return;
  }
  await recordAudit(state, {
    projectId: parsed.data.projectId,
    action: 'api_key.create',
    targetKind: 'api_key',
    targetId: created.apiKey.id,
    metadata: {
      name: created.apiKey.name,
      scopes: created.apiKey.scopes,
      tokenPrefix: created.apiKey.tokenPrefix,
    },
    ...actor,
  });
  res.status(201).json({ apiKey: created.apiKey, token: created.token });
}

async function handleDelete(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (!id) {
    badRequest(res, 'id is required');
    return;
  }
  const state = stateOf(req);
  const existing = await findApiKey(state, id);
  if (!existing) {
    notFound(res, 'api-key');
    return;
  }
  const ok = await deleteApiKey(state, id);
  if (!ok) {
    notFound(res, 'api-key');
    return;
  }
  await recordAudit(state, {
    projectId: existing.projectId,
    action: 'api_key.delete',
    targetKind: 'api_key',
    targetId: id,
    metadata: { name: existing.name },
    ...actorContext(req),
  });
  res.json({ ok: true });
}

export function buildApiKeysRouter(_state: AppState): Router {
  const r = Router();
  r.get('/', (req, res, next) => void handleList(req, res).catch(next));
  r.post('/', (req, res, next) => void handleCreate(req, res).catch(next));
  r.delete('/:id', (req, res, next) => void handleDelete(req, res).catch(next));
  return r;
}
