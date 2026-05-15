/**
 * `/v1/audit` — read-only audit log access.
 *
 *   GET /v1/audit?projectId=<id>
 *                &from=<iso>&to=<iso>
 *                &actor=<userId>&action=<str>
 *                &cursor=<base64>
 *     → { entries: [...], nextCursor? }
 *
 * Cursor is opaque (`base64url("<ms>:<objectid>")`). See `db/audit.ts`.
 */

import { Router, type Request, type Response } from 'express';
import type { AppState } from '../state.js';
import { listAudit } from '../db/audit.js';
import { badRequest, stateOf } from './_helpers.js';

function parseDate(raw: unknown): Date | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

async function handleList(req: Request, res: Response): Promise<void> {
  const projectId = req.query.projectId;
  if (typeof projectId !== 'string' || projectId.length === 0) {
    badRequest(res, 'projectId query parameter is required');
    return;
  }
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  const actor = typeof req.query.actor === 'string' ? req.query.actor : undefined;
  const action = typeof req.query.action === 'string' ? req.query.action : undefined;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;
  const limit = Number.isFinite(limitRaw) ? (limitRaw as number) : undefined;

  const q: Parameters<typeof listAudit>[1] = { projectId };
  if (from) q.from = from;
  if (to) q.to = to;
  if (actor) q.actor = actor;
  if (action) q.action = action;
  if (cursor) q.cursor = cursor;
  if (limit !== undefined) q.limit = limit;

  const result = await listAudit(stateOf(req), q);
  res.json(result);
}

export function buildAuditRouter(_state: AppState): Router {
  const r = Router();
  r.get('/', (req, res, next) => void handleList(req, res).catch(next));
  return r;
}
